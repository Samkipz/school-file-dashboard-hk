import assert from 'node:assert/strict'
import { developmentPool,safeFailure } from './db-common.mjs'
import { fixtureId as id,devSchoolId as school } from './dev-fixtures.mjs'
import { fileService } from '../lib/domain/files.ts'
import { administrationService } from '../lib/domain/administration.ts'
import { foundationService } from '../lib/domain/foundation.ts'
const pool=developmentPool(),client=await pool.connect()
let user=id('user-admin'),passed=0,failStorage=false,failInsert=false,failFinalize=false
const objects=new Map()
const storage={upload:async(key,bytes,contentType)=>{if(failStorage)throw Error('storage failure');objects.set(key,{bytes,contentType})},read:async key=>{assert.ok(objects.has(key));return objects.get(key)}}
const adapter={connect:async()=>({query:async(sql,values)=>{
 if(sql==='BEGIN ISOLATION LEVEL SERIALIZABLE')return client.query('SAVEPOINT file_operation')
 if(sql==='COMMIT'){await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('SET CONSTRAINTS ALL DEFERRED');return client.query('RELEASE SAVEPOINT file_operation')}
 if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT file_operation')
 if(failInsert&&sql.startsWith('INSERT INTO media_assets'))throw Error('database failure')
 if(failFinalize&&sql.startsWith("UPDATE media_assets SET state='ready'"))throw Error('database failure')
 return client.query(sql,values)
},release(){}})}
const service=fileService(adapter,async()=>user,storage),admin=administrationService(adapter,async()=>user),foundation=foundationService(adapter,async()=>user)
const target={learnerId:id('learner-1')}
const form=(media=false)=>{const d=new FormData();d.set('file',new File([media?new Uint8Array([137,80,78,71,13,10,26,10]):'%PDF-1.7\nevidence'],media?'photo.png':'work.pdf',{type:media?'image/png':'application/pdf'}));d.set('title','Portfolio evidence');d.set('description','Test evidence');d.set('category','work');return d}
const test=async(label,fn)=>{await fn();passed++;console.log(`PASS ${label}`)}
const row=async assetId=>(await client.query('SELECT * FROM media_assets WHERE id=$1',[assetId])).rows[0]
try {
 await client.query('BEGIN')
 // Require live migration; only test fixture changes roll back.
 assert.ok((await client.query("SELECT to_regclass('public.media_assets') AS name")).rows[0].name, 'Apply portfolio/media migration first')
 let file,folder,media
 await test('admin lists authoritative learners',async()=>{assert.ok((await service.listLearners(school)).learners.some(l=>l.id===target.learnerId))})
 await test('admin upload stores authoritative learner, metadata, uploader and private object',async()=>{file=await service.upload(school,target,form());const f=await row(file.id);assert.equal(f.learner_id,target.learnerId);assert.equal(f.school_id,school);assert.equal(f.title,'Portfolio evidence');assert.equal(f.description,'Test evidence');assert.equal(f.category,'work');assert.equal(f.uploaded_by_actor_id,id('actor-admin'));assert.equal(f.state,'ready');assert.ok(objects.has(f.object_key));assert.ok(f.object_key.startsWith(`schools/${school}/assets/`));assert.equal(f.size,objects.get(f.object_key).bytes.length)})
 await test('metadata omits keys and exposes uploader name',async()=>{const f=(await service.list(school,target)).find(f=>f.id===file.id);assert.equal(f.uploader,'Development Admin');assert.ok(!('object_key'in f));assert.ok(f.uploaded_at)})
 await test('authorized download returns exact bytes',async()=>{assert.equal(Buffer.from((await service.download(school,file.id)).bytes).toString(),'%PDF-1.7\nevidence')})
 await test('media folder create, rename and upload',async()=>{folder=await service.saveFolder(school,'Integration media','Description');await service.saveFolder(school,'Renamed media','Changed',folder.id);assert.ok((await service.listFolders(school)).some(f=>f.id===folder.id&&f.name==='Renamed media'));media=await service.upload(school,{folderId:folder.id},form(true));assert.equal((await service.list(school,{folderId:folder.id}))[0].id,media.id)})
 await test('nonempty folder archive rejected',async()=>{await assert.rejects(service.archiveFolder(school,folder.id),/CONFLICT/)})
 await test('teacher learner scope equals union of actual academic rosters',async()=>{user=id('user-teacher');const expected=new Set();for(const o of (await foundation.getFoundation(school)).offerings)for(const l of await foundation.getOfferingRoster(school,o.id))expected.add(l.id);assert.deepEqual(new Set((await service.listLearners(school)).learners.map(l=>l.id)),expected);assert.ok((await service.list(school,target)).some(f=>f.id===file.id));await service.download(school,file.id)})
 await test('teacher cannot upload, edit, archive or access general media',async()=>{for(const op of [()=>service.upload(school,target,form()),()=>service.update(school,file.id,'x','','general'),()=>service.archive(school,file.id),()=>service.listFolders(school),()=>service.download(school,media.id)])await assert.rejects(op(),/FORBIDDEN/)})
 await test('teacher without assignments loses learner/file access',async()=>{await client.query('SAVEPOINT scope_change');await client.query("UPDATE teacher_assignments SET status='revoked' WHERE school_id=$1",[school]);assert.equal((await service.listLearners(school)).learners.length,0);await assert.rejects(service.list(school,target),/NOT_FOUND/);await assert.rejects(service.download(school,file.id),/NOT_FOUND/);await client.query('ROLLBACK TO SAVEPOINT scope_change')})
 await test('moderator has no portfolio or media administration',async()=>{user=id('user-moderator');for(const op of [()=>service.listLearners(school),()=>service.list(school,target),()=>service.download(school,file.id),()=>service.upload(school,target,form()),()=>service.listFolders(school)])await assert.rejects(op(),/FORBIDDEN/)})
 await test('anonymous requests rejected',async()=>{user=null;for(const op of [()=>service.listLearners(school),()=>service.upload(school,target,form()),()=>service.download(school,file.id)])await assert.rejects(op(),/UNAUTHORIZED/)})
 user=id('user-admin')
 const school2=id('file-school-2'),learner2=id('file-learner-2'),asset2=id('file-asset-2')
 await client.query(`INSERT INTO schools(id,code,name,created_by_actor_id,updated_by_actor_id) VALUES($1,'FILE-TEST','Other school',$2,$2)`,[school2,id('bootstrap')])
 await client.query(`INSERT INTO school_memberships(id,school_id,user_id,status,joined_at,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,'active','2026-01-01',$4,$4)`,[id('file-membership-2'),school2,user,id('bootstrap')])
 await client.query(`INSERT INTO membership_roles(school_id,membership_id,role_id,valid_from,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,'2026-01-01',$4,$4)`,[school2,id('file-membership-2'),id('role-school_admin'),id('bootstrap')])
 await client.query(`INSERT INTO learners(id,school_id,display_name,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,'Foreign learner',$3,$3)`,[learner2,school2,id('bootstrap')])
 await client.query(`INSERT INTO media_assets(id,school_id,learner_id,object_key,original_name,title,category,mime_type,size,uploaded_by_actor_id,state) VALUES($1,$2,$3,'untouched/foreign','foreign.pdf','Foreign','general','application/pdf',10,$4,'ready')`,[asset2,school2,learner2,id('bootstrap')])
 await test('even a two-school admin cannot mix selected school and foreign learner/file/folder IDs',async()=>{for(const op of [()=>service.list(school,{learnerId:learner2}),()=>service.upload(school,{learnerId:learner2},form()),()=>service.download(school,asset2),()=>service.update(school,asset2,'x','','general'),()=>service.list(school2,{folderId:folder.id}),()=>service.download(school2,file.id)])await assert.rejects(op(),/NOT_FOUND/)})
 await test('caller-supplied foreign school without membership rejected',async()=>{user=id('user-teacher');await assert.rejects(service.listLearners(school2),/FORBIDDEN/);await assert.rejects(service.download(school2,asset2),/FORBIDDEN/);user=id('user-admin')})
 await test('arbitrary keys, IDs and ambiguous targets rejected',async()=>{await assert.rejects(service.download(school,'uploads/private.pdf'),/INVALID_INPUT/);await assert.rejects(service.download(school,id('unknown')),/NOT_FOUND/);await assert.rejects(service.upload(school,{...target,folderId:folder.id},form()),/INVALID_INPUT/);await assert.rejects(service.upload(school,{objectKey:'foreign'},form()),/INVALID_INPUT/)})
 await test('database composite foreign key rejects cross-school learner association',async()=>{await client.query('SAVEPOINT invalid_fk');await assert.rejects(client.query('UPDATE media_assets SET learner_id=$2 WHERE id=$1',[file.id,learner2]),e=>e.code==='23503');await client.query('ROLLBACK TO SAVEPOINT invalid_fk')})
 await test('invalid upload creates neither metadata nor object',async()=>{const n=objects.size;await assert.rejects(service.upload(school,target,new FormData()),/INVALID_INPUT/);assert.equal(objects.size,n)})
 await test('database reservation failure prevents object write',async()=>{const n=objects.size;failInsert=true;await assert.rejects(service.upload(school,target,form()));failInsert=false;assert.equal(objects.size,n)})
 await test('storage failure leaves tracked failed metadata, no ready file',async()=>{const n=(await service.list(school,target)).length;failStorage=true;await assert.rejects(service.upload(school,target,form()),/Upload failed/);failStorage=false;assert.equal((await service.list(school,target)).length,n);assert.ok((await client.query("SELECT id FROM media_assets WHERE school_id=$1 AND state='failed'",[school])).rowCount)})
 await test('finalization failure retains tracked pending object and hides it from reads',async()=>{const n=(await service.list(school,target)).length;failFinalize=true;await assert.rejects(service.upload(school,target,form()),/finalized/);failFinalize=false;assert.equal((await service.list(school,target)).length,n);const pending=(await client.query("SELECT id,object_key FROM media_assets WHERE school_id=$1 AND state='pending'",[school])).rows[0];assert.ok(objects.has(pending.object_key));await assert.rejects(service.download(school,pending.id),/NOT_FOUND/)})
 await test('withdrawal preserves file; teacher loses scope while admin retains access',async()=>{await admin.execute(school,'withdrawLearner',{learner_id:target.learnerId,effective_on:'2026-06-01',reason:'Integration withdrawal'});assert.ok((await service.list(school,target)).some(f=>f.id===file.id));assert.equal((await service.listLearners(school)).learners.find(l=>l.id===target.learnerId).status,'left');user=id('user-teacher');await assert.rejects(service.download(school,file.id),/NOT_FOUND/);user=id('user-admin')})
 await test('re-admission and later academic year keep the same portfolio identity',async()=>{
  await admin.execute(school,'readmitLearner',{learner_id:target.learnerId,admission_number:'FILE-READMIT',effective_on:'2026-08-01',reason:'Integration return'})
  const admission=(await client.query("SELECT id FROM learner_admissions WHERE school_id=$1 AND learner_id=$2 AND status='active'",[school,target.learnerId])).rows[0].id
  const year=await admin.execute(school,'saveYear',{code:'FILE-2027',starts_on:'2027-01-01',ends_on:'2027-12-31',status:'draft'})
  await admin.execute(school,'enrol',{admission_id:admission,academic_year_id:year,grade_id:id('grade'),starts_on:'2027-01-01'})
  assert.equal((await client.query('SELECT count(*)::int AS n FROM learners WHERE id=$1',[target.learnerId])).rows[0].n,1);assert.ok((await service.list(school,target)).some(f=>f.id===file.id));assert.equal((await row(file.id)).learner_id,target.learnerId)
 })
 await test('completed learner retains portfolio history',async()=>{const other={learnerId:id('learner-2')};const f=await service.upload(school,other,form());await admin.execute(school,'completeLearner',{learner_id:other.learnerId,effective_on:'2026-06-01',reason:'Integration completion'});await service.download(school,f.id);assert.equal((await service.listLearners(school)).learners.find(l=>l.id===other.learnerId).status,'completed')})
 await test('metadata editing and archive preserve object and audit history',async()=>{await service.update(school,file.id,'Revised','Updated description','certificate');assert.equal((await row(file.id)).category,'certificate');const n=objects.size;await service.archive(school,file.id);assert.equal(objects.size,n);assert.ok((await row(file.id)).archived_at);await assert.rejects(service.download(school,file.id),/NOT_FOUND/);assert.ok((await client.query("SELECT id FROM audit_events WHERE resource_id=$1 AND event_type='media.archived'",[file.id])).rowCount);await service.archive(school,media.id);await service.archiveFolder(school,folder.id)})
 await client.query('SET CONSTRAINTS ALL IMMEDIATE')
 console.log(`Portfolio/media integration PASS: ${passed} checks; database changes rolled back; storage was in memory only`)
} catch(e){safeFailure(e)} finally {await client.query('ROLLBACK');client.release();await pool.end()}

