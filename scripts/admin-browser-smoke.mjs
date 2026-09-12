import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const profile = await mkdtemp(join(tmpdir(), 'schoolhub-admin-browser-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, cookie = ''
const pending = new Map()
let sequence = 0
const delay = ms => new Promise(r => setTimeout(r, ms))
async function until(check, label) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await check()) return; await delay(100) } throw new Error(`Timed out: ${label}`) }
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) }) }
async function evaluate(expression) { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error('Browser evaluation failed'); return response.result.value }
const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`)
try {
  let port
  await until(async () => { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return !!port } catch { return false } }, 'Chrome startup')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => { const result = JSON.parse(event.data); if (result.id) { const item = pending.get(result.id); pending.delete(result.id); if (result.error) item.reject(new Error(result.error.message)); else item.resolve(result.result) } }
  socket.onclose = () => { for (const item of pending.values()) item.reject(new Error('Browser connection closed')); pending.clear() }
  const login = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'admin@schoolhub.test', password: process.env.DEV_SEED_PASSWORD }) })
  assert.equal(login.status, 200)
  const pairs = login.headers.getSetCookie().map(c => c.split(';')[0])
  cookie = pairs.join('; ')
  for (const pair of pairs) { const i = pair.indexOf('='); await send('Network.setCookie', { name: pair.slice(0, i), value: pair.slice(i + 1), url: base }) }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/admin/academics` })
  await until(() => evaluate("document.body.innerText.includes('Add learner')"), 'admin page')
  // Interaction waits also confirm React hydration, beyond server-rendered HTML.
  await until(async () => {
    await click('Classes')
    return evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Classes')?.getAttribute('aria-pressed')==='true'")
  }, 'React hydration and Classes selection')
  await until(() => evaluate("document.body.innerText.includes('Create class')"), 'Classes tab')
  await click('Academic Years & Terms')
  await until(() => evaluate("document.body.innerText.includes('Create academic year') && document.body.innerText.includes('Create term')"), 'Years and terms tab')
  await click('Subjects')
  await until(() => evaluate("document.body.innerText.includes('Enable school subject')"), 'Subjects tab')
  await click('Teacher Assignments')
  await until(() => evaluate("document.body.innerText.includes('School staff') && document.body.innerText.includes('Assign teacher')"), 'Assignments tab')
  await click('Learners')
  await click('Sample Learner 1')
  await until(() => evaluate("document.body.innerText.includes('Class placement history') && document.body.innerText.includes('DEV-2026-001')"), 'Learner detail and history')
  assert.equal(await evaluate("document.body.innerText.includes('Grade 10 East')"), true)
  assert.equal(await evaluate("['Withdraw learner','Complete / graduate learner','Lifecycle status history','Learner status:'].every(t=>document.body.innerText.includes(t))"), true)
  // A whitespace name passes browser required validation but must fail the real Server Action.
  await evaluate("(()=>{const i=document.querySelector('input[name=display_name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'   ');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));})()")
  await click('Add learner')
  await until(() => evaluate("!!document.querySelector('[role=alert]')"), 'server-side validation error')
  assert.equal(await evaluate("document.querySelector('input[name=display_name]').value"), '   ')
  await click('Academic Year Rollover')
  await until(() => evaluate("document.body.innerText.includes('Source academic year')"), 'Rollover controls')
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Preview 0')).disabled"), true)
  await evaluate(`(()=>{for(const label of ['Source academic year','Destination academic year']){const select=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith(label)).querySelector('select');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));}})()`)
  await until(() => evaluate("!!document.querySelector('select[aria-label=\"Outcome for Sample Learner 1\"]')"), 'Rollover candidate list')
  assert.equal(await evaluate("document.querySelector('select[aria-label=\"Outcome for Sample Learner 1\"]').value"), '', 'no automatic promotion')
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Outcome for Sample Learner 1"]');select.value='repeat';select.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(() => evaluate("!!document.querySelector('select[aria-label=\"Destination class for Sample Learner 1\"]')"), 'Destination placement control')
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Destination class for Sample Learner 1"]');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await click('Preview 1 selected learners')
  await until(() => evaluate("!!document.querySelector('[role=alert]')"), 'Server rejects same-year rollover preview')
  assert.equal(await evaluate("document.body.innerText.includes('Confirm and execute rollover')"), false)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'mobile layout should not overflow horizontally')
  console.log('Administration browser smoke PASS: all six tabs, lifecycle controls/history, explicit rollover selection, destination picker, invalid preview rejected without confirmation, real Server Action validation, mobile width')
} catch (error) { console.error({ error: error.name, message: error.message }); process.exitCode = 1 }
finally {
  if (cookie) await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' }).catch(() => {})
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  chrome.kill()
  // Remove only the fresh, task-owned temporary browser profile.
  const target = resolve(profile), root = resolve(tmpdir()) + sep
  if (target.startsWith(root) && target.slice(root.length).startsWith('schoolhub-admin-browser-')) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {})
}
