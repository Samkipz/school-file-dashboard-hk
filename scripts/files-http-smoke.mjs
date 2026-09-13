import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { developmentPool, safeFailure } from './db-common.mjs'
import { devSchoolId as school } from './dev-fixtures.mjs'
const pool=developmentPool(),base=process.env.SMOKE_BASE_URL??'http://localhost:3000',cookies=new Map()
async function request(path,body) {
  const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',redirect:'manual',headers:{'Content-Type':'application/json',Origin:base,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},...(body?{body:JSON.stringify(body)}:{})})
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1))}
  return response
}
try {
  assert.ok(process.env.DEV_SEED_PASSWORD)
  const asset=(await pool.query("SELECT id FROM media_assets WHERE school_id=$1 AND title='Live R2 integration verification' AND state='ready' AND archived_at IS NULL ORDER BY uploaded_at DESC LIMIT 1",[school])).rows[0]
  assert.ok(asset,'Run live integration first')
  const path=`/media-files/file/${asset.id}?school=${school}`
  assert.equal((await request('/portfolios')).status,307)
  assert.equal((await request(path)).status,401)
  console.log('PASS anonymous portfolio redirect and file HTTP 401')
  for(const role of ['admin','teacher','moderator']) {
    assert.equal((await request('/api/auth/sign-in/email',{email:`${role}@schoolhub.test`,password:process.env.DEV_SEED_PASSWORD})).status,200)
    const page=await request('/portfolios'); assert.equal(page.status,200)
    const html=await page.text(); assert.equal(html.includes('Sample Learner 1'),role!=='moderator')
    const media=await request('/media-files'); assert.equal(media.status,200)
    assert.equal((await media.text()).includes('This school context is unavailable for your role.'),role!=='admin')
    const download=await request(path); assert.equal(download.status,role==='moderator'?403:200)
    if(role!=='moderator') {
      assert.equal(download.headers.get('cache-control'),'private, no-store')
      assert.equal(download.headers.get('x-content-type-options'),'nosniff')
      assert.ok(download.headers.get('content-disposition').startsWith('attachment;'))
      assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),'511bc7366993fc4914f11863d3756f234299b98d08ec8fec1a0a8696e0f902a4')
      assert.equal((await request(`/media-files/file/${asset.id}?school=invalid`)).status,400)
    }
    console.log(`PASS ${role}: session sign-in, portfolio/media render, file status ${download.status}${role!=='moderator'?', exact R2 bytes, private headers and invalid-school rejection':''}`)
    assert.equal((await request('/api/auth/sign-out',{})).status,200);cookies.clear()
  }
  console.log('Portfolio/media HTTP smoke PASS; production build; real session authentication and R2 download route')
} catch(error) { safeFailure(error) } finally {await request('/api/auth/sign-out',{}).catch(()=>{});await pool.end()}
