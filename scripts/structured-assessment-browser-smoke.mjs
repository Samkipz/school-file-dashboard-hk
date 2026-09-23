import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { config } from 'dotenv'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { developmentPool } from './db-common.mjs'
import { assessmentService } from '../lib/domain/assessments.ts'
config({ path: '.env.local', quiet: true })
if (!process.argv.includes('--retain-test-evidence')) throw new Error('This browser test retains a synthetic definition and its audit history; pass --retain-test-evidence')
const targetCheck = developmentPool()
await targetCheck.end()
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local verification server')
const profile = await mkdtemp(join(tmpdir(), 'schoolhub-structured-browser-'))
const evidence = process.env.SMOKE_EVIDENCE_DIR ?? '.github/verification/structured-assessments'
await mkdir(evidence, { recursive: true })
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, cookie = '', sequence = 0
const pending = new Map()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, label) {
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) { if (await check()) return; await delay(150) }
  throw new Error(`Timed out: ${label}`)
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++sequence
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
    pending.set(requestId, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(`Browser evaluation failed: ${response.exceptionDetails.exception?.description ?? response.exceptionDetails.text}`)
  return response.result.value
}
async function navigate(path, text) {
  await evaluate("if(document.documentElement) document.documentElement.dataset.verificationNavigation='pending'")
  await send('Page.navigate', { url: `${base}${path}` })
  await until(() => evaluate(`document.documentElement && !document.documentElement.dataset.verificationNavigation && document.readyState==='complete' && document.body.innerText.includes(${JSON.stringify(text)})`), text)
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(evidence, name), Buffer.from(result.data, 'base64'))
}
const mainLinks = () => evaluate("Array.from(document.querySelectorAll('nav[aria-label=\"Main navigation\"] a')).map(a=>a.textContent.trim())")
try {
  let port
  await until(async () => { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return !!port } catch { return false } }, 'Chrome startup')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const response = JSON.parse(event.data)
    if (response.method === 'Page.javascriptDialogOpening' && response.params.type === 'beforeunload') { void send('Page.handleJavaScriptDialog', { accept: false }); return }
    if (!response.id) return
    const item = pending.get(response.id)
    if (!item) return
    clearTimeout(item.timeout); pending.delete(response.id)
    if (response.error) item.reject(new Error(response.error.message)); else item.resolve(response.result)
  }
  socket.onclose = () => { for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Browser closed')) }; pending.clear() }
  await send('Page.enable')
  const login = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'teacher@schoolhub.test', password: process.env.DEV_SEED_PASSWORD }) })
  assert.equal(login.status, 200)
  const pairs = login.headers.getSetCookie().map(c => c.split(';')[0])
  cookie = pairs.join('; ')
  for (const pair of pairs) { const i = pair.indexOf('='); await send('Network.setCookie', { name: pair.slice(0, i), value: pair.slice(i + 1), url: base }) }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/', 'Open My Teaching')
  assert.deepEqual(await mainLinks(), ['Home', 'My Teaching', 'Private Files'])
  assert.equal(await evaluate("['Current academic year','Current term','2026-DEMO','Grade 10 East'].every(t=>document.body.innerText.includes(t))"), true)
  assert.equal(await evaluate("document.body.innerText.includes('assessments pending') || document.body.innerText.includes('File Repository')"), false)
  await navigate('/academics?school='+school, 'My Teaching')
  await evaluate(`Array.from(document.querySelectorAll('main a')).find(a=>new URL(a.href).searchParams.get('offering')===${JSON.stringify(id('offering-math'))}).click()`)
  await until(()=>evaluate("document.body.innerText.includes('Subject overview')"),'authorized offering')
  await delay(1000)
  await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Subject workspace"] a')).find(a=>a.textContent==='Assessments').click()`)
  await until(()=>evaluate("document.body.innerText.includes('Create assessment')"),'Assessments destination')
  await evaluate("Array.from(document.querySelectorAll('main a')).find(a=>a.textContent==='Create assessment').click()")
  await until(() => evaluate("!!document.querySelector('form[aria-label=\"Assessment draft\"]')"), 'authoring form')
  console.log('Teacher preparation screen loaded')
  await delay(1000)
  const set = async (label, value) => {
    await evaluate('('+((label,value)=>{const el=document.querySelector('[aria-label="'+label+'"]');if(!el)throw new Error('Missing '+label);const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}).toString()+')('+JSON.stringify(label)+','+JSON.stringify(value)+')')
    await until(()=>evaluate('('+((label,value)=>{
      const p=JSON.parse(document.querySelector('form[aria-label="Assessment draft"] input[name="payload"]').value)
      const indicator=label.match(/^Task (\d+) criterion (\d+) indicator (\d+) (descriptor|score)$/)
      const criterion=label.match(/^Task (\d+) criterion (\d+) title$/)
      const task=label.match(/^Task (\d+) title$/), level=label.match(/^Level (\d+) (lower|upper|code|descriptor)$/)
      const actual=indicator?p.tasks[Number(indicator[1])-1].criteria[Number(indicator[2])-1].indicators[Number(indicator[3])-1][indicator[4]]:criterion?p.tasks[Number(criterion[1])-1].criteria[Number(criterion[2])-1].title:task?p.tasks[Number(task[1])-1].title:level?p.levels[Number(level[1])-1][level[2]]:label==='Assessment title'?p.title:p.assessment_type_id
      return actual===value
    }).toString()+')('+JSON.stringify(label)+','+JSON.stringify(value)+')'),'submitted '+label+' state')
  }
  const click = async text => { await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent==='+JSON.stringify(text)+').click()'); await delay(200) }
  const title='Synthetic browser structured '+Date.now()
  await set('Assessment title',title)
  const type=await evaluate(`document.querySelector('[aria-label="Assessment type"]').options[1].value`)
  await set('Assessment type',type)
  await click('Save draft')
  await until(()=>evaluate('new URLSearchParams(location.search).has("draft") && document.body.innerText.includes("Saved draft")'),'incomplete draft saved')
  await delay(1000)
  await click('Next: Tasks and scoring');
  await click('Add task');await set('Task 1 title','Capture photograph')
  await click('Add criterion');await set('Task 1 criterion 1 title','Composition')
  await click('Add indicator');await set('Task 1 criterion 1 indicator 1 descriptor','Composition supports subject');await set('Task 1 criterion 1 indicator 1 score','3.25')
  await click('Add indicator');await set('Task 1 criterion 1 indicator 2 descriptor','Not demonstrated');await set('Task 1 criterion 1 indicator 2 score','0')
  await evaluate(`document.querySelector('button[aria-label="Move indicator down"]').focus()`)
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Move indicator down')
  // CDP must include Enter's character to produce the native button activation.
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  await until(()=>evaluate(`document.querySelector('[aria-label="Task 1 criterion 1 indicator 1 score"]').value==='0'`),'keyboard indicator reorder')
  await evaluate(`document.querySelector('button[aria-label="Move indicator down"]').click()`)
  await until(()=>evaluate(`document.querySelector('[aria-label="Task 1 criterion 1 indicator 1 score"]').value==='3.25'`),'restored indicator order')
  await click('Add task'); await set('Task 2 title','Explain choices')
  await click('Add criterion'); await set('Task 2 criterion 1 title','Explanation')
  await click('Add indicator'); await set('Task 2 criterion 1 indicator 1 descriptor','Clear explanation'); await set('Task 2 criterion 1 indicator 1 score','2.50')
  await click('Next: Result descriptions');
  await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.textContent==='Marks with result descriptions').querySelector('input').click()`);
  await click('Add performance level');await set('Level 1 lower','0');await set('Level 1 upper','5.75');await set('Level 1 code','A');await set('Level 1 descriptor','Configured performance')
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true,'mobile authoring overflow')
  await screenshot('teacher-authoring-mobile.png')
  // A rejected range save must retain every entered value.
  await set('Level 1 upper','2.00')
  await click('Save draft')
  await until(()=>evaluate("document.body.innerText.includes('final performance boundary')"),'range rejection')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Level 1 upper"]').value`),'2.00')
  await set('Level 1 upper','5.75')
  await evaluate('window.confirm=()=>false')
  await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Subject workspace"] a')).find(a=>a.textContent==='Learners').click()`)
  await delay(500)
  assert.equal(await evaluate(`!!document.querySelector('form[aria-label="Assessment draft"]')`),true,'cancelled navigation retains draft')
  await evaluate("Array.from(document.querySelectorAll('label')).find(l=>l.textContent==='Marks only').querySelector('input').click()")
  assert.equal(await evaluate(`document.querySelector('[aria-label="Level 1 upper"]').value`),'5.75','cancelled removal retains descriptions')
  if (await evaluate("!!window.navigation")) {
    const beforeBack = await evaluate('location.href')
    await evaluate('history.back()'); await delay(500)
    assert.equal(await evaluate('location.href'),beforeBack,'cancelled browser Back retains unsaved work')
  }
  await click('1. Details')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Assessment title"]').value`),title,'back preserves title')
  await click('3. Result descriptions')
  await send('Network.enable')
  await send('Network.setBlockedURLs',{urls:[base+'/*']})
  await click('Save draft')
  await until(()=>evaluate("document.body.innerText.includes('Save failed')"),'network failure retained')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Level 1 upper"]').value`),'5.75')
  await send('Network.setBlockedURLs',{urls:[]})
  await click('Save draft')
  await until(()=>evaluate('new URLSearchParams(location.search).has("draft") && document.body.innerText.includes("Saved draft")'),'saved structured draft')
  const url=await evaluate('location.pathname+location.search')
  await navigate(url,'Saved draft')
  await click('2. Tasks and scoring');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Task 1 criterion 1 indicator 1 score"]').value`),'3.25')
  // Advance the committed revision while this teacher still holds the previous one.
  const pool = developmentPool()
  try {
    const service = assessmentService(pool, async()=>id('user-admin'))
    const draftId = new URL('http://localhost'+url).searchParams.get('draft')
    const current = await service.get(school, draftId)
    await service.save(school, {...current, title: current.title+' concurrent'}, draftId, Number(current.row_version))
  } finally { await pool.end() }
  await click('1. Details'); await set('Assessment title',title+' local unsaved')
  await click('Save draft')
  await until(()=>evaluate("document.body.innerText.includes('This record changed')"),'stale save rejected')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Assessment title"]').value`),title+' local unsaved')
  await evaluate('window.confirm=()=>true')
  await click('Reload saved version')
  await until(()=>evaluate("document.body.innerText.includes('Saved draft')"),'conflict reload')
  await delay(1000)
  await click('4. Review')
  await delay(1000)
  await evaluate('window.confirm=()=>false')
  await click('Open for assessment'); await delay(500)
  assert.equal(await evaluate(`!!document.querySelector('form[aria-label="Assessment draft"]')`),true,'opening cancelled')
  await evaluate('window.confirm=message=>{sessionStorage.setItem("openingConfirmation",message);return true}')
  await click('Open for assessment')
  await until(()=>evaluate('document.body.innerText.includes("definition locked")'),'opened definition')
  assert.equal(await evaluate('sessionStorage.getItem("openingConfirmation")'),'Opening makes the assessment available for assessing learners. Its tasks and scoring guide can no longer be edited.')
  // Successful opening performs a fresh load of the committed definition.
  assert.equal(await evaluate(`document.body.innerText.includes('Assess learners')`),true)
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Task 1 title"]')`),false)
  assert.equal(await evaluate('Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Open assessment")'),false)
  await navigate(url,'definition locked')
  await screenshot('teacher-open-mobile.png')
  await evaluate("Array.from(document.querySelectorAll('main a')).find(a=>a.textContent==='Assess learners').click()")
  await until(()=>evaluate("document.body.innerText.includes('Assessment roster')"),'roster after opening')
  for (const offering of ['invalid',id('unknown-offering'),id('offering-school-2')]) {
    await navigate(`/academics?school=${school}&offering=${offering}&view=assessments`,'Teaching workspace unavailable')
    assert.equal(await evaluate('!!document.querySelector(\'form[aria-label="Assessment draft"]\')'),false)
  }
  await navigate(`/academics?school=${id('test-school-2')}&offering=${id('offering-math')}&view=assessments`,'School context unavailable')
  assert.equal(await evaluate('!!document.querySelector(\'form[aria-label="Assessment draft"]\')'),false)
  console.log('Guided structured browser PASS: incomplete draft resume, multiple tasks, failed range/network saves retain values, cancelled description removal, unsaved application/browser navigation, stale revision rejection, review and cancelled/confirmed opening, roster route; assigned workspace, create, tasks/criteria/indicators, fractional scores, scale, save, refresh, open, locked refresh, mobile layout. Synthetic definition and audit evidence retained according to existing browser convention; no learner or storage records created.')

} catch (error) {
  console.error({ error: error.name, message: error.message })
  if (socket?.readyState===WebSocket.OPEN) {
    const diagnostic=await evaluate(`({url:location.pathname+location.search,active:document.activeElement?.outerHTML,payload:document.querySelector('form[aria-label="Assessment draft"] input[name="payload"]')?.value,alerts:Array.from(document.querySelectorAll('[role="alert"]')).map(e=>e.textContent)})`).catch(()=>null)
    await writeFile(join(evidence,'browser-failure.json'),JSON.stringify(diagnostic,null,2))
    await screenshot('browser-failure.png').catch(()=>{})
  }
  process.exitCode = 1
}
finally {
  if (cookie) await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' }).catch(() => {})
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  chrome.kill()
  const target = resolve(profile), root = resolve(tmpdir()) + sep
  if (target.startsWith(root) && target.slice(root.length).startsWith('schoolhub-structured-browser-')) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {})
}
