import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { developmentPool, foundationTables, authTables, mediaTables, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { fileService } from '../lib/domain/files.ts'

// This opt-in check retains a real object, metadata and audit events.
if (process.argv[2] !== '--retain-test-evidence') throw new Error('Requires --retain-test-evidence')
const pool = developmentPool()
try {
  for (const name of ['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME']) assert.ok(process.env[name], `${name} is required`)
  const tables = async () => (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename)
  const expected = [...foundationTables,...authTables,...mediaTables].sort()
  assert.deepEqual(await tables(),expected)
  assert.equal((await pool.query('SELECT code FROM schools WHERE id=$1',[school])).rows[0]?.code,'DEV-SCHOOL')
  const learnerId=id('learner-1')
  assert.equal((await pool.query('SELECT display_name FROM learners WHERE school_id=$1 AND id=$2',[school,learnerId])).rows[0]?.display_name,'Sample Learner 1')
  const { uploadToR2, getR2ObjectBytes } = await import('../lib/r2.ts')
  let user=id('user-admin')
  const service=fileService(pool,async()=>user,{upload:uploadToR2,read:getR2ObjectBytes})
  assert.ok((await service.listLearners(school)).learners.some(l=>l.id===learnerId))
  console.log('PASS existing DEV-SCHOOL / Sample Learner 1 / Development Admin; 27 live public tables')
  const bytes=Buffer.from('%PDF-1.4\n% SchoolHub synthetic integration evidence; no personal data\n%%EOF\n')
  const form=new FormData()
  form.set('file',new File([bytes],'schoolhub-live-check.pdf',{type:'application/pdf'}))
  form.set('title','Live R2 integration verification')
  form.set('description','Synthetic retained integration evidence')
  form.set('category','work')
  const asset=await service.upload(school,{learnerId},form)
  console.log(`PASS real service R2 upload; retained asset ID: ${asset.id}`)
  const row=(await pool.query('SELECT * FROM media_assets WHERE id=$1',[asset.id])).rows[0]
  assert.equal(row.state,'ready'); assert.equal(row.school_id,school); assert.equal(row.learner_id,learnerId)
  assert.equal(row.original_name,'schoolhub-live-check.pdf'); assert.equal(row.title,'Live R2 integration verification')
  assert.equal(row.description,'Synthetic retained integration evidence'); assert.equal(row.category,'work')
  assert.equal(row.mime_type,'application/pdf'); assert.equal(row.size,bytes.length)
  assert.equal(row.uploaded_by_actor_id,id('actor-admin')); assert.ok(row.uploaded_at)
  assert.equal(row.object_key,`schools/${school}/assets/${asset.id}.pdf`)
  console.log('PASS committed metadata and key pattern schools/<school-uuid>/assets/<asset-uuid>.pdf')
  const listed=(await service.list(school,{learnerId})).find(f=>f.id===asset.id)
  assert.equal(listed.uploader,'Development Admin'); assert.ok(!('object_key' in listed))
  const downloaded=await service.download(school,asset.id)
  assert.deepEqual(Buffer.from(downloaded.bytes),bytes); assert.equal(downloaded.mimeType,'application/pdf')
  console.log(`PASS real admin R2 download: ${bytes.length} bytes; SHA-256 ${createHash('sha256').update(downloaded.bytes).digest('hex')}`)
  user=id('user-teacher'); assert.deepEqual(Buffer.from((await service.download(school,asset.id)).bytes),bytes)
  console.log('PASS assigned teacher live download')
  user=id('user-moderator'); await assert.rejects(service.download(school,asset.id),/FORBIDDEN/)
  user=null; await assert.rejects(service.download(school,asset.id),/UNAUTHORIZED/)
  console.log('PASS moderator and anonymous live downloads rejected')
  assert.deepEqual((await pool.query('SELECT event_type FROM audit_events WHERE resource_id=$1 ORDER BY event_type',[asset.id])).rows.map(r=>r.event_type),['media.upload_completed','media.upload_reserved'])
  assert.deepEqual(await tables(),expected)
  console.log('PASS two committed upload audit events; exact 27-table public set unchanged')
  console.log('Live portfolio/media integration PASS; object and metadata retained; no seed, reset, migration or object deletion')
} catch(error) { safeFailure(error) } finally { await pool.end() }
