import assert from 'node:assert/strict'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const cookies = new Map()
async function request(path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, ...(body ? { body: JSON.stringify(body) } : {}) })
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const split = pair.indexOf('='); cookies.set(pair.slice(0, split), pair.slice(split + 1)) }
  return response
}
try {
  assert.ok(process.env.DEV_SEED_PASSWORD)
  assert.equal((await request('/admin/academics')).status, 307)
  for (const role of ['admin', 'teacher', 'moderator']) {
    assert.equal((await request('/api/auth/sign-in/email', { email: `${role}@schoolhub.test`, password: process.env.DEV_SEED_PASSWORD })).status, 200)
    const response = await request('/admin/academics')
    assert.equal(response.status, 200)
    const html = await response.text()
    if (role === 'admin') {
      for (const text of ['Learners', 'Classes', 'Academic Years', 'Subjects', 'Teacher Assignments', 'Academic Year Rollover', 'Learner status', 'Sample Learner 1', 'Add learner']) assert.ok(html.includes(text), text)
      assert.ok((await (await request('/admin/academics?school=invalid')).text()).includes('No available school'))
    } else {
      assert.ok(html.includes('School administrator access is required'))
      assert.ok(!html.includes('Sample Learner 1'))
      assert.ok(!html.includes('Add learner'))
    }
    assert.equal((await request('/api/auth/sign-out', {})).status, 200)
  }
  console.log('Administration HTTP smoke PASS: anonymous redirect, admin page render, invalid school handling, teacher/moderator denial without learner disclosure')
} catch (error) { console.error({ error: error.name, message: error.message }); process.exitCode = 1 }
finally { await request('/api/auth/sign-out', {}).catch(() => {}) }
