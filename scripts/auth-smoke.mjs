import assert from 'node:assert/strict'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const cookieJar = new Map()
async function request(path,body,origin=base) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'manual',
    headers: { 'Content-Type':'application/json', Origin:origin, Cookie:[...cookieJar].map(([k,v])=>`${k}=${v}`).join('; ') },
    ...(body ? { body:JSON.stringify(body) } : {}),
  })
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';'); const split = pair.indexOf('=')
    cookieJar.set(pair.slice(0,split),pair.slice(split+1))
  }
  return response
}
try {
  assert.ok(process.env.DEV_SEED_PASSWORD,'Seed password required')
  assert.equal((await request('/academics')).status,307)
  const badOrigin = await request('/api/auth/sign-in/email',{email:'teacher@schoolhub.test',password:process.env.DEV_SEED_PASSWORD},'https://untrusted.invalid')
  assert.equal(badOrigin.status,403)
  assert.equal(badOrigin.headers.get('Access-Control-Allow-Origin'),null)
  const badPassword = await request('/api/auth/sign-in/email',{email:'teacher@schoolhub.test',password:'not-the-seeded-password'})
  assert.equal(badPassword.status,401)
  const login = await request('/api/auth/sign-in/email',{email:'teacher@schoolhub.test',password:process.env.DEV_SEED_PASSWORD})
  assert.equal(login.status,200)
  const session = await request('/api/auth/get-session')
  assert.equal(session.status,200)
  assert.equal((await session.json()).user.email,'teacher@schoolhub.test')
  const page = await request('/academics')
  assert.equal(page.status,200)
  assert.match(await page.text(),/Grade 10 East/)
  const media = await request('/media-files/file/unknown')
  assert.equal(media.status,410)
  assert.equal(media.headers.get('Cache-Control'),'no-store')
  const logout = await request('/api/auth/sign-out',{})
  assert.equal(logout.status,200)
  assert.equal(await (await request('/api/auth/get-session')).json(),null)
  cookieJar.set('better-auth.session_token','invalid')
  assert.equal(await (await request('/api/auth/get-session')).json(),null)
  console.log('Auth smoke PASS: unauthenticated redirect, rejected origin/password, login, session, academic page, disabled media route, logout and invalid session')
} catch (error) {
  console.error({ error:error.name, message:error.message })
  process.exitCode = 1
} finally {
  // Cleanup even when an assertion fails after login; never print session tokens.
  await request('/api/auth/sign-out',{}).catch(()=>{})
}
