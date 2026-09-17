import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { developmentPool, safeFailure } from './db-common.mjs'
import { devSchoolId as school } from './dev-fixtures.mjs'

// This opt-in integration check commits synthetic uploads and archives their metadata.
// R2 objects, metadata and audit history are retained, including on partial failure.
if (!process.argv.includes('--retain-test-evidence')) throw new Error('Pass --retain-test-evidence to acknowledge retained synthetic objects and audit history')
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const origin = new URL(base)
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Browser smoke requires a local HTTP origin')
const pool = developmentPool()
const run = `Browser acceptance ${randomUUID()}`
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=', 'base64')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const evidence = resolve('.github/verification/portfolio-browser')
let profile, chrome, socket, cookie = '', sequence = 0, downloadGuid
const pending = new Map()
const delay = ms => new Promise(r => setTimeout(r, ms))
async function until(check, label) {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) { if (await check()) return; await delay(150) }
  throw new Error(`Timed out: ${label}`)
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 45000)
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result) }, reject: error => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error('Browser evaluation failed')
  return response.result.value
}
async function click(label) {
  assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled);if(!b)return false;b.click();return true})()`), true, `Enabled button: ${label}`)
}
async function fill(selector, value) {
  await evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(i.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
async function visible(text) { return evaluate(`document.body?.innerText.includes(${JSON.stringify(text)}) ?? false`) }
async function navigate(path, text) {
  await send('Page.navigate', { url: `${base}${path}` })
  await until(() => visible(text), text)
}
async function login(role) {
  if (cookie) {
    assert.equal((await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' })).status, 200)
    cookie = ''
  }
  await send('Network.clearBrowserCookies')
  const response = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: `${role}@schoolhub.test`, password: process.env.DEV_SEED_PASSWORD }) })
  assert.equal(response.status, 200, `${role} login`)
  const pairs = response.headers.getSetCookie().map(c => c.split(';')[0])
  cookie = pairs.join('; ')
  for (const pair of pairs) { const i = pair.indexOf('='); await send('Network.setCookie', { name: pair.slice(0, i), value: pair.slice(i + 1), url: base }) }
}
async function learner() {
  await navigate(`/portfolios?school=${school}`, 'Sample Learner 1')
  await until(async () => {
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.querySelector('p')?.textContent==='Sample Learner 1')?.click()")
    return visible("Sample Learner 1's Portfolio")
  }, 'hydrated learner selection')
}
async function upload(title, button) {
  await click(button)
  await until(() => evaluate("!!document.querySelector('[role=dialog] input[type=file]')"), 'upload dialog')
  await evaluate(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(png.toString('base64'))}),c=>c.charCodeAt(0));const d=new DataTransfer();d.items.add(new File([bytes],'browser-check.png',{type:'image/png'}));const i=document.querySelector('input[type=file]');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await fill('#upload-title', title)
  await fill('#upload-description', 'Synthetic browser acceptance evidence')
  await fill('#upload-category', 'photo')
  await click('Upload')
  await until(async () => !(await evaluate("!!document.querySelector('[role=dialog]')")) && await visible(title), 'real upload and refreshed list')
  const result = (await pool.query('SELECT id,state FROM media_assets WHERE school_id=$1 AND title=$2', [school, title])).rows
  assert.equal(result.length, 1, 'one committed asset in pinned database')
  assert.equal(result[0].state, 'ready')
  return result[0].id
}
async function fileButton(id, label) {
  assert.equal(await evaluate(`(()=>{const link=document.querySelector('a[href^="/media-files/file/${id}?"]');const card=link?.parentElement.parentElement;const button=[...(card?.querySelectorAll('button')??[])].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled);if(!button)return false;button.click();return true})()`), true, `File control: ${label}`)
}
async function download(id) {
  downloadGuid = undefined
  await evaluate(`document.querySelector('a[href^="/media-files/file/${id}?"]').click()`)
  let bytes
  await until(async () => { if (!downloadGuid) return false; try { bytes = await readFile(join(profile, downloadGuid)); return true } catch { return false } }, 'browser Download link and saved bytes')
  assert.equal(digest(bytes), digest(png), 'downloaded R2 bytes match upload')
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(evidence, name), Buffer.from(data, 'base64'))
}
async function mobile() {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await delay(200)
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, '390px layout does not overflow')
  await screenshot('mobile.png')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
}
try {
  assert.ok(process.env.DEV_SEED_PASSWORD, 'Development login must be configured')
  assert.equal((await pool.query('SELECT id FROM schools WHERE id=$1', [school])).rowCount, 1)
  await mkdir(evidence, { recursive: true })
  profile = await mkdtemp(join(tmpdir(), 'schoolhub-files-browser-'))
  chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let launchError
  chrome.on('error', () => { launchError = new Error('Unable to launch Chrome; check CHROME_PATH') })
  let port
  await until(async () => { if (launchError) throw launchError; try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return !!port } catch { return false } }, 'Chrome startup')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const result = JSON.parse(event.data)
    if (result.id) { const item = pending.get(result.id); pending.delete(result.id); if (item) { if (result.error) item.reject(new Error(result.error.message)); else item.resolve(result.result) } }
    if (result.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
    if (result.method === 'Page.downloadWillBegin') downloadGuid = result.params.guid
  }
  socket.onclose = () => { for (const item of pending.values()) item.reject(new Error('Browser connection closed')); pending.clear() }
  await send('Page.enable')
  await send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: profile })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await login('admin')
  await learner()
  const portfolio = await upload(`${run} portfolio`, 'Upload File')
  await download(portfolio)
  await fileButton(portfolio, 'Edit details')
  await until(() => evaluate("!!document.querySelector('input[name=title]')"), 'metadata editor')
  await fill('input[name=title]', `${run} edited`)
  await fill('input[name=description]', 'Metadata edited through the browser')
  await click('Save details')
  await until(() => visible(`${run} edited`), 'edited title')
  assert.equal((await pool.query('SELECT description FROM media_assets WHERE id=$1', [portfolio])).rows[0].description, 'Metadata edited through the browser')
  await screenshot('portfolio.png')
  await mobile()
  console.log('PASS admin portfolio: learner selection, real upload, Download click and SHA-256, metadata edit, mobile layout')

  await login('teacher')
  await learner()
  await until(() => visible(`${run} edited`), 'teacher sees assigned learner file')
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>['Upload File','Edit details','Archive'].includes(b.textContent.trim()))"), false, 'teacher has no mutation controls')
  await download(portfolio)
  await navigate(`/media-files?school=${school}`, 'This school context is unavailable for your role.')
  console.log('PASS teacher: assigned portfolio read-only UI, real Download click, general media denied')
  await login('moderator')
  await navigate(`/portfolios?school=${school}`, 'This school context is unavailable for your role.')
  assert.equal(await visible('Sample Learner 1'), false)
  console.log('PASS moderator: portfolio denied without learner disclosure')

  await login('admin')
  await navigate(`/media-files?school=${school}`, 'School media folders')
  await until(async () => { await click('New folder'); return evaluate("!!document.querySelector('input[name=name]')") }, 'hydrated new folder form')
  await fill('input[name=name]', run)
  await fill('input[name=description]', 'Synthetic browser folder')
  await click('Save folder')
  await until(() => visible(run), 'folder created')
  const folder = (await pool.query('SELECT id FROM media_folders WHERE school_id=$1 AND name=$2', [school, run])).rows[0]
  assert.ok(folder)
  const folderButton = async label => evaluate(`(()=>{const open=[...document.querySelectorAll('button')].find(b=>b.querySelector('p')?.textContent===${JSON.stringify(run)});const button=${label === 'open' ? 'open' : `[...open.parentElement.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`};button.click()})()`)
  await folderButton('Edit folder')
  await until(() => evaluate("!!document.querySelector('input[name=name]')"), 'folder editor')
  await fill('input[name=description]', 'Folder description edited through browser')
  await click('Save folder')
  await until(() => visible('Folder description edited through browser'), 'folder saved')
  await folderButton('open')
  await until(() => visible('Upload media'), 'folder opened')
  const media = await upload(`${run} media`, 'Upload media')
  await download(media)
  await mobile()
  await screenshot('media.png')
  await click('Back')
  await until(() => visible('School media folders'), 'folder list')
  await folderButton('Archive')
  await until(() => visible('Archive the files first.'), 'nonempty folder archive rejected')
  assert.equal((await pool.query('SELECT archived_at FROM media_folders WHERE id=$1', [folder.id])).rows[0].archived_at, null)
  await folderButton('open')
  await until(() => visible(`${run} media`), 'media card')
  await fileButton(media, 'Archive')
  await until(async () => !(await visible(`${run} media`)), 'media archive and list refresh')
  await click('Back')
  await until(() => visible('School media folders'), 'folder list after archive')
  await folderButton('Archive')
  await until(async () => !(await visible(run)), 'empty folder archived')
  await learner()
  await fileButton(portfolio, 'Archive')
  await until(async () => !(await visible(`${run} edited`)), 'portfolio archived')
  for (const id of [portfolio, media]) {
    assert.ok((await pool.query('SELECT archived_at FROM media_assets WHERE school_id=$1 AND id=$2', [school, id])).rows[0].archived_at)
    assert.equal((await fetch(`${base}/media-files/file/${id}?school=${school}`, { headers: { Cookie: cookie } })).status, 404, 'archived bytes unavailable')
  }
  assert.ok((await pool.query('SELECT archived_at FROM media_folders WHERE id=$1', [folder.id])).rows[0].archived_at)
  console.log('PASS media: folder create/edit, real upload/download, mobile layout, nonempty archive rejected, synthetic assets/folder archived, archived downloads HTTP 404')
  console.log(`Portfolio/media browser smoke PASS: ${run}; two synthetic objects retained with archived metadata; no existing assets changed`)
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) {
    await screenshot('failure.png').catch(() => {})
    const alerts = await evaluate("[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)").catch(() => [])
    console.log({ browserAlerts: alerts })
  }
  console.log(`Incomplete browser run: ${run}; any created assets are retained for inspection`)
  safeFailure(error)
}
finally {
  if (cookie) await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' }).catch(() => {})
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  chrome?.kill()
  await pool.end()
  if (profile) {
    const target = resolve(profile), root = resolve(tmpdir()) + sep
    if (target.startsWith(root) && target.slice(root.length).startsWith('schoolhub-files-browser-')) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {})
  }
}
