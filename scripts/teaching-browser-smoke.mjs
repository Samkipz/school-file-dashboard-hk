import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { config } from 'dotenv'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
config({ path: '.env.local', quiet: true })
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local verification server')
const profile = await mkdtemp(join(tmpdir(), 'schoolhub-teaching-browser-'))
const evidence = process.env.SMOKE_EVIDENCE_DIR ?? '.github/verification/structured-assessments/teaching-shell'
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
const mainLinks = () => evaluate("Array.from(document.querySelectorAll('nav[aria-label=\"Main navigation\"] a')).map(a=>a.textContent.trim())")
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/', 'Open My Teaching')
  assert.deepEqual(await mainLinks(), ['Home', 'My Teaching', 'Private Files'])
  assert.equal(await evaluate("['Current academic year','Current term','2026-DEMO','Grade 10 East'].every(t=>document.body.innerText.includes(t))"), true)
  assert.equal(await evaluate("document.body.innerText.includes('assessments pending') || document.body.innerText.includes('File Repository')"), false)
  await screenshot('teacher-home-desktop.png')
  console.log('PASS teacher Home and role navigation')
  await evaluate("Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='Open My Teaching').click()")
  await until(() => evaluate("location.pathname==='/academics' && document.querySelector('h1')?.textContent==='My Teaching'"), 'My Teaching navigation')
  assert.equal(await evaluate("new URLSearchParams(location.search).get('school')"), school)
  const offeringIds = await evaluate("Array.from(document.querySelectorAll('main a')).map(a=>new URL(a.href).searchParams.get('offering')).filter(Boolean)")
  assert.deepEqual([...offeringIds].sort(), ['math', 'english', 'biology'].map(s => id(`offering-${s}`)).sort())
  console.log('PASS My Teaching assigned offerings')
  await evaluate(`Array.from(document.querySelectorAll('main a')).find(a=>new URL(a.href).searchParams.get('offering')===${JSON.stringify(id('offering-math'))}).click()`)
  await until(() => evaluate("document.querySelector('h1')?.textContent==='Mathematics' && document.body.innerText.includes('Subject overview')"), 'subject overview')
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('nav[aria-label=\"Subject workspace\"] a')).map(a=>a.textContent)"), ['Overview', 'Learners', 'Assessments'])
  await evaluate("Array.from(document.querySelectorAll('nav[aria-label=\"Subject workspace\"] a')).find(a=>a.textContent==='Learners').click()")
  await until(() => evaluate("!!document.querySelector('#roster-title') && document.querySelectorAll('main section li').length===4"), 'authorized roster')
  const roster = await evaluate("Array.from(document.querySelectorAll('main section li')).map(li=>li.textContent)")
  assert.deepEqual(roster, [1, 2, 3, 4].map(n => `Sample Learner ${n}`), 'initial authorized roster')
  console.log('PASS offering Overview and Learners')
  const rosterUrl = await evaluate('location.href')
  assert.equal(new URL(rosterUrl).searchParams.get('school'), school)
  assert.equal(new URL(rosterUrl).searchParams.get('offering'), id('offering-math'))
  assert.equal(new URL(rosterUrl).searchParams.get('view'), 'learners')
  await evaluate("if(document.documentElement) document.documentElement.dataset.verificationNavigation='pending'")
  await send('Page.reload')
  await until(() => evaluate("document.documentElement && !document.documentElement.dataset.verificationNavigation && !!document.querySelector('#roster-title') && document.readyState==='complete' && document.querySelectorAll('main section li').length===4"), 'roster refresh')
  assert.equal(await evaluate('location.href'), rosterUrl)
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('main section li')).map(li=>li.textContent)"), roster)
  console.log('PASS refreshed roster context')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'mobile roster overflow')
  await screenshot('teacher-learners-mobile.png')
  await until(async () => {
    await evaluate("document.querySelector('button[aria-label=\"Open navigation\"]').click()")
    return evaluate("document.querySelector('button[aria-label=\"Open navigation\"]').getAttribute('aria-expanded')==='true'")
  }, 'hydrated mobile menu')
  await until(() => evaluate("document.activeElement?.getAttribute('aria-label')==='Close navigation'"), 'mobile focus entry')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 })
  assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Log out', 'focus wraps inside mobile navigation')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
  await until(() => evaluate("document.querySelector('button[aria-label=\"Open navigation\"]').getAttribute('aria-expanded')==='false'"), 'Escape closes menu')
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), 'Open navigation')
  assert.equal(await evaluate("document.querySelector('#school-navigation').getBoundingClientRect().width"), 0, 'closed mobile sidebar is hidden from keyboard navigation')
  for (const offering of ['invalid', id('unknown-offering'), id('offering-school-2')]) {
    await navigate(`/academics?school=${school}&offering=${offering}&view=learners`, 'Teaching workspace unavailable')
    assert.equal(await evaluate("document.body.innerText.includes('Sample Learner')"), false)
  }
  await navigate(`/academics?school=${id('test-school-2')}&offering=${id('offering-math')}`, 'School context unavailable')
  assert.equal(await evaluate("document.body.innerText.includes('Sample Learner')"), false)
  await navigate(`/admin/assessments?school=${school}`, 'School administrator access is required')
  assert.equal(await evaluate("document.body.innerText.includes('Create draft')"), false)
  await navigate(`/files?school=${school}`, 'Browse learner files')
  assert.equal(await evaluate("document.body.innerText.includes('Browse school media')"), false)
  await navigate(`/portfolios?school=${school}`, 'Learner Portfolios')
  assert.equal(await evaluate("document.body.innerText.includes('read-only')"), true)
  console.log('Teaching browser PASS: role navigation, real offerings, context links, subject tabs, correct roster, refresh, 390px layout, mobile focus/Tab/Escape, forged contexts denied, admin drafts denied, private files retained. No academic or storage mutations.')
} catch (error) { console.error({ error: error.name, message: error.message }); process.exitCode = 1 }
finally {
  if (cookie) await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' }).catch(() => {})
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  chrome.kill()
  const target = resolve(profile), root = resolve(tmpdir()) + sep
  if (target.startsWith(root) && target.slice(root.length).startsWith('schoolhub-teaching-browser-')) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {})
}
