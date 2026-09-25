import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { assessmentService } from '../lib/domain/assessments.ts'
import { learnerAssessmentService } from '../lib/domain/learner-assessments.ts'
import { foundationService } from '../lib/domain/foundation.ts'

const pool=developmentPool(); pool.options.connectionTimeoutMillis=15000; pool.options.query_timeout=120000
let client, user=id('user-teacher'), fault=false, passed=0, failStorage=false
const objects=new Map()
const storage={upload:async(key,bytes,contentType)=>{if(failStorage)throw Error('storage failure');objects.set(key,{bytes,contentType})},read:async key=>{assert.ok(objects.has(key));return objects.get(key)}}
try {
  client=await pool.connect(); await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout='60s'")
  const fingerprint=async()=> (await client.query("SELECT md5(string_agg(to_jsonb(a)::text,'' ORDER BY id)) hash FROM assessments a")).rows[0].hash
  const baseline=await fingerprint()
  if(process.argv.includes('--review-forward')) {
    const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')), ledger=(await client.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
    assert.equal(ledger.length,9)
    for(const [i,e] of journal.entries.slice(0,9).entries()){ assert.equal(ledger[i].hash,createHash('sha256').update(readFileSync(`drizzle/${e.tag}.sql`)).digest('hex')); assert.equal(String(ledger[i].created_at),String(e.when)) }
    for(const file of ['0009_learner_assessments','0010_learner_result_guards','0011_evidence_retention']) await client.query(readFileSync(`drizzle/${file}.sql`,'utf8'))
    assert.equal(await fingerprint(),baseline); console.log('PASS forward migration review and unchanged existing definitions')
  }
  if(process.argv.includes('--review-retention')) {
    assert.equal((await client.query('SELECT count(*)::int n FROM drizzle.__drizzle_migrations')).rows[0].n,11)
    await client.query(readFileSync('drizzle/0011_evidence_retention.sql','utf8'))
    assert.equal(await fingerprint(),baseline)
    console.log('PASS forward evidence retention review; existing definitions unchanged')
  }
  const adapter={connect:async()=>({query:async(sql,values)=>{
    if(sql==='BEGIN ISOLATION LEVEL SERIALIZABLE')return client.query('SAVEPOINT learner_operation')
    if(sql==='COMMIT'){await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('SET CONSTRAINTS ALL DEFERRED');return client.query('RELEASE SAVEPOINT learner_operation')}
    if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT learner_operation')
    if(fault && sql.includes('INSERT INTO audit_events'))throw new Error('Injected audit failure')
    return client.query(sql,values)
  },release(){}})}
  const service=learnerAssessmentService(adapter,async()=>user,storage), definitions=assessmentService(adapter,async()=>user), foundation=foundationService(adapter,async()=>user)
  const test=async(label,run)=>{await run();passed++;console.log('PASS '+label)}
  let scenarioSequence=0
  const isolation=async(run)=>{const name=`scenario_${++scenarioSequence}`;await client.query(`SAVEPOINT ${name}`);try{await run()}finally{await client.query(`ROLLBACK TO SAVEPOINT ${name}`)}}
  const dbReject=async(sql,values)=>isolation(async()=>{await assert.rejects(async()=>{await client.query(sql,values);await client.query('SET CONSTRAINTS ALL IMMEDIATE')},e=>['23514','23503','23505'].includes(e.code))})
  const uploadForm=()=>{const d=new FormData();d.set('file',new File(['%PDF-1.7\nevidence'],'work.pdf',{type:'application/pdf'}));d.set('title','Teacher evidence');d.set('description','Captured offline');d.set('category','work');return d}
  const type=(await definitions.readOffering(school,id('offering-math'))).types[0].id
  const input={title:'Synthetic learner result integration',offering_id:id('offering-math'),assessment_type_id:type,tasks:[{title:'Setup',criteria:[{title:'Preparation',indicators:[{descriptor:'Ready',score:'1.10'},{descriptor:'Not demonstrated',score:'0'}]}]},{title:'Capture',criteria:[{title:'Composition',indicators:[{descriptor:'Clear',score:'2.25'},{descriptor:'Partial',score:'1.05'}]}]}],levels:[{code:'A',descriptor:'Secure',lower:'0',upper:'3.35'}]}
  const draft=await definitions.save(school,input), a=await definitions.open(school,draft.id,Number(draft.row_version))
  const roster=(await service.roster(school,a.id)).learners; assert.ok(roster.length>=3)
  const learner=roster[0].id, other=roster[1].id, third=roster[2].id
  const full={observations:a.tasks.flatMap(t=>t.criteria.map(c=>({criterion_id:c.id,indicator_id:c.indicators[0].id}))),feedback:'Synthetic feedback',evidence:[]}
  const partial={...full,observations:full.observations.slice(0,1)}
  let saved
  await test('roster matches foundation; Not started is derived; reads create no records',async()=>{assert.deepEqual(roster.map(l=>l.id),(await foundation.getOfferingRoster(school,a.offering_id)).map(l=>l.id));assert.ok(roster.every(l=>l.status==='not_started'&&l.result.score===null));await service.get(school,a.id,learner);assert.equal((await client.query('SELECT count(*)::int n FROM learner_assessments WHERE assessment_id=$1',[a.id])).rows[0].n,0)})
  await test('Draft assessment rejects learner reads and writes',async()=>{const d=await definitions.save(school,input);await assert.rejects(service.roster(school,d.id),/CONFLICT/);await assert.rejects(service.mutate(school,d.id,learner,'save',0,partial),/CONFLICT/)})
  await test('lazy partial save persists observations, feedback and exact score',async()=>{saved=await service.mutate(school,a.id,learner,'save',0,partial);const read=await service.get(school,a.id,learner);assert.equal(read.participation.status,'in_progress');assert.equal(read.participation.feedback,partial.feedback);assert.deepEqual(read.observations,partial.observations);assert.equal(read.result.score,'1.10');assert.equal(read.result.performance,null)})
  await test('stale partial write rejected',()=>assert.rejects(service.mutate(school,a.id,learner,'save',0,full),/CONFLICT/))
  await test('incomplete completion rejected without losing saved work',async()=>{await assert.rejects(service.mutate(school,a.id,learner,'complete',Number(saved.participation.row_version),partial),/INVALID_INPUT/);assert.equal((await service.get(school,a.id,learner)).result.score,'1.10')})
  await test('arbitrary browser totals and forged criterion/indicator rejected',async()=>{for(const bad of [{...full,total:999},{...full,observations:[{...full.observations[0],indicator_id:full.observations[1].indicator_id}]},{...full,observations:[{criterion_id:randomUUID(),indicator_id:full.observations[0].indicator_id}]}])await assert.rejects(service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),bad),/INVALID_INPUT/)})
  await test('observation updates preserve UUID and creator',async()=>{const before=(await client.query('SELECT id,created_at,created_by_actor_id FROM criterion_observations WHERE learner_assessment_id=$1',[saved.participation.id])).rows;const change={...partial,observations:[{...partial.observations[0],indicator_id:a.tasks[0].criteria[0].indicators[1].id}]};saved=await service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),change);assert.equal((await service.get(school,a.id,learner)).result.score,'0.00');assert.deepEqual((await client.query('SELECT id,created_at,created_by_actor_id FROM criterion_observations WHERE learner_assessment_id=$1',[saved.participation.id])).rows,before)})
  await test('absence cannot silently discard saved work',()=>assert.rejects(service.mutate(school,a.id,learner,'absent',Number(saved.participation.row_version)),/INVALID_INPUT/))
  await test('database rejects wrong indicator, duplicates and parent identity changes',async()=>{const o=full.observations[0];await dbReject('UPDATE criterion_observations SET indicator_id=$2 WHERE learner_assessment_id=$1',[saved.participation.id,full.observations[1].indicator_id]);await dbReject('INSERT INTO criterion_observations(school_id,learner_assessment_id,criterion_id,indicator_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$5,$5)',[school,saved.participation.id,o.criterion_id,o.indicator_id,id('bootstrap')]);await dbReject('UPDATE learner_assessments SET learner_id=$2 WHERE id=$1',[saved.participation.id,other]);await dbReject("UPDATE learner_assessments SET status='invalid' WHERE id=$1",[saved.participation.id]);await dbReject("UPDATE learner_assessments SET status='completed',completed_at=now(),completed_by_actor_id=$2 WHERE id=$1",[saved.participation.id,id('bootstrap')])})
  const asset=async(target,tenant=school)=>{const key=randomUUID();return (await client.query("INSERT INTO media_assets(school_id,learner_id,object_key,original_name,title,category,mime_type,size,uploaded_by_actor_id,state) VALUES($1,$2,$3,'synthetic.pdf','Synthetic evidence','work','application/pdf',10,$4,'ready') RETURNING id",[tenant,target,'synthetic-rollback-only/'+key,id('bootstrap')])).rows[0].id}
  const goodAsset=await asset(learner), wrongAsset=await asset(other)
  await test('evidence ownership and task/criterion boundaries enforced',async()=>{for(const e of [{asset_id:wrongAsset},{asset_id:goodAsset,task_id:randomUUID()},{asset_id:goodAsset,task_id:a.tasks[0].id,criterion_id:a.tasks[1].criteria[0].id}])await assert.rejects(service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),{...partial,evidence:[e]}),/NOT_FOUND|INVALID_INPUT/)})
  await test('existing evidence can be associated, scoped and removed',async()=>{saved=await service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),{...partial,evidence:[{asset_id:goodAsset,task_id:a.tasks[0].id}]});assert.equal((await service.get(school,a.id,learner)).evidence.length,1);await dbReject('UPDATE media_assets SET archived_at=now() WHERE id=$1',[goodAsset]);saved=await service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),partial);assert.equal((await service.get(school,a.id,learner)).evidence.length,0)})
  let uploaded
  await test('authorized teacher can upload private evidence for accessible learner assessment',async()=>{
    const before=objects.size
    uploaded=await service.uploadEvidence(school,a.id,learner,uploadForm())
    const row=(await client.query('SELECT * FROM media_assets WHERE school_id=$1 AND id=$2',[school,uploaded.id])).rows[0]
    assert.equal(row.learner_id,learner); assert.equal(row.title,'Teacher evidence'); assert.equal(row.state,'ready')
    assert.equal(row.uploaded_by_actor_id,id('actor-teacher')); assert.ok(objects.has(row.object_key)); assert.equal(objects.size,before+1)
    assert.ok(row.object_key.startsWith(`schools/${school}/assets/`)); assert.equal(uploaded.title,'Teacher evidence')
  })
  await test('uploaded evidence attaches to learner/assessment and optional task or criterion',async()=>{
    saved=await service.mutate(school,a.id,learner,'save',Number(saved.participation.row_version),{...partial,evidence:[{asset_id:uploaded.id,task_id:a.tasks[0].id,criterion_id:a.tasks[0].criteria[0].id}]})
    const links=(await service.get(school,a.id,learner)).evidence
    assert.equal(links.length,1); assert.equal(links[0].asset_id,uploaded.id); assert.equal(links[0].task_id,a.tasks[0].id); assert.equal(links[0].criterion_id,a.tasks[0].criteria[0].id)
    assert.ok((await service.get(school,a.id,learner)).assets.some(f=>f.id===uploaded.id))
  })
  await test('invalid upload is rejected without creating ready metadata or objects',async()=>{
    const before=objects.size, ready=(await client.query("SELECT count(*)::int n FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='ready'",[school,learner])).rows[0].n
    await assert.rejects(service.uploadEvidence(school,a.id,learner,new FormData()),/INVALID_INPUT/)
    assert.equal(objects.size,before)
    assert.equal((await client.query("SELECT count(*)::int n FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='ready'",[school,learner])).rows[0].n,ready)
  })
  await test('storage failure does not leave a ready learner file',async()=>{
    const before=(await client.query("SELECT count(*)::int n FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='ready'",[school,learner])).rows[0].n
    failStorage=true
    try{await assert.rejects(service.uploadEvidence(school,a.id,learner,uploadForm()),/Upload failed/)}finally{failStorage=false}
    assert.equal((await client.query("SELECT count(*)::int n FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='ready'",[school,learner])).rows[0].n,before)
    assert.ok((await client.query("SELECT id FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='failed'",[school,learner])).rowCount)
  })
  await test('unauthorized, cross-school and invalid learner/assessment uploads rejected',async()=>{
    try{
      for(const who of [null,id('user-moderator'),id('user-admin')]){user=who;await assert.rejects(service.uploadEvidence(school,a.id,learner,uploadForm()),/FORBIDDEN|UNAUTHORIZED/)}
    }finally{user=id('user-teacher')}
    await assert.rejects(service.uploadEvidence(school,a.id,randomUUID(),uploadForm()),/NOT_FOUND/)
    await assert.rejects(service.uploadEvidence(school,randomUUID(),learner,uploadForm()),/NOT_FOUND/)
    await assert.rejects(service.uploadEvidence(randomUUID(),a.id,learner,uploadForm()),/FORBIDDEN/)
  })
  await test('revoked assignment cannot upload evidence',()=>isolation(async()=>{
    await client.query("UPDATE teacher_assignments SET status='revoked' WHERE school_id=$1 AND offering_id=$2",[school,a.offering_id])
    await assert.rejects(service.uploadEvidence(school,a.id,learner,uploadForm()),/FORBIDDEN/)
  }))
  await test('audit failure rolls back completion, feedback and evidence',async()=>{fault=true;try{await assert.rejects(service.mutate(school,a.id,learner,'complete',Number(saved.participation.row_version),{...full,evidence:[{asset_id:goodAsset}]}),/Injected/)}finally{fault=false}const read=await service.get(school,a.id,learner);assert.equal(read.participation.row_version,saved.participation.row_version);assert.equal(read.participation.status,'in_progress');assert.equal(read.evidence.length,1)})
  await test('complete derives authoritative total/performance, audit and next',async()=>{saved=await service.mutate(school,a.id,learner,'complete',Number(saved.participation.row_version),{...full,evidence:[{asset_id:goodAsset},{asset_id:uploaded.id,criterion_id:a.tasks[0].criteria[0].id}]});assert.equal(saved.result.score,'3.35');assert.equal(saved.result.performance.code,'A');assert.equal(saved.next,other);const read=await service.get(school,a.id,learner);assert.ok(read.participation.completed_at);assert.ok(read.participation.completed_by_actor_id);assert.equal(read.result.score,'3.35');const events=(await client.query("SELECT safe_changes FROM audit_events WHERE resource_id=$1 AND event_type='learner_assessment.completed'",[saved.participation.id])).rows;assert.equal(events.length,1);assert.ok(!JSON.stringify(events).includes('Synthetic feedback'))})
  await test('completed result rejects all service mutations and stale saves',async()=>{for(const command of ['save','complete','absent','begin'])await assert.rejects(service.mutate(school,a.id,learner,command,Number(saved.participation.row_version),full),/CONFLICT/);await assert.rejects(service.mutate(school,a.id,learner,'save',1,partial),/CONFLICT/)})
  await test('completed assessment cannot receive new evidence uploads',()=>assert.rejects(service.uploadEvidence(school,a.id,learner,uploadForm()),/CONFLICT/))
  await test('completed parent, observations, evidence and asset protected directly',async()=>{for(const [sql,values] of [['UPDATE learner_assessments SET feedback=\'attack\' WHERE id=$1',[saved.participation.id]],['DELETE FROM learner_assessments WHERE id=$1',[saved.participation.id]],['DELETE FROM criterion_observations WHERE learner_assessment_id=$1',[saved.participation.id]],['DELETE FROM assessment_evidence WHERE learner_assessment_id=$1',[saved.participation.id]],['UPDATE media_assets SET archived_at=now() WHERE id=$1',[goodAsset]],['UPDATE media_assets SET learner_id=$2 WHERE id=$1',[goodAsset,other]]])await dbReject(sql,values)})
  await test('absence has no score; explicit begin reuses identity and is audited',async()=>{const absent=await service.mutate(school,a.id,other,'absent',0);assert.equal((await service.get(school,a.id,other)).result.score,null);await assert.rejects(service.uploadEvidence(school,a.id,other,uploadForm()),/CONFLICT/);await assert.rejects(service.mutate(school,a.id,other,'save',Number(absent.participation.row_version),full),/CONFLICT/);const begun=await service.mutate(school,a.id,other,'begin',Number(absent.participation.row_version));assert.equal(begun.participation.id,absent.participation.id);assert.equal(begun.participation.status,'in_progress');assert.equal(begun.participation.absent_at,null);assert.equal((await client.query("SELECT count(*)::int n FROM audit_events WHERE resource_id=$1 AND event_type='learner_assessment.begun'",[begun.participation.id])).rows[0].n,1)})
  await test('absence versus stale save yields controlled conflict',async()=>{await service.mutate(school,a.id,third,'absent',0);await assert.rejects(service.mutate(school,a.id,third,'save',0,full),/CONFLICT/)})
  await test('no-scale assessment completes without fabricated descriptor',async()=>{const d=await definitions.save(school,{...input,levels:[]}),open=await definitions.open(school,d.id,Number(d.row_version));const result=await service.mutate(school,open.id,learner,'complete',0,{...full,evidence:[],observations:open.tasks.flatMap(t=>t.criteria.map(c=>({criterion_id:c.id,indicator_id:c.indicators[0].id})))});assert.equal(result.result.performance,null)})
  await test('anonymous, moderator and admin-only cannot enter results',async()=>{try{for(const who of [null,id('user-moderator'),id('user-admin')]){user=who;await assert.rejects(service.roster(school,a.id),/FORBIDDEN|UNAUTHORIZED/);await assert.rejects(service.mutate(school,a.id,learner,'save',0,partial),/FORBIDDEN|UNAUTHORIZED/)}}finally{user=id('user-teacher')}})
  await test('mixed admin/teacher still requires actual assignment',()=>isolation(async()=>{await client.query("INSERT INTO membership_roles(school_id,membership_id,role_id,valid_from,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,'2026-01-01',$4,$4)",[school,id('membership-admin'),id('role-teacher'),id('bootstrap')]);user=id('user-admin');try{await assert.rejects(service.roster(school,a.id),/FORBIDDEN/)}finally{user=id('user-teacher')}}))
  await test('revoked and expired teacher assignments deny reads/writes',async()=>{for(const change of ["status='revoked'","ends_on='2026-01-02'"])await isolation(async()=>{await client.query(`UPDATE teacher_assignments SET ${change} WHERE school_id=$1 AND offering_id=$2`,[school,a.offering_id]);await assert.rejects(service.roster(school,a.id),/FORBIDDEN/);await assert.rejects(service.mutate(school,a.id,learner,'save',0,partial),/FORBIDDEN/)})})
  await test('dated transfer out excludes learner and prevents result access',()=>isolation(async()=>{await client.query("UPDATE learner_subject_enrolments SET ends_on='2026-01-02' WHERE school_id=$1 AND offering_id=$2 AND enrolment_id IN (SELECT id FROM learner_enrolments WHERE learner_id=$3)",[school,a.offering_id,learner]);assert.ok(!(await service.roster(school,a.id)).learners.some(l=>l.id===learner));await assert.rejects(service.get(school,a.id,learner),/NOT_FOUND/)}))
  await test('foreign/non-roster claims denied',async()=>{await assert.rejects(service.get(school,a.id,randomUUID()),/NOT_FOUND/);await assert.rejects(service.get(randomUUID(),a.id,learner),/FORBIDDEN/);await assert.rejects(service.roster(school,randomUUID()),/NOT_FOUND/);await assert.rejects(service.get(school,saved.participation.id,learner),/NOT_FOUND/)})
  await test('opened definition locking remains intact',async()=>{await dbReject('UPDATE assessment_indicators SET score_units=999 WHERE id=$1',[full.observations[0].indicator_id]);await dbReject('DELETE FROM assessment_tasks WHERE id=$1',[a.tasks[0].id]);await dbReject("UPDATE assessments SET status='draft' WHERE id=$1",[a.id])})
  const unindexed=await client.query(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indpred IS NULL AND i.indisvalid AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey))=c.conkey)`)
  assert.equal(unindexed.rowCount,0,JSON.stringify(unindexed.rows))
  await test('real foreign school learner, assessment and evidence denied; tenant FKs enforced',()=>isolation(async()=>{
    const insert=async(table,fields,tenant)=>{const row={id:randomUUID(),...(tenant?{school_id:tenant}:{}),created_by_actor_id:id('bootstrap'),updated_by_actor_id:id('bootstrap'),...fields};const keys=Object.keys(row);await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(row));return row.id}
    const foreignSchool=await insert('schools',{code:'LEARNER-FOREIGN',name:'Synthetic foreign school'}),foreignLearner=await insert('learners',{display_name:'Synthetic foreign learner'},foreignSchool)
    const year=await insert('academic_years',{code:'2026',starts_on:'2026-01-01',ends_on:'2026-12-31',status:'active'},foreignSchool)
    const group=await insert('class_groups',{academic_year_id:year,grade_id:id('grade'),code:'FOREIGN',label:'Foreign class'},foreignSchool)
    const subject=await insert('school_subjects',{subject_id:id('subject-math'),local_code:'MATH',display_name:'Math'},foreignSchool)
    const offering=await insert('subject_offerings',{school_subject_id:subject,class_group_id:group,academic_year_id:year,grade_id:id('grade'),subject_id:id('subject-math')},foreignSchool)
    const kind=await insert('assessment_types',{code:'SYNTHETIC',name:'Synthetic'},foreignSchool)
    const foreignAssessment=await insert('assessments',{offering_id:offering,academic_year_id:year,assessment_type_id:kind,title:'Synthetic foreign assessment'},foreignSchool)
    const foreignAsset=await asset(foreignLearner,foreignSchool)
    await assert.rejects(service.roster(school,foreignAssessment),/NOT_FOUND/)
    await assert.rejects(service.roster(foreignSchool,foreignAssessment),/FORBIDDEN/)
    await assert.rejects(service.get(school,a.id,foreignLearner),/NOT_FOUND/)
    await assert.rejects(service.uploadEvidence(school,a.id,foreignLearner,uploadForm()),/NOT_FOUND/)
    await assert.rejects(service.uploadEvidence(foreignSchool,foreignAssessment,foreignLearner,uploadForm()),/FORBIDDEN/)
    const current=await service.get(school,a.id,other)
    await assert.rejects(service.mutate(school,a.id,other,'save',Number(current.participation.row_version),{...full,evidence:[{asset_id:foreignAsset}]}),/NOT_FOUND/)
    await dbReject('INSERT INTO learner_assessments(school_id,assessment_id,learner_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$4)',[school,a.id,foreignLearner,id('bootstrap')])
    await dbReject('INSERT INTO criterion_observations(school_id,learner_assessment_id,criterion_id,indicator_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$5,$5)',[foreignSchool,current.participation.id,full.observations[0].criterion_id,full.observations[0].indicator_id,id('bootstrap')])
  }))
  await test('assigned mixed-role teacher retains only actual teaching assignments',()=>isolation(async()=>{
    const before=(await foundation.getFoundation(school,'assigned')).offerings.map(o=>o.id)
    await client.query("INSERT INTO membership_roles(school_id,membership_id,role_id,valid_from,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,'2026-01-01',$4,$4)",[school,id('membership-teacher'),id('role-school_admin'),id('bootstrap')])
    assert.deepEqual((await foundation.getFoundation(school,'assigned')).offerings.map(o=>o.id),before)
    assert.equal((await service.roster(school,a.id)).learners.length,roster.length)
  }))
  await test('another assessment criterion and indicator cannot be submitted',async()=>{
    const foreign=(await client.query('SELECT c.id criterion_id,i.id indicator_id FROM assessment_criteria c JOIN assessment_indicators i ON i.school_id=c.school_id AND i.criterion_id=c.id JOIN assessment_tasks t ON t.school_id=c.school_id AND t.id=c.task_id WHERE c.school_id=$1 AND t.assessment_id<>$2 LIMIT 1',[school,a.id])).rows[0]
    assert.ok(foreign)
    const current=await service.get(school,a.id,other)
    await assert.rejects(service.mutate(school,a.id,other,'save',Number(current.participation.row_version),{...partial,observations:[foreign]}),/INVALID_INPUT/)
    await dbReject('INSERT INTO criterion_observations(school_id,learner_assessment_id,criterion_id,indicator_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$5,$5)',[school,current.participation.id,foreign.criterion_id,foreign.indicator_id,id('bootstrap')])
  })
  await test('absence audit failure rolls back the state transition',async()=>{
    const before=await service.get(school,a.id,other);fault=true
    try{await assert.rejects(service.mutate(school,a.id,other,'absent',Number(before.participation.row_version)),/Injected/)}finally{fault=false}
    assert.deepEqual((await service.get(school,a.id,other)).participation,before.participation)
  })
  console.log(`Learner assessment integration PASS: ${passed} checks; all fixtures rolled back; in-memory storage only`)
}catch(error){safeFailure(error)}finally{if(client){await client.query('ROLLBACK');client.release()}await pool.end()}
