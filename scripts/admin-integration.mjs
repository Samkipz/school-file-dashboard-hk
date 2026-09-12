import assert from 'node:assert/strict'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { administrationService } from '../lib/domain/administration.ts'
import { foundationService } from '../lib/domain/foundation.ts'

const pool = developmentPool()
const client = await pool.connect()
let passed = 0
try {
  await client.query('BEGIN')
  const baseline = (await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n
  let user = id('user-admin')
  const adapter = {
    query: (...args) => client.query(...args),
    connect: async () => ({ query: async (sql, values) => {
      if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return client.query('SAVEPOINT admin_operation')
      if (sql === 'COMMIT') { await client.query('SET CONSTRAINTS ALL IMMEDIATE'); await client.query('SET CONSTRAINTS ALL DEFERRED'); return client.query('RELEASE SAVEPOINT admin_operation') }
      if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT admin_operation')
      return client.query(sql, values)
    }, release() {} }),
  }
  const service = administrationService(adapter, async () => user)
  const foundation = foundationService(adapter, async () => user)
  const run = (op, fields) => service.execute(school, op, fields)
  async function test(label, action) { await action(); passed++; console.log(`PASS ${label}`) }
  const reject = (label, op, fields, code = 'INVALID_INPUT') => test(label, () => assert.rejects(run(op, fields), new RegExp(code)))
  const row = async (table, key) => (await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE school_id=$1 AND id=$2`, [school, key])).rows[0]?.row
  let learner, admission, enrolment, placement, destination, transferred, assignment, replacement
  await test('admin reads school-scoped administration data', async () => {
    const expected = (await client.query('SELECT count(*)::int AS n FROM learners WHERE school_id=$1 AND archived_at IS NULL', [school])).rows[0].n
    assert.equal((await service.read(school)).learners.length, expected)
  })
  await reject('required learner name', 'addLearner', { display_name: ' ' })
  await test('add learner', async () => { learner = await run('addLearner', { display_name: 'Workflow integration learner' }); assert.equal((await row('learners', learner)).display_name, 'Workflow integration learner') })
  await test('successful admission', async () => { admission = await run('admit', { learner_id: learner, admission_number: 'WORKFLOW-TEST', admitted_on: '2026-01-01' }); assert.equal((await row('learner_admissions', admission)).learner_id, learner) })
  await reject('duplicate active admission rejected', 'admit', { learner_id: learner, admission_number: 'WORKFLOW-TEST-2', admitted_on: '2026-01-01' }, 'CONFLICT')
  await reject('duplicate admission number rejected', 'admit', { learner_id: learner, admission_number: 'DEV-2026-001', admitted_on: '2026-01-01' }, 'CONFLICT')
  const enrolFields = { admission_id: admission, academic_year_id: id('year'), grade_id: id('grade'), starts_on: '2026-01-01' }
  await test('successful yearly enrolment', async () => { enrolment = await run('enrol', enrolFields); assert.equal((await row('learner_enrolments', enrolment)).ends_on, '2026-12-31') })
  await reject('duplicate yearly enrolment rejected', 'enrol', enrolFields, 'CONFLICT')
  await reject('enrolment outside year rejected', 'enrol', { ...enrolFields, starts_on: '2027-01-01' })
  await test('successful class placement', async () => { placement = await run('place', { enrolment_id: enrolment, class_group_id: id('class'), starts_on: '2026-01-01' }); assert.equal((await row('class_placements', placement)).enrolment_id, enrolment) })
  await reject('overlapping placement rejected', 'place', { enrolment_id: enrolment, class_group_id: id('class'), starts_on: '2026-02-01' })
  await test('subject enrolment', async () => { const s = await run('enrolSubject', { placement_id: placement, offering_id: id('offering-math'), starts_on: '2026-01-01' }); assert.equal((await row('learner_subject_enrolments', s)).placement_id, placement) })
  await reject('duplicate subject enrolment rejected', 'enrolSubject', { placement_id: placement, offering_id: id('offering-math'), starts_on: '2026-01-01' }, 'CONFLICT')
  await test('create destination class', async () => { destination = await run('saveClass', { academic_year_id: id('year'), grade_id: id('grade'), code: 'WORKFLOW-WEST', label: 'Workflow West', status: 'active' }) })
  await reject('same-class transfer rejected', 'transfer', { enrolment_id: enrolment, placement_id: placement, class_group_id: id('class'), starts_on: '2026-06-01' })
  await reject('transfer before placement start rejected', 'transfer', { enrolment_id: enrolment, placement_id: placement, class_group_id: destination, starts_on: '2025-12-31' })
  await test('transfer preserves placement and subject history', async () => {
    transferred = await run('transfer', { enrolment_id: enrolment, placement_id: placement, class_group_id: destination, starts_on: '2026-06-01' })
    assert.equal((await row('class_placements', placement)).ends_on, '2026-05-31')
    assert.equal((await row('class_placements', transferred)).starts_on, '2026-06-01')
    const subject = (await client.query('SELECT ends_on::text FROM learner_subject_enrolments WHERE school_id=$1 AND placement_id=$2', [school, placement])).rows[0]
    assert.equal(subject.ends_on, '2026-05-31')
  })
  await reject('old class subject rejected for new placement', 'enrolSubject', { placement_id: transferred, offering_id: id('offering-math'), starts_on: '2026-06-01' })
  let newOffering
  await test('create subject offering', async () => { newOffering = await run('createOffering', { class_group_id: destination, school_subject_id: id('school-subject-math') }) })
  await reject('duplicate offering rejected', 'createOffering', { class_group_id: destination, school_subject_id: id('school-subject-math') }, 'CONFLICT')
  await test('enrol transferred learner in destination subject', async () => { await run('enrolSubject', { placement_id: transferred, offering_id: newOffering, starts_on: '2026-06-01' }) })
  await test('teacher assignment creation', async () => { assignment = await run('assign', { staff_id: id('staff-teacher'), offering_id: newOffering, starts_on: '2026-01-01', ends_on: '2026-12-31' }); assert.equal((await row('teacher_assignments', assignment)).staff_id, id('staff-teacher')) })
  await reject('duplicate assignment rejected', 'assign', { staff_id: id('staff-teacher'), offering_id: newOffering, starts_on: '2026-02-01' })
  await reject('assignment reversed dates rejected', 'assign', { staff_id: id('staff-teacher'), offering_id: newOffering, starts_on: '2026-06-01', ends_on: '2026-05-01' })
  await reject('assignment outside year rejected', 'assign', { staff_id: id('staff-teacher'), offering_id: newOffering, starts_on: '2027-01-01' })
  await reject('staff without teacher role rejected', 'assign', { staff_id: id('staff-moderator'), offering_id: newOffering, starts_on: '2026-01-01' })
  await test('failed replacement rolls back old assignment', async () => {
    await assert.rejects(run('replaceAssignment', { assignment_id: assignment, staff_id: id('staff-moderator'), starts_on: '2026-07-01' }), /INVALID_INPUT/)
    assert.equal((await row('teacher_assignments', assignment)).ends_on, '2026-12-31')
  })
  // Give the second existing staff member a separate teacher grant in this rollback-only fixture.
  await client.query(`INSERT INTO membership_roles (school_id,membership_id,role_id,valid_from,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,'2026-01-01',$4,$4)`, [school, id('membership-admin'), id('role-teacher'), id('bootstrap')])
  await test('replacement preserves previous teacher history', async () => {
    replacement = await run('replaceAssignment', { assignment_id: assignment, staff_id: id('staff-admin'), starts_on: '2026-07-01', ends_on: '2026-12-31' })
    assert.equal((await row('teacher_assignments', assignment)).ends_on, '2026-06-30')
    assert.equal((await row('teacher_assignments', replacement)).starts_on, '2026-07-01')
    assert.equal((await row('teacher_assignments', replacement)).staff_id, id('staff-admin'))
  })
  await test('future termination preserves current teacher access', async () => {
    await run('endAssignment', { assignment_id: replacement, ends_on: '2026-12-30' })
    assert.equal((await row('teacher_assignments', replacement)).status, 'active')
  })
  await test('past termination retains row and ends assignment', async () => {
    await run('endAssignment', { assignment_id: replacement, ends_on: '2026-08-01' })
    assert.equal((await row('teacher_assignments', replacement)).status, 'ended')
  })
  let newYear
  await test('create and edit academic year', async () => {
    newYear = await run('saveYear', { code: 'WORKFLOW-2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'draft' })
    await run('saveYear', { id: newYear, code: 'WORKFLOW-2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'active' })
  })
  await test('create and edit term', async () => {
    const term = await run('saveTerm', { academic_year_id: newYear, code: 'TERM-1', ordinal: '1', starts_on: '2027-01-01', ends_on: '2027-04-30' })
    await run('saveTerm', { id: term, academic_year_id: newYear, code: 'TERM-ONE', ordinal: '1', starts_on: '2027-01-01', ends_on: '2027-04-30' })
  })
  await reject('term overlap rejected', 'saveTerm', { academic_year_id: newYear, code: 'OVERLAP', ordinal: '2', starts_on: '2027-04-01', ends_on: '2027-05-01' })
  await reject('term outside year rejected', 'saveTerm', { academic_year_id: newYear, code: 'OUTSIDE', ordinal: '3', starts_on: '2027-12-01', ends_on: '2028-01-01' })
  await reject('year edits cannot truncate existing term history', 'saveYear', { id: newYear, code: 'WORKFLOW-2027', starts_on: '2027-02-01', ends_on: '2027-12-31', status: 'active' })
  let wrongYearClass
  await test('create class in another academic year', async () => { wrongYearClass = await run('saveClass', { academic_year_id: newYear, grade_id: id('grade'), code: 'NEXT', label: 'Next Year Class', status: 'active' }) })
  await reject('wrong year placement rejected', 'place', { enrolment_id: enrolment, class_group_id: wrongYearClass, starts_on: '2026-06-01' })
  await test('disable and re-enable school subject', async () => {
    const fields = { id: id('school-subject-math'), local_code: 'MATH', display_name: 'Mathematics', enabled: 'false' }
    await run('saveSubject', fields); assert.equal((await row('school_subjects', id('school-subject-math'))).enabled, false)
    await run('saveSubject', { ...fields, enabled: 'true' })
  })
  const catalogueSubject = id('workflow-catalogue-subject')
  await client.query(`INSERT INTO subject_catalogue (id,curriculum_code,code,name,created_by_actor_id,updated_by_actor_id) VALUES ($1,'DEMO','WORKFLOW','Workflow subject',$2,$2)`, [catalogueSubject, id('bootstrap')])
  let schoolSubject
  await test('enable a catalogue subject for the school', async () => {
    schoolSubject = await run('saveSubject', { subject_id: catalogueSubject, local_code: 'WORKFLOW', display_name: 'Workflow subject', enabled: 'true' })
    assert.equal((await row('school_subjects', schoolSubject)).enabled, true)
  })
  await reject('subject not applicable to class grade rejected', 'createOffering', { class_group_id: destination, school_subject_id: schoolSubject })
  await test('rename and close a class without deleting history', async () => {
    await run('saveClass', { id: wrongYearClass, code: 'NEXT', label: 'Renamed Next Year Class', status: 'closed' })
    assert.equal((await row('class_groups', wrongYearClass)).label, 'Renamed Next Year Class')
  })
  await reject('offering in closed class rejected', 'createOffering', { class_group_id: wrongYearClass, school_subject_id: id('school-subject-math') })
  await test('closed school subject blocks new offerings', async () => {
    await run('saveSubject', { id: schoolSubject, local_code: 'WORKFLOW', display_name: 'Workflow subject', enabled: 'false' })
    await assert.rejects(run('createOffering', { class_group_id: destination, school_subject_id: schoolSubject }), /INVALID_INPUT/)
  })
  const otherSchool = id('workflow-other-school')
  const foreignLearner = id('workflow-foreign-learner')
  await client.query(`INSERT INTO schools (id,code,name,created_by_actor_id,updated_by_actor_id) VALUES ($1,'WORKFLOW-OTHER','Other School',$2,$2)`, [otherSchool, id('bootstrap')])
  await client.query(`INSERT INTO learners (id,school_id,display_name,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,'Foreign Learner',$3,$3)`, [foreignLearner, otherSchool, id('bootstrap')])
  await test('cross-school admin read rejected', () => assert.rejects(service.read(otherSchool), /FORBIDDEN/))
  await test('caller-supplied foreign school rejected', () => assert.rejects(service.execute(otherSchool, 'addLearner', { display_name: 'Attack' }), /FORBIDDEN/))
  await reject('foreign learner reference with own school rejected', 'admit', { learner_id: foreignLearner, admission_number: 'ATTACK', admitted_on: '2026-01-01' }, 'NOT_FOUND')
  for (const role of ['teacher', 'moderator']) {
    user = id(`user-${role}`)
    await test(`${role} cannot read administration`, () => assert.rejects(service.read(school), /FORBIDDEN/))
    await reject(`${role} cannot add learners`, 'addLearner', { display_name: 'Attack' }, 'FORBIDDEN')
    await reject(`${role} cannot assign teachers`, 'assign', {}, 'FORBIDDEN')
  }
  user = id('user-teacher')
  await test('teacher cannot read ended assignment roster', () => assert.rejects(foundation.getOfferingRoster(school, newOffering), /NOT_FOUND/))
  user = id('user-admin')
  await test('admin can read transferred roster', async () => assert.ok((await foundation.getOfferingRoster(school, newOffering)).some(l => l.id === learner)))
  await test('close offering retains assignment and learner history', async () => {
    await run('closeOffering', { id: newOffering })
    assert.equal((await row('subject_offerings', newOffering)).status, 'closed')
    assert.ok(await row('teacher_assignments', assignment))
    assert.ok(await row('class_placements', transferred))
  })
  await test('meaningful mutations have safe grouped audit records', async () => {
    const audit = (await client.query("SELECT event_type, count(*)::int AS n FROM audit_events WHERE school_id=$1 AND event_type LIKE 'academics.%' GROUP BY event_type", [school])).rows
    assert.ok(audit.find(r => r.event_type === 'academics.transfer' && r.n === 3))
    assert.ok(audit.find(r => r.event_type === 'academics.replaceAssignment' && r.n === 2))
    assert.ok(audit.find(r => r.event_type === 'academics.admit' && r.n === 1))
  })
  await test('audit failure rolls back all workflow changes', async () => {
    const failing = { ...adapter, connect: async () => { const c = await adapter.connect(); return { ...c, query: (sql, values) => sql.startsWith('INSERT INTO audit_events') ? Promise.reject(new Error('audit unavailable')) : c.query(sql, values) } } }
    await assert.rejects(administrationService(failing, async () => user).execute(school, 'addLearner', { display_name: 'Audit rollback learner' }), /audit unavailable/)
    assert.equal((await client.query("SELECT count(*)::int AS n FROM learners WHERE display_name='Audit rollback learner'")).rows[0].n, 0)
  })
  await client.query('ROLLBACK')
  assert.equal((await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n, baseline)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM learners WHERE id=$1', [learner])).rows[0].n, 0)
  console.log(`Administration integration PASS: ${passed} checks; database state verified; all test changes rolled back`)
} catch (error) { await client.query('ROLLBACK'); safeFailure(error) } finally { client.release(); await pool.end() }
