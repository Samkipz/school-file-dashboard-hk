import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { assessmentService } from '../lib/domain/assessments.ts'

const pool = developmentPool(), client = await pool.connect()
let passed = 0, user = id('user-admin'), fault = false
const baseline = (await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n
try {
  await client.query('BEGIN')
  if (process.argv.includes('--review-forward')) {
    const before = (await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS rows FROM assessment_tasks t')).rows[0]
    for (const name of ['0005_assessment_nonblank','0006_assessment_task_order']) await client.query(readFileSync(`drizzle/${name}.sql`,'utf8'))
    assert.deepEqual((await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS rows FROM assessment_tasks t')).rows[0],before)
    console.log('PASS forward migration rollback review preserves existing task rows byte-for-byte')
  } else if (process.argv.includes('--review-migration')) {
    assert.equal((await client.query("SELECT to_regclass('public.assessments') AS t")).rows[0].t, null)
    await client.query(readFileSync('drizzle/0003_assessment_drafts.sql','utf8'))
    await client.query(readFileSync('drizzle/0004_assessment_draft_guards.sql','utf8'))
    await client.query(readFileSync('drizzle/0005_assessment_nonblank.sql','utf8'))
    await client.query(readFileSync('drizzle/0006_assessment_task_order.sql','utf8'))
    console.log('Generated schema and companion guards applied inside rollback-only review transaction')
  } else assert.ok((await client.query("SELECT to_regclass('public.assessments') AS t")).rows[0].t, 'Apply reviewed forward migrations first')
  const adapter = { connect: async () => ({ query: async (sql, values) => {
    if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return client.query('SAVEPOINT assessment_operation')
    if (sql === 'COMMIT') { await client.query('SET CONSTRAINTS ALL IMMEDIATE'); await client.query('SET CONSTRAINTS ALL DEFERRED'); return client.query('RELEASE SAVEPOINT assessment_operation') }
    if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT assessment_operation')
    if (fault && sql.includes('INSERT INTO audit_events')) throw new Error('Injected audit failure')
    return client.query(sql,values)
  }, release() {} }) }
  const service = assessmentService(adapter,async () => user)
  async function test(label, run) { await run(); passed++; console.log(`PASS ${label}`) }
  async function rejectSQL(label, sql, values = [], code = '23514') {
    await test(label, async () => {
      await client.query('SAVEPOINT invalid_sql')
      try { await assert.rejects(async () => { await client.query(sql,values); await client.query('SET CONSTRAINTS ALL IMMEDIATE') }, e => (Array.isArray(code) ? code : [code]).includes(e.code)) }
      finally { await client.query('ROLLBACK TO SAVEPOINT invalid_sql') }
    })
  }
  const insert = async (table, fields, tenant = school) => {
    const values = {id:randomUUID(), ...(tenant ? {school_id:tenant} : {}), created_by_actor_id:id('bootstrap'),updated_by_actor_id:id('bootstrap'),...fields}
    const keys = Object.keys(values)
    await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(values))
    return values.id
  }
  await test('admin initializes five configurable types idempotently', async () => { await service.initializeTypes(school); await service.initializeTypes(school); assert.equal((await service.read(school)).types.filter(t=>['PROJECT','PRACTICAL','PERFORMANCE_TASK','WRITTEN_TEST','CLASSROOM_ASSESSMENT'].includes(t.code)).length,5) })
  const type = (await service.read(school)).types.find(t=>t.code==='PROJECT').id
  const input = {title:'Integration draft',offering_id:id('offering-math'),term_id:id('term-1'),assessment_type_id:type,starts_on:'2026-01-01',due_on:'2026-12-31',tasks:[{title:'First',due_on:'2026-09-01'},{title:'Second',starts_on:'2026-02-01'}]}
  let draft
  await test('create grade 10 draft with ordered tasks and cross-term dates', async () => { draft=await service.save(school,input); assert.equal(draft.status,'draft'); assert.deepEqual(draft.tasks.map(t=>[t.ordinal,t.title]),[[1,'First'],[2,'Second']]) })
  await test('reload persisted complete draft', async () => { assert.deepEqual(await service.get(school,draft.id),draft) })
  const originalTasks = draft.tasks.map(t => t.id)
  const provenance = async () => (await client.query('SELECT id,created_at,created_by_actor_id FROM assessment_tasks WHERE assessment_id=$1 ORDER BY id',[draft.id])).rows
  const originalProvenance = await provenance()
  await test('unchanged task save preserves IDs and creation provenance', async () => {
    draft=await service.save(school,draft,draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks.map(t=>t.id),originalTasks); assert.deepEqual(await provenance(),originalProvenance)
  })
  await test('task text edit preserves identity and provenance', async () => {
    draft=await service.save(school,{...draft,tasks:draft.tasks.map((t,i)=>({...t,title:i===0?'First edited':t.title}))},draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks.map(t=>t.id),originalTasks); assert.deepEqual(await provenance(),originalProvenance)
  })
  const oldVersion = Number(draft.row_version)
  await test('edit and reorder task definitions with stable IDs', async () => { draft=await service.save(school,{...draft,title:'Edited draft',tasks:[draft.tasks[1],draft.tasks[0]]},draft.id,oldVersion); assert.equal(draft.title,'Edited draft'); assert.equal(draft.tasks[0].title,'Second'); assert.ok(Number(draft.row_version)>oldVersion); assert.deepEqual(draft.tasks.map(t=>t.id),[...originalTasks].reverse()); assert.deepEqual(await provenance(),originalProvenance) })
  await test('add creates exactly one new ID and remove retains remaining IDs', async () => {
    const before=draft.tasks.map(t=>t.id)
    draft=await service.save(school,{...draft,tasks:[{title:'New task'},...draft.tasks]},draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks.slice(1).map(t=>t.id),before); assert.ok(!originalTasks.includes(draft.tasks[0].id))
    const added=draft.tasks[0].id
    draft=await service.save(school,{...draft,tasks:draft.tasks.slice(1)},draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks.map(t=>t.id),before); assert.deepEqual(await provenance(),originalProvenance)
    console.log(JSON.stringify({originalTasks,reordered:draft.tasks.map(t=>t.id),addedThenRemoved:added}))
  })
  for (const [label,tasks] of [['duplicate',[draft.tasks[0],draft.tasks[0]]],['case-folded duplicate',[draft.tasks[0],{...draft.tasks[0],id:draft.tasks[0].id.toUpperCase()}]],['unknown',[{title:'Attack',id:randomUUID()}]]]) {
    await test(`${label} task IDs rejected without mutation`,async()=>{
      const before=await service.get(school,draft.id)
      await assert.rejects(service.save(school,{...draft,tasks},draft.id,Number(draft.row_version)),/INVALID_INPUT/)
      assert.deepEqual(await service.get(school,draft.id),before)
    })
  }
  await test('creation rejects client-supplied task IDs',()=>assert.rejects(service.save(school,{...input,tasks:draft.tasks}),/INVALID_INPUT/))
  const foreignDraft=await service.save(school,input)
  await test('foreign-assessment task ID rejected',()=>assert.rejects(service.save(school,{...draft,tasks:foreignDraft.tasks},draft.id,Number(draft.row_version)),/INVALID_INPUT/))
  await test('structural audit records IDs and order without text',async()=>{
    const changes=(await client.query("SELECT safe_changes FROM audit_events WHERE resource_id=$1 AND event_type='assessment.updated' ORDER BY occurred_at,id",[draft.id])).rows.map(r=>r.safe_changes)
    assert.ok(changes.some(c=>c.tasks.created.length===1)); assert.ok(changes.some(c=>c.tasks.deleted.length===1))
    assert.ok(changes.some(c=>c.tasks.updated.length===2 && c.tasks.ordering.length===2))
    assert.ok(!JSON.stringify(changes).includes('First edited')); assert.ok(!JSON.stringify(changes).includes('New task'))
  })
  await test('stale update cannot overwrite', async () => { await assert.rejects(service.save(school,input,draft.id,oldVersion),/CONFLICT/); assert.equal((await service.get(school,draft.id)).title,'Edited draft') })
  await test('draft permits no tasks, term or dates', async () => { const d=await service.save(school,{...input,term_id:null,starts_on:null,due_on:null,tasks:[]}); assert.equal(d.tasks.length,0); assert.equal(d.starts_on,null) })
  for (const fields of [{starts_on:'2025-12-31'},{due_on:'2027-01-01'},{tasks:[{title:'Task',due_on:'2027-01-01'}]},{title:' '},{tasks:Array(101).fill({title:'Task'})}]) await test('service rejects invalid draft '+Object.keys(fields)[0],()=>assert.rejects(service.save(school,{...input,...fields}),/INVALID_INPUT/))
  await test('audit failure rolls back create and edit including tasks', async () => {
    const before=await service.get(school,draft.id), count=(await service.read(school)).drafts.length
    fault=true
    try { await assert.rejects(service.save(school,input),/Injected audit failure/); await assert.rejects(service.save(school,{...input,tasks:[]},draft.id,Number(before.row_version)),/Injected audit failure/) } finally { fault=false }
    assert.deepEqual(await service.get(school,draft.id),before); assert.equal((await service.read(school)).drafts.length,count)
  })
  await test('audit failure rolls back combined inserts updates deletes reorder and parent revision',async()=>{
    draft=await service.save(school,{...draft,tasks:[...draft.tasks,{title:'Third'}]},draft.id,Number(draft.row_version))
    const before=(await client.query('SELECT to_jsonb(t) AS row FROM assessment_tasks t WHERE assessment_id=$1 ORDER BY id',[draft.id])).rows
    const events=(await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n
    fault=true
    try { await assert.rejects(service.save(school,{...draft,title:'Must roll back',tasks:[{...draft.tasks[2],title:'Changed third'},{title:'Inserted'},draft.tasks[1]]},draft.id,Number(draft.row_version)),/Injected audit failure/) } finally { fault=false }
    assert.deepEqual(await service.get(school,draft.id),draft)
    assert.deepEqual((await client.query('SELECT to_jsonb(t) AS row FROM assessment_tasks t WHERE assessment_id=$1 ORDER BY id',[draft.id])).rows,before)
    assert.equal((await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,events)
    draft=await service.save(school,{...draft,tasks:draft.tasks.slice(0,2)},draft.id,Number(draft.row_version))
  })
  await test('custom type create/edit, stale version, disabled selection', async () => {
    const custom=await service.saveType(school,{code:'INTEGRATION_CUSTOM',name:'Custom',enabled:true})
    await service.saveType(school,{code:'INTEGRATION_CUSTOM',name:'Renamed',enabled:false},custom,1)
    await assert.rejects(service.saveType(school,{code:'INTEGRATION_CUSTOM',name:'Stale',enabled:true},custom,1),/CONFLICT/)
    await assert.rejects(service.save(school,{...input,assessment_type_id:custom}),/INVALID_INPUT/)
  })
  const year2=await insert('academic_years',{code:'ASSESSMENT-2027',starts_on:'2027-01-01',ends_on:'2027-12-31',status:'draft'})
  const term2=await insert('terms',{academic_year_id:year2,code:'OTHER-YEAR',ordinal:1,starts_on:'2027-01-01',ends_on:'2027-04-30'})
  await rejectSQL('database rejects wrong-year term', 'UPDATE assessments SET term_id=$1 WHERE id=$2',[term2,draft.id],'23503')
  await rejectSQL('database rejects wrong offering year even without term', 'UPDATE assessments SET academic_year_id=$1,term_id=NULL WHERE id=$2',[year2,draft.id],'23503')
  await rejectSQL('database rejects assessment outside year', "UPDATE assessments SET due_on='2027-01-01' WHERE id=$1",[draft.id])
  await rejectSQL('database rejects task outside year', "UPDATE assessment_tasks SET due_on='2027-01-01' WHERE assessment_id=$1 AND ordinal=1",[draft.id])
  await rejectSQL('database rejects reversed dates', "UPDATE assessments SET starts_on='2026-12-31',due_on='2026-01-01' WHERE id=$1",[draft.id])
  await rejectSQL('database rejects future status', "UPDATE assessments SET status='published' WHERE id=$1",[draft.id])
  await rejectSQL('database rejects blank title', "UPDATE assessments SET title=' ' WHERE id=$1",[draft.id])
  const whitespace=[' ','\t','\n',' \t\r\n\u00a0\u2003\u2028\ufeff',...Array.from('\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')]
  for (const [table,field,key] of [['assessments','title',draft.id],['assessment_tasks','title',draft.tasks[0].id],['assessment_types','name',type]]) {
    for (const value of whitespace) await rejectSQL(`${table} rejects whitespace ${JSON.stringify(value)}`,`UPDATE ${table} SET ${field}=$1 WHERE id=$2`,[value,key])
    await test(`${table} accepts normal and non-trim Unicode text`,async()=>{
      await client.query('SAVEPOINT valid_text')
      for (const value of ['Normal title',' \tNormal title\n','\u0085','\u200b']) { await client.query(`UPDATE ${table} SET ${field}=$1 WHERE id=$2`,[value,key]); await client.query('SET CONSTRAINTS ALL IMMEDIATE') }
      await client.query('ROLLBACK TO SAVEPOINT valid_text')
    })
  }
  await rejectSQL('database rejects ordinal zero', 'UPDATE assessment_tasks SET ordinal=0 WHERE id=$1',[draft.tasks[0].id])
  await rejectSQL('database rejects title length', "UPDATE assessments SET title=repeat('a',161) WHERE id=$1",[draft.id],'22001')
  await rejectSQL('database rejects invalid ordinal', 'UPDATE assessment_tasks SET ordinal=101 WHERE assessment_id=$1 AND ordinal=1',[draft.id])
  await rejectSQL('database rejects ordering gaps', 'DELETE FROM assessment_tasks WHERE assessment_id=$1 AND ordinal=1',[draft.id])
  // Both deferred guards reject this state; their execution order is not a contract.
  await rejectSQL('database rejects duplicate ordinals', 'UPDATE assessment_tasks SET ordinal=1 WHERE assessment_id=$1 AND ordinal=2',[draft.id],['23505','23514'])
  await test('deferred uniqueness itself rejects collisions',async()=>{
    await client.query('SAVEPOINT duplicate_order')
    try {
      await client.query('UPDATE assessment_tasks SET ordinal=1 WHERE assessment_id=$1 AND ordinal=2',[draft.id])
      await assert.rejects(client.query('SET CONSTRAINTS assessment_tasks_school_id_assessment_id_ordinal_unique IMMEDIATE'),e=>e.code==='23505')
    } finally { await client.query('ROLLBACK TO SAVEPOINT duplicate_order') }
  })
  await rejectSQL('database restricts referenced offering deletion', 'DELETE FROM subject_offerings WHERE id=$1',[id('offering-math')],'23503')
  const otherSchool=await insert('schools',{code:'ASSESSMENT-FOREIGN',name:'Synthetic other school'},null)
  const otherYear=await insert('academic_years',{code:'2026',starts_on:'2026-01-01',ends_on:'2026-12-31',status:'active'},otherSchool)
  const otherClass=await insert('class_groups',{academic_year_id:otherYear,grade_id:id('grade'),code:'OTHER',label:'Other'},otherSchool)
  const otherSubject=await insert('school_subjects',{subject_id:id('subject-math'),local_code:'MATH',display_name:'Math'},otherSchool)
  const otherOffering=await insert('subject_offerings',{school_subject_id:otherSubject,class_group_id:otherClass,academic_year_id:otherYear,grade_id:id('grade'),subject_id:id('subject-math')},otherSchool)
  const otherType=await insert('assessment_types',{code:'PROJECT',name:'Project'},otherSchool)
  const otherAssessment=await insert('assessments',{offering_id:otherOffering,academic_year_id:otherYear,assessment_type_id:otherType,title:'Foreign draft'},otherSchool)
  const otherTask=await insert('assessment_tasks',{assessment_id:otherAssessment,ordinal:1,title:'Foreign task'},otherSchool)
  await test('cross-school task ID rejected without mutating either assessment',async()=>{
    const before=await service.get(school,draft.id)
    await assert.rejects(service.save(school,{...before,tasks:[{title:'Attack',id:otherTask}]},draft.id,Number(before.row_version)),/INVALID_INPUT/)
    assert.deepEqual(await service.get(school,draft.id),before)
    assert.equal((await client.query('SELECT title FROM assessment_tasks WHERE id=$1',[otherTask])).rows[0].title,'Foreign task')
  })
  await rejectSQL('task assessment parent is immutable','UPDATE assessment_tasks SET assessment_id=$1 WHERE id=$2',[foreignDraft.id,draft.tasks[0].id])
  await rejectSQL('task school is immutable','UPDATE assessment_tasks SET school_id=$1 WHERE id=$2',[otherSchool,draft.tasks[0].id])
  await rejectSQL('task creation provenance is immutable','UPDATE assessment_tasks SET created_by_actor_id=$1 WHERE id=$2',[id('bootstrap'),draft.tasks[0].id])
  await test('foreign offering rejected by service',()=>assert.rejects(service.save(school,{...input,offering_id:otherOffering}),/FORBIDDEN/))
  await rejectSQL('database rejects foreign offering', 'UPDATE assessments SET offering_id=$1 WHERE id=$2',[otherOffering,draft.id],'23503')
  await rejectSQL('database rejects foreign type', 'UPDATE assessments SET assessment_type_id=$1 WHERE id=$2',[otherType,draft.id],'23503')
  await test('other-school access denied without membership',()=>assert.rejects(service.read(otherSchool),/FORBIDDEN/))
  const membership=await insert('school_memberships',{user_id:user,status:'active',joined_at:'2026-01-01'},otherSchool)
  await insert('membership_roles',{membership_id:membership,role_id:id('role-school_admin'),valid_from:'2026-01-01'},otherSchool)
  await test('dual-school admin cannot read or edit draft through foreign school',async()=>{ await assert.rejects(service.get(otherSchool,draft.id),/NOT_FOUND/); await assert.rejects(service.save(otherSchool,input,draft.id,Number(draft.row_version)),/FORBIDDEN/) })
  await rejectSQL('database rejects foreign task parent', 'INSERT INTO assessment_tasks (school_id,assessment_id,ordinal,title,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,1,\'Foreign\',$3,$3)',[otherSchool,draft.id,id('bootstrap')],'23503')
  const grade11=await insert('grades',{curriculum_code:'DEMO',code:'ASSESSMENT-G11',label:'Grade 11',ordinal:11},null)
  await insert('subject_grades',{subject_id:id('subject-math'),grade_id:grade11},null)
  const class11=await insert('class_groups',{academic_year_id:id('year'),grade_id:grade11,code:'ASSESSMENT-11',label:'Grade 11 assessment fixture'})
  const offering11=await insert('subject_offerings',{school_subject_id:id('school-subject-math'),class_group_id:class11,academic_year_id:id('year'),grade_id:grade11,subject_id:id('subject-math')})
  await test('grade 11 uses identical service and schema',async()=>{const d=await service.save(school,{...input,offering_id:offering11});assert.equal(d.offering_id,offering11);assert.equal(d.tasks.length,2)})
  // A separate year without terms makes the parent-edit test assessment-specific.
  const class2=await insert('class_groups',{academic_year_id:year2,grade_id:id('grade'),code:'ASSESSMENT-NEXT',label:'Next year'})
  const offering2=await insert('subject_offerings',{school_subject_id:id('school-subject-math'),class_group_id:class2,academic_year_id:year2,grade_id:id('grade'),subject_id:id('subject-math')})
  await service.save(school,{...input,offering_id:offering2,term_id:null,starts_on:null,due_on:'2027-12-31',tasks:[]})
  await rejectSQL('parent year edits cannot invalidate assessment dates', "UPDATE academic_years SET ends_on='2027-11-30' WHERE id=$1",[year2])
  await test('direct task change advances aggregate version and conflicts stale form',async()=>{
    const before=await service.get(school,draft.id)
    await client.query("UPDATE assessment_tasks SET title='Direct revision' WHERE assessment_id=$1 AND ordinal=1",[draft.id])
    assert.ok(Number((await service.get(school,draft.id)).row_version)>Number(before.row_version))
    await assert.rejects(service.save(school,input,draft.id,Number(before.row_version)),/CONFLICT/)
  })
  for (const who of ['teacher','moderator',null]) {
    user=who ? id(`user-${who}`) : null
    for (const [label,run] of [['read',()=>service.read(school)],['get',()=>service.get(school,draft.id)],['create',()=>service.save(school,input)],['edit',()=>service.save(school,input,draft.id,1)],['types',()=>service.initializeTypes(school)],['save type',()=>service.saveType(school,{code:'DENIED',name:'Denied',enabled:true})]]) if (who !== 'teacher' || !['create','edit'].includes(label)) await test(`${who ?? 'anonymous'} denied ${label}`,()=>assert.rejects(run(),new RegExp(who?'FORBIDDEN':'UNAUTHORIZED')))
  }
  user=id('user-admin')
  await test('inactive membership denied read and write',async()=>{
    await client.query('SAVEPOINT inactive')
    await client.query("UPDATE school_memberships SET status='suspended' WHERE id=$1",[id('membership-admin')])
    await assert.rejects(service.read(school),/FORBIDDEN/);await assert.rejects(service.save(school,input),/FORBIDDEN/)
    await client.query('ROLLBACK TO SAVEPOINT inactive')
  })
  await test('revoked admin role denied',async()=>{
    await client.query('SAVEPOINT revoked')
    await client.query('UPDATE membership_roles SET revoked_at=now() WHERE id=$1',[id('grant-admin')])
    await assert.rejects(service.read(school),/FORBIDDEN/);await assert.rejects(service.save(school,input),/FORBIDDEN/)
    await client.query('ROLLBACK TO SAVEPOINT revoked')
  })
  console.log(`Assessment integration PASS: ${passed} checks; all fixture mutations and audit events rolled back`)
} catch (error) { safeFailure(error) }
finally {
  await client.query('ROLLBACK')
  assert.equal((await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,baseline)
  client.release();await pool.end()
}
