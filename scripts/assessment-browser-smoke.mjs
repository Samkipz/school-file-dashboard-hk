import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { assessmentService } from '../lib/domain/assessments.ts'

if (!process.argv.includes('--retain-test-evidence')) throw new Error('This browser test retains one synthetic draft and its audit history; pass --retain-test-evidence')
const pool=developmentPool(), service=assessmentService(pool,async()=>id('user-admin'))
const base=process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const profile=await mkdtemp(join(tmpdir(),'schoolhub-assessment-browser-'))
const chrome=spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'})
let socket, sequence=0, cookie='', draftId
const pending=new Map(), runId=randomUUID(), title=`Browser draft ${runId}`
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(check,label) { const deadline=Date.now()+40000;while(Date.now()<deadline){if(await check())return;await delay(150)}throw new Error(`Timed out: ${label}`) }
function send(method,params={}) { return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))}) }
async function evaluate(expression) {const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Browser evaluation failed: '+result.exceptionDetails.text);return result.result.value}
async function click(label) {
  await until(()=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)});return !!b && !b.disabled && Object.keys(b).some(k=>k.startsWith('__reactProps'))})()`),`hydrated ${label} button`)
  return evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`)
}
async function set(label,value,kind='input') {
  const selector=`${kind}[aria-label="${label}"]`
  await until(()=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e && Object.keys(e).some(k=>k.startsWith('__reactProps'))})()`),`hydrated ${label} input`)
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${kind==='select'?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('${kind==='select'?'change':'input'}',{bubbles:true}));})()`)
  const task=label.match(/^Task (\d+) (.+)$/)
  const key={'Assessment title':'title','Assessment start date':'starts_on','Assessment due date':'due_on','Subject offering':'offering_id','Term':'term_id','Assessment type':'assessment_type_id'}[label]
  const taskKey=task && {title:'title','start date':'starts_on','due date':'due_on'}[task[2]]
  await until(()=>evaluate(`(()=>{const p=JSON.parse(document.querySelector('form[aria-label="Assessment draft"] input[name="payload"]').value);return ${task ? `p.tasks[${Number(task[1])-1}][${JSON.stringify(taskKey)}]` : `p[${JSON.stringify(key)}]`}===${JSON.stringify(value)}})()`),`submitted ${label} state`)
}
async function signout() {if(cookie)await fetch(`${base}/api/auth/sign-out`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:'{}'});cookie='';await send('Network.clearBrowserCookies')}
async function login(who) {
  await signout()
  const response=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:`${who}@schoolhub.test`,password:process.env.DEV_SEED_PASSWORD})})
  assert.equal(response.status,200)
  const pairs=response.headers.getSetCookie().map(c=>c.split(';')[0]);cookie=pairs.join('; ')
  for(const pair of pairs){const i=pair.indexOf('=');await send('Network.setCookie',{name:pair.slice(0,i),value:pair.slice(i+1),url:base})}
}
async function navigate(path) {
  const navigation=await send('Page.navigate',{url:base+path})
  await until(async()=>{
    const frame=(await send('Page.getFrameTree')).frameTree.frame
    return (!navigation.loaderId || frame.loaderId===navigation.loaderId) && await evaluate("!!document.body && document.readyState==='complete'")
  },'loaded navigation')
}
const text=()=>evaluate("document.body?.innerText ?? ''")
try {
  let port
  await until(async()=>{try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);return !!port}catch{return false}},'Chrome startup')
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=event=>{const result=JSON.parse(event.data);if(result.id){const item=pending.get(result.id);pending.delete(result.id);if(result.error)item.reject(new Error(result.error.message));else item.resolve(result.result)}}
  await login('admin')
  await navigate(`/admin/assessments?school=${school}`)
  await until(async()=>(await text()).includes('Create draft'),'admin planner')
  await evaluate("document.querySelector('details').open=true")
  await click('Add standard planning types')
  await until(async()=>{const types=(await service.read(school)).types;return types.some(t=>t.code==='PROJECT')},'type initialization through action')
  await navigate(`/admin/assessments?school=${school}`)
  await until(()=>evaluate("document.querySelector('select[aria-label=\"Assessment type\"]')?.options.length>1"),'types displayed')
  await until(async()=>{await click('Add task');return evaluate("!!document.querySelector('input[aria-label=\"Task 1 title\"]')")},'hydration')
  // Hydration retry can add more than one task; retain exactly one before adding the second.
  await evaluate("(()=>{const b=Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='Remove task');for(const e of b.slice(1))e.click()})()")
  await set('Assessment title',title)
  await set('Subject offering',id('offering-math'),'select')
  await set('Term',id('term-1'),'select')
  const type=(await service.read(school)).types.find(t=>t.code==='PROJECT').id
  await set('Assessment type',type,'select')
  await set('Assessment start date','2026-01-01');await set('Assessment due date','2026-12-31')
  await set('Task 1 title','Browser first task');await set('Task 1 due date','2026-09-01')
  await click('Add task');await set('Task 2 title','Browser second task')
  await click('Save draft')
  await until(async()=>{draftId=(await service.read(school)).drafts.find(d=>d.title===title)?.id;return !!draftId},'committed browser create')
  await until(()=>evaluate("location.search.includes('draft=')"),'detail navigation')
  await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
  await until(()=>evaluate(`document.querySelector('input[aria-label="Assessment title"]')?.value===${JSON.stringify(title)}`),'persisted reload')
  assert.equal(await evaluate("document.querySelector('input[aria-label=\"Task 1 due date\"]').value"),'2026-09-01')
  const original=await service.get(school,draftId)
  const originalIds=original.tasks.map(t=>t.id)
  await set('Assessment title',title+' edited')
  await set('Task 1 title','Browser first task edited')
  await click('Move down');await click('Save draft')
  await until(async()=>{const d=await service.get(school,draftId);return d.title===title+' edited'&&d.tasks[0].title==='Browser second task'},'browser edit and reorder')
  await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
  await until(()=>evaluate(`document.querySelector('input[aria-label="Assessment title"]')?.value===${JSON.stringify(title+' edited')}`),'edit reload')
  const reordered=await service.get(school,draftId)
  assert.deepEqual(reordered.tasks.map(t=>t.id),[...originalIds].reverse())
  assert.equal(reordered.tasks[1].title,'Browser first task edited')
  await click('Add task'); await set('Task 3 title','Browser added task'); await click('Save draft')
  await until(async()=>(await service.get(school,draftId)).tasks.length===3,'browser task addition')
  const added=await service.get(school,draftId)
  assert.deepEqual(added.tasks.slice(0,2).map(t=>t.id),reordered.tasks.map(t=>t.id))
  assert.ok(!originalIds.includes(added.tasks[2].id))
  await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
  await click('Remove task'); await click('Save draft')
  await until(async()=>(await service.get(school,draftId)).tasks.length===2,'browser task removal')
  const removed=await service.get(school,draftId)
  assert.deepEqual(removed.tasks.map(t=>t.id),[originalIds[0],added.tasks[2].id])
  console.log(JSON.stringify({identity:{original:originalIds,reordered:reordered.tasks.map(t=>t.id),added:added.tasks.map(t=>t.id),removed:removed.tasks.map(t=>t.id)}}))
  await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
  const opened=await service.get(school,draftId)
  await service.save(school,{...opened,title:title+' newer'},draftId,Number(opened.row_version))
  await set('Assessment title',title+' stale');await click('Save draft')
  await until(async()=>(await text()).includes('Reload and review before retrying'),'real stale action conflict')
  assert.equal((await service.get(school,draftId)).title,title+' newer')
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true,'mobile document width')
  assert.equal(await evaluate("Array.from(document.querySelectorAll('input,select,textarea')).every(e=>e.getBoundingClientRect().right<=390)"),true,'mobile form controls fit')
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  await writeFile('.github/verification/assessment-hardening/mobile.png',Buffer.from(screenshot.data,'base64'))
  // Two actual SERIALIZABLE transactions compete over the same aggregate version.
  const current=await service.get(school,draftId)
  const race=await Promise.allSettled([service.save(school,{...current,title:title+' race A'},draftId,Number(current.row_version)),service.save(school,{...current,title:title+' race B'},draftId,Number(current.row_version))])
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.code==='CONFLICT').length,1)
  assert.deepEqual((await service.get(school,draftId)).tasks.map(t=>t.id),current.tasks.map(t=>t.id))
  console.log('PASS real concurrent transactions: one commit and one controlled conflict')
  for(const who of ['teacher','moderator']) {
    await login(who);await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
    await until(async()=>(await text()).includes('School administrator access is required'),'role denial')
    assert.equal((await text()).includes(title),false);assert.equal(await evaluate("!!document.querySelector('form[aria-label=\"Assessment draft\"]')"),false)
  }
  await login('admin');await navigate(`/admin/assessments?school=${randomUUID()}&draft=${draftId}`)
  await until(async()=>(await text()).includes('No available school'),'foreign school page')
  assert.equal((await text()).includes(title),false)
  await signout();await navigate(`/admin/assessments?school=${school}&draft=${draftId}`)
  await until(()=>evaluate("location.pathname==='/sign-in'"),'anonymous redirect')
  console.log(JSON.stringify({result:'PASS',runId,draftId,retained:'one synthetic draft, two tasks, initialized types if absent, and audit history; no R2 operations',coverage:'real create/reload/edit/reorder actions, cross-term dates, stale conflict, concurrent transactions, teacher/moderator/anonymous/foreign-school pages, 390px form'},null,2))
} catch(error) {safeFailure(error);console.log({runId,draftId,retained:'Any records created before failure are retained'})}
finally {
  if(socket?.readyState===WebSocket.OPEN){await signout().catch(()=>{});await send('Browser.close').catch(()=>{});socket.close()}
  chrome.kill();await pool.end()
  const target=resolve(profile),root=resolve(tmpdir())+sep
  if(target.startsWith(root)&&target.slice(root.length).startsWith('schoolhub-assessment-browser-'))await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{})
}
