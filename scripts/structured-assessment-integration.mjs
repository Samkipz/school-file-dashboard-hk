import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { assessmentService } from '../lib/domain/assessments.ts'

const pool = developmentPool()
pool.options.connectionTimeoutMillis = 15000
pool.options.query_timeout = 120000
const client = await pool.connect()
let user = id('user-admin'), fault = false, passed = 0
try {
  await client.query('BEGIN')
  await client.query("SET LOCAL statement_timeout='60s'")
  const fingerprint = async () => (await client.query(`SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text,'')) AS hash FROM assessments a`)).rows[0].hash
  if (process.argv.includes('--review-forward')) {
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'))
    const history = (await client.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
    assert.equal(history.length, 7)
    for (const [i, entry] of journal.entries.slice(0, 7).entries()) assert.equal(history[i].hash, createHash('sha256').update(readFileSync(`drizzle/${entry.tag}.sql`)).digest('hex'))
    const before = (await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS rows FROM assessment_tasks t')).rows[0]
    for (const name of ['0007_structured_assessments','0008_structured_guards']) { console.log('Reviewing ' + name); for (const statement of readFileSync(`drizzle/${name}.sql`, 'utf8').split('--> statement-breakpoint')) await client.query(statement) }
    assert.deepEqual((await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS rows FROM assessment_tasks t')).rows[0], before)
    console.log('PASS upgrade preserves task rows and verifies historical migration hashes')
  }
  const baseline = await fingerprint()
  const adapter = { connect: async () => ({ query: async (sql, values) => {
    if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return client.query('SAVEPOINT structured_operation')
    if (sql === 'COMMIT') { await client.query('SET CONSTRAINTS ALL IMMEDIATE'); await client.query('SET CONSTRAINTS ALL DEFERRED'); return client.query('RELEASE SAVEPOINT structured_operation') }
    if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT structured_operation')
    if (fault && sql.includes('INSERT INTO audit_events')) throw new Error('Injected audit failure')
    return client.query(sql, values)
  }, release() {} }) }
  const service = assessmentService(adapter, async () => user)
  const test = async (label, run) => { await run(); passed++; console.log(`PASS ${label}`) }
  console.log('Checking service commands')
  await service.initializeTypes(school)
  const type = (await service.read(school)).types[0].id
  const input = { title: 'Synthetic structured practical', offering_id: id('offering-math'), assessment_type_id: type,
    tasks: [{ title: 'Capture photograph', criteria: [{ title: 'Composition', indicators: [{ descriptor: 'Clear', score: '3.25' }, { descriptor: 'Partial', score: '1.10' }, { descriptor: 'Not demonstrated', score: '0' }] }] }],
    levels: [{ code: '1', descriptor: 'Developing', lower: '0', upper: '1.10' }, { code: '2', descriptor: 'Secure', lower: '1.11', upper: '3.25' }] }
  user = id('user-teacher')
  let draft
  await test('assigned teacher creates and reads structured draft', async () => { draft = await service.save(school, input); assert.equal(draft.tasks[0].criteria[0].indicators[0].score,'3.25'); assert.ok((await service.readOffering(school,input.offering_id)).drafts.some(d => d.id === draft.id)) })
  await test('teacher cannot use admin type management or school-wide planning', async () => { await assert.rejects(service.read(school), /FORBIDDEN/); await assert.rejects(service.initializeTypes(school), /FORBIDDEN/) })
  await test('forged and foreign school/offering IDs denied', async () => {
    await assert.rejects(service.save(school,{ ...input, offering_id: randomUUID() }), /FORBIDDEN/)
    await assert.rejects(service.save(randomUUID(),input), /FORBIDDEN/)
    await assert.rejects(service.readOffering(school,randomUUID()), /FORBIDDEN/)
  })
  await test('teacher denied a real foreign-school offering', async () => {
    const insert = async (table, fields, tenant) => {
      const row={id:randomUUID(),...(tenant?{school_id:tenant}:{}),created_by_actor_id:id('bootstrap'),updated_by_actor_id:id('bootstrap'),...fields}
      const keys=Object.keys(row)
      await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(row))
      return row.id
    }
    const foreignSchool=await insert('schools',{code:'STRUCTURED-FOREIGN',name:'Synthetic foreign school'})
    const year=await insert('academic_years',{code:'2026',starts_on:'2026-01-01',ends_on:'2026-12-31',status:'active'},foreignSchool)
    const group=await insert('class_groups',{academic_year_id:year,grade_id:id('grade'),code:'FOREIGN',label:'Foreign class'},foreignSchool)
    const subject=await insert('school_subjects',{subject_id:id('subject-math'),local_code:'MATH',display_name:'Math'},foreignSchool)
    const offering=await insert('subject_offerings',{school_subject_id:subject,class_group_id:group,academic_year_id:year,grade_id:id('grade'),subject_id:id('subject-math')},foreignSchool)
    await assert.rejects(service.readOffering(school,offering),/FORBIDDEN/)
    await assert.rejects(service.save(school,{...input,offering_id:offering}),/FORBIDDEN/)
    await assert.rejects(service.readOffering(foreignSchool,offering),/FORBIDDEN/)
  })
  await test('unassigned teacher cannot read, save or open', async () => {
    await client.query('SAVEPOINT revoke_assignment')
    await client.query("UPDATE teacher_assignments SET status='revoked' WHERE school_id=$1 AND offering_id=$2",[school,input.offering_id])
    try { for (const run of [() => service.readOffering(school,input.offering_id), () => service.save(school,draft,draft.id,Number(draft.row_version)), () => service.open(school,draft.id,Number(draft.row_version))]) await assert.rejects(run(),/FORBIDDEN/) }
    finally { await client.query('ROLLBACK TO SAVEPOINT revoke_assignment') }
  })
  await test('indicator reorder preserves identity and exact scores', async () => {
    const ids = draft.tasks[0].criteria[0].indicators.map(i => i.id)
    draft.tasks[0].criteria[0].indicators.reverse()
    draft = await service.save(school,draft,draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks[0].criteria[0].indicators.map(i => i.id), ids.reverse())
  })
  await test('forged criterion and indicator IDs rejected', async () => {
    for (const change of [d => { d.tasks[0].criteria[0].id=randomUUID() }, d => { d.tasks[0].criteria[0].indicators[0].id=randomUUID() }]) {
      const attack = structuredClone(draft); change(attack)
      await assert.rejects(service.save(school,attack,draft.id,Number(draft.row_version)),/INVALID_INPUT/)
    }
  })
  await test('criteria and tasks reorder with stable identities', async () => {
    draft = await service.save(school,{ ...draft, levels: [], tasks: [...draft.tasks, { title:'Explain choices', criteria:[{title:'Clarity',indicators:[{descriptor:'Clear',score:'2'},{descriptor:'Not demonstrated',score:'0'}]},{title:'Reasoning',indicators:[{descriptor:'Supported',score:'1.50'},{descriptor:'Not demonstrated',score:'0'}]}] }] },draft.id,Number(draft.row_version))
    const taskIds=draft.tasks.map(t=>t.id), criterionIds=draft.tasks[1].criteria.map(c=>c.id)
    draft.tasks[1].criteria.reverse(); draft.tasks.reverse()
    draft = await service.save(school,draft,draft.id,Number(draft.row_version))
    assert.deepEqual(draft.tasks.map(t=>t.id),taskIds.reverse())
    assert.deepEqual(draft.tasks[0].criteria.map(c=>c.id),criterionIds.reverse())
    assert.equal(draft.maximum_score,'6.75')
    draft = await service.save(school,{...draft,tasks:[draft.tasks[1]],levels:input.levels},draft.id,Number(draft.row_version))
    assert.equal(draft.maximum_score,'3.25')
  })
  await test('invalid scores and scale gaps rejected', async () => {
    const attack = structuredClone(draft); attack.tasks[0].criteria[0].indicators[0].score='-1'
    await assert.rejects(service.save(school,attack,draft.id,Number(draft.row_version)),/INVALID_INPUT/)
    await assert.rejects(service.save(school,{ ...draft, levels: [{ descriptor:'Gap',lower:'1',upper:'3.25' }] },draft.id,Number(draft.row_version)),/INVALID_INPUT/)
  })
  await test('generic external origin persists and requires authority', async () => {
    const external = await service.save(school,{...input,origin:'external',authority:'Synthetic authority',external_reference:'REF-1'})
    assert.equal(external.authority,'Synthetic authority'); assert.equal(external.external_reference,'REF-1')
    await assert.rejects(service.save(school,{...input,origin:'external'}),/INVALID_INPUT/)
    await assert.rejects(service.save(school,{...input,origin:'internal',authority:'Synthetic authority'}),/INVALID_INPUT/)
  })
  await test('database rejects invalid score, range overlap and incomplete opening', async () => {
    for (const [sql, values] of [
      ['UPDATE assessment_indicators SET score_units=-1 WHERE id=$1',[draft.tasks[0].criteria[0].indicators[0].id]],
      ['UPDATE assessment_levels SET lower_units=0 WHERE assessment_id=$1 AND ordinal=2',[draft.id]],
      ['UPDATE assessment_levels SET lower_units=112 WHERE assessment_id=$1 AND ordinal=2',[draft.id]],
      ['UPDATE assessment_criteria SET ordinal=2 WHERE id=$1',[draft.tasks[0].criteria[0].id]],
    ]) {
      await client.query('SAVEPOINT invalid_definition')
      try { await assert.rejects(async()=>{ await client.query(sql,values); await client.query('SET CONSTRAINTS ALL IMMEDIATE') },e=>['23514','23505'].includes(e.code)) }
      finally { await client.query('ROLLBACK TO SAVEPOINT invalid_definition') }
    }
    const empty=await service.save(school,{...input,tasks:[],levels:[]})
    await client.query('SAVEPOINT invalid_open')
    try { await assert.rejects(async()=>{ await client.query("UPDATE assessments SET status='open',opened_at=now(),opened_by_actor_id=$2 WHERE id=$1",[empty.id,id('bootstrap')]); await client.query('SET CONSTRAINTS ALL IMMEDIATE') },e=>e.code==='23514') }
    finally { await client.query('ROLLBACK TO SAVEPOINT invalid_open') }
  })
  await test('audit failure rolls back structural edits and opening', async () => {
    fault=true
    try { await assert.rejects(service.save(school,{ ...draft,title:'Rollback' },draft.id,Number(draft.row_version)),/Injected/); await assert.rejects(service.open(school,draft.id,Number(draft.row_version)),/Injected/) } finally { fault=false }
    assert.equal((await service.readOffering(school,input.offering_id)).drafts.find(d=>d.id===draft.id).status,'draft')
  })
  await test('stale opening denied', () => assert.rejects(service.open(school,draft.id,1),/CONFLICT/))
  await test('incomplete draft cannot open', async () => { const d=await service.save(school,{ ...input,tasks:[],levels:[] }); await assert.rejects(service.open(school,d.id,Number(d.row_version)),/INVALID_INPUT/) })
  user=id('user-admin')
  await test('admin can edit teacher-created definition', async () => { draft=await service.save(school,{ ...draft,title:'Admin reviewed' },draft.id,Number(draft.row_version)) })
  await test('mixed admin teacher retains admin authority without a teaching assignment', async () => {
    await client.query('SAVEPOINT mixed_role')
    await client.query(`INSERT INTO membership_roles (school_id,membership_id,role_id,valid_from,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,'2026-01-01',$4,$4)`,[school,id('membership-admin'),id('role-teacher'),id('bootstrap')])
    try { assert.ok((await service.readOffering(school,input.offering_id)).drafts.some(d=>d.id===draft.id)) }
    finally { await client.query('ROLLBACK TO SAVEPOINT mixed_role') }
  })
  user=id('user-teacher')
  await test('valid draft opens and records lifecycle audit', async () => { draft=await service.open(school,draft.id,Number(draft.row_version)); assert.equal(draft.status,'open'); assert.equal((await client.query("SELECT count(*)::int n FROM audit_events WHERE resource_id=$1 AND event_type='assessment.opened'",[draft.id])).rows[0].n,1) })
  await test('open definition rejects normal editing and repeated opening', async () => { await assert.rejects(service.save(school,draft,draft.id,Number(draft.row_version)),/CONFLICT/); await assert.rejects(service.open(school,draft.id,Number(draft.row_version)),/CONFLICT/) })
  await test('database denies open structural edits independently of service', async () => {
    for (const [sql, values] of [
      ['UPDATE assessments SET title=$2 WHERE id=$1',[draft.id,'Attack']],
      ['DELETE FROM assessment_tasks WHERE id=$1',[draft.tasks[0].id]],
      ['UPDATE assessment_criteria SET title=$2 WHERE id=$1',[draft.tasks[0].criteria[0].id,'Attack']],
      ['UPDATE assessment_indicators SET score_units=2 WHERE id=$1',[draft.tasks[0].criteria[0].indicators[0].id]],
      ['DELETE FROM assessment_levels WHERE assessment_id=$1',[draft.id]],
    ]) {
      await client.query('SAVEPOINT invalid_structure')
      try { await assert.rejects(client.query(sql,values), e => ['23514','23503'].includes(e.code)) } finally { await client.query('ROLLBACK TO SAVEPOINT invalid_structure') }
    }
  })
  assert.notEqual(await fingerprint(),baseline)
  console.log(`Structured assessment integration PASS: ${passed} checks; all mutations rolled back`)
} catch (error) { safeFailure(error) } finally { await client.query('ROLLBACK'); client.release(); await pool.end() }
