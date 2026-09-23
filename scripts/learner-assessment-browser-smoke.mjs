import { assessmentService } from '../lib/domain/assessments.ts'
import { learnerAssessmentService } from '../lib/domain/learner-assessments.ts'
﻿import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { config } from 'dotenv'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { developmentPool } from './db-common.mjs'
config({ path: '.env.local', quiet: true })
if (!process.argv.includes('--retain-test-evidence')) throw new Error('This browser test retains a synthetic definition and its audit history; pass --retain-test-evidence')
const resultPool = developmentPool()
resultPool.options.connectionTimeoutMillis=15000
resultPool.options.query_timeout=120000
const targetCheck = developmentPool()
await targetCheck.end()
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local verification server')
const profile = await mkdtemp(join(tmpdir(), 'schoolhub-learner-browser-'))
const evidence = '.github/verification/learner-assessments'
await mkdir(evidence, { recursive: true })
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, cookie = '', sequence = 0
const pending = new Map()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, label) {
  const deadline = Date.now() + 30000
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
try {
  let port
  await until(async () => { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return !!port } catch { return false } }, 'Chrome startup')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const response = JSON.parse(event.data)
    if (!response.id) return
    const item = pending.get(response.id)
    if (!item) return
    clearTimeout(item.timeout); pending.delete(response.id)
    if (response.error) item.reject(new Error(response.error.message)); else item.resolve(response.result)
  }
  socket.onclose = () => { for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Browser closed')) }; pending.clear() }
  const login = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'teacher@schoolhub.test', password: process.env.DEV_SEED_PASSWORD }) })
  assert.equal(login.status, 200)
  const pairs = login.headers.getSetCookie().map(c => c.split(';')[0])
  cookie = pairs.join('; ')
  for (const pair of pairs) { const i = pair.indexOf('='); await send('Network.setCookie', { name: pair.slice(0, i), value: pair.slice(i + 1), url: base }) }
  if(process.argv.includes('--inspect-retained')) {
    const fixture=JSON.parse(await readFile(join(evidence,'retained-fixture.json'),'utf8'))
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await navigate('/academics?'+new URLSearchParams({school,offering:id('offering-math'),view:'assessments',assessment:fixture.assessment,learner:fixture.learner}),'Completed ? Read-only')
    await evaluate(`document.querySelector('section[id^="task-"]').scrollIntoView()`)
    assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true)
    await screenshot('completed-controls-mobile.png')
    await evaluate('Array.from(document.querySelectorAll("h4")).find(h=>h.textContent==="Evidence").scrollIntoView()')
    await screenshot('completed-evidence-mobile.png')
    console.log('Retained result visual inspection capture PASS; read-only navigation, no mutations.')
  } else {
  const definitions=assessmentService(resultPool,async()=>id('user-teacher')),results=learnerAssessmentService(resultPool,async()=>id('user-teacher'))
  const type=(await definitions.readOffering(school,id('offering-math'))).types[0].id
  const input={title:'Synthetic browser learner assessment '+Date.now(),offering_id:id('offering-math'),assessment_type_id:type,tasks:[{title:'Camera preparation',criteria:[{title:'Prepares the camera',indicators:[{descriptor:'Ready and checked',score:'1.10'},{descriptor:'Not demonstrated',score:'0'}]}]},{title:'Capture photograph',criteria:[{title:'Composition',indicators:[{descriptor:'Clear composition',score:'2.25'},{descriptor:'Partial composition',score:'1.05'}]}]}],levels:[{code:'SECURE',descriptor:'Secure performance',lower:'0',upper:'3.35'}]}
  const draft=await definitions.save(school,input),a=await definitions.open(school,draft.id,Number(draft.row_version)),roster=(await results.roster(school,a.id)).learners
  assert.ok(roster.length>=3)
  const asset=(await resultPool.query("SELECT id,learner_id FROM media_assets WHERE school_id=$1 AND state='ready' AND archived_at IS NULL AND learner_id=ANY($2::uuid[]) ORDER BY uploaded_at,id LIMIT 1",[school,roster.map(l=>l.id)])).rows[0]
  const learner=roster.find(l=>l.id===asset?.learner_id)??roster[0],other=roster.find(l=>l.id!==learner.id)
  const href=(learnerId)=>'/academics?'+new URLSearchParams({school,offering:a.offering_id,view:'assessments',assessment:a.id,...(learnerId?{learner:learnerId}:{})})
  const click=async text=>{await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent==='+JSON.stringify(text)+').click()');await delay(200)}
  const choose=async indicator=>{await evaluate(`document.querySelector('input[value="${indicator}"]').click()`);await until(()=>evaluate(`document.querySelector('input[value="${indicator}"]').checked`),'selected observation')}
  const confirm=()=>evaluate('window.confirm=message=>{window.lastConfirmation=message;return true}')
  await writeFile(join(evidence,'retained-fixture.json'),JSON.stringify({assessment:a.id,learner:learner.id,other:other.id,asset:asset?.id??null},null,2))
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  const warm = await fetch(base+'/', {headers:{Cookie:cookie}})
  assert.equal(warm.status,200); await warm.text()
  await navigate('/','Open My Teaching')
  await navigate('/academics?school='+school,'My Teaching')
  await evaluate(`Array.from(document.querySelectorAll('main a')).find(a=>new URL(a.href).searchParams.get('offering')===${JSON.stringify(a.offering_id)}).click()`)
  await until(()=>evaluate("document.body.innerText.includes('Subject overview')"),'offering')
  await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Subject workspace"] a')).find(a=>a.textContent==='Assessments').click()`)
  await until(()=>evaluate('document.body.innerText.includes('+JSON.stringify(input.title)+')'),'assessment list')
  await evaluate('Array.from(document.querySelectorAll("main a")).find(a=>a.textContent==='+JSON.stringify(input.title)+').click()')
  await until(()=>evaluate('document.body.innerText.includes("Assessment roster")'),'roster')
  assert.equal(await evaluate('document.querySelectorAll("main li").length'),roster.length)
  assert.equal(await evaluate('Array.from(document.querySelectorAll("main li")).every(l=>l.innerText.includes("Not started") && l.innerText.includes("—"))'),true)
  await screenshot('roster-desktop.png')
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true)
  await screenshot('roster-mobile.png')
  await navigate(href(learner.id),learner.display_name)
  await delay(800)
  await choose(a.tasks[0].criteria[0].indicators[0].id)
  await evaluate(`const f=document.querySelector('[aria-label="Teacher feedback"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(f,'Synthetic browser feedback: improve exposure.');f.dispatchEvent(new Event('input',{bubbles:true}))`)
  await delay(300)
  // Native radio and Save are keyboard-focusable; keyboard Enter submits the partial work.
  await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent==="Save").focus()')
  assert.equal(await evaluate('document.activeElement.textContent'), 'Save')
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  await until(()=>evaluate('document.body.innerText.includes("In progress")'),'partial saved')
  await navigate(href(learner.id),'In progress')
  assert.equal(await evaluate(`document.querySelector('input[value="${a.tasks[0].criteria[0].indicators[0].id}"]').checked`),true)
  assert.equal(await evaluate('document.querySelector("textarea").value'),'Synthetic browser feedback: improve exposure.')
  assert.equal(await evaluate('document.body.innerText.includes("1.10 / 3.35")'),true)
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true)
  await screenshot('learner-mobile-in-progress.png')
  await navigate(href(),'Assessment roster')
  assert.equal(await evaluate('Array.from(document.querySelectorAll("main li")).find(l=>l.innerText.includes('+JSON.stringify(learner.display_name)+')).innerText.includes("1.10 / 3.35 (partial)")'),true)
  await navigate(href(learner.id),'In progress');await delay(800);await confirm()
  await click('Complete & Next')
  await until(()=>evaluate('document.body.innerText.includes("1 criteria still need observations")'),'incomplete completion validation')
  assert.equal((await results.get(school,a.id,learner.id)).participation.status,'in_progress')
  await choose(a.tasks[1].criteria[0].indicators[0].id)
  if(asset){await evaluate(`const s=document.querySelector('[aria-label="Attach evidence"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(asset.id)});s.dispatchEvent(new Event('change',{bubbles:true}))`);await until(()=>evaluate('document.body.innerText.includes("Remove evidence")'),'evidence selected');await screenshot('evidence-selection-mobile.png')}
  await click('Complete & Next')
  const next=roster[roster.findIndex(l=>l.id===learner.id)+1]?.id??null
  await until(()=>evaluate('new URLSearchParams(location.search).get("learner")==='+JSON.stringify(next)),'deterministic next learner')
  const completed=await results.get(school,a.id,learner.id)
  assert.equal(completed.participation.status,'completed');assert.equal(completed.result.score,'3.35');assert.equal(completed.result.performance.code,'SECURE');if(asset)assert.equal(completed.evidence[0].asset_id,asset.id)
  await navigate(href(learner.id),'Completed · Read-only')
  assert.equal(await evaluate('Array.from(document.querySelectorAll("input[type=radio],textarea,select")).every(e=>e.matches(":disabled"))'),true)
  assert.equal(await evaluate('Array.from(document.querySelectorAll("main button")).some(b=>["Save","Complete & Next","Remove evidence"].includes(b.textContent))'),false)
  await screenshot('completed-readonly-mobile.png')
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await screenshot('completed-readonly-desktop.png')
  await navigate(href(),'Assessment roster');await screenshot('roster-completed-desktop.png')
  await navigate(href(other.id),other.display_name);await delay(800);await confirm();await click('Mark absent')
  await until(()=>evaluate('document.body.innerText.includes("Absent · Score: —")'),'absent state')
  await screenshot('absent-desktop.png')
  await navigate(href(),'Assessment roster')
  assert.equal(await evaluate('Array.from(document.querySelectorAll("main li")).find(l=>l.innerText.includes('+JSON.stringify(other.display_name)+')).innerText.includes("Absent")'),true)
  await navigate(href(other.id),'Absent · Score: —');await delay(800);await click('Begin assessment')
  await until(()=>evaluate('document.body.innerText.includes("In progress")'),'absence resumed')
  for(const path of [href(id('foreign-learner')),href().replace(a.id,id('foreign-assessment')),href().replace(a.offering_id,id('foreign-offering'))]) await navigate(path,'Teaching workspace unavailable')
  await navigate(href().replace(school,id('foreign-school')),'School context unavailable')
  // Actual competing SERIALIZABLE service sessions; retained synthetic assessment only.
  const raceDraft=await definitions.save(school,{...input,title:'Synthetic concurrent learner assessment '+Date.now(),levels:[]}),race=await definitions.open(school,raceDraft.id,Number(raceDraft.row_version))
  const full={observations:race.tasks.flatMap(t=>t.criteria.map(c=>({criterion_id:c.id,indicator_id:c.indicators[0].id}))),feedback:null,evidence:[]},partial={...full,observations:full.observations.slice(0,1)}
  const pair=await Promise.allSettled([results.mutate(school,race.id,roster[0].id,'save',0,partial),results.mutate(school,race.id,roster[0].id,'save',0,full)])
  assert.equal(pair.filter(r=>r.status==='fulfilled').length,1);assert.equal(pair.find(r=>r.status==='rejected').reason.code,'CONFLICT')
  const before=await results.get(school,race.id,roster[0].id)
  await results.mutate(school,race.id,roster[0].id,'complete',Number(before.participation.row_version),full)
  await assert.rejects(results.mutate(school,race.id,roster[0].id,'save',Number(before.participation.row_version),partial),/CONFLICT/)
  const absenceRace=await Promise.allSettled([results.mutate(school,race.id,roster[1].id,'absent',0),results.mutate(school,race.id,roster[1].id,'save',0,partial)])
  assert.equal(absenceRace.filter(r=>r.status==='fulfilled').length,1);assert.equal(absenceRace.find(r=>r.status==='rejected').reason.code,'CONFLICT')
  await writeFile(join(evidence,'retained-fixture.json'),JSON.stringify({assessment:a.id,concurrency_assessment:race.id,learner:learner.id,other:other.id,asset:asset?.id??null},null,2))
  console.log('Learner assessment browser PASS: teacher workspace, derived roster, partial keyboard save, persistence, incomplete completion, evidence selection, exact completed result, read-only controls, deterministic next, absence/resume, forged URLs, 390px layout and real concurrent writes. Synthetic result/audit records retained; no R2 writes.')

  }
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
  await resultPool.end()
  if (cookie) await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' }).catch(() => {})
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  chrome.kill()
  const target = resolve(profile), root = resolve(tmpdir()) + sep
  if (target.startsWith(root) && target.slice(root.length).startsWith('schoolhub-learner-browser-')) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {})
}
