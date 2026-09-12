import assert from 'node:assert/strict'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { administrationService } from '../lib/domain/administration.ts'
import { foundationService } from '../lib/domain/foundation.ts'

const pool = developmentPool()
const client = await pool.connect()
let passed = 0, user = id('user-admin')
const adapter = {
  connect: async () => ({ query: async (sql, values) => {
    if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return client.query('SAVEPOINT lifecycle_operation')
    if (sql === 'COMMIT') { await client.query('SET CONSTRAINTS ALL IMMEDIATE'); await client.query('SET CONSTRAINTS ALL DEFERRED'); return client.query('RELEASE SAVEPOINT lifecycle_operation') }
    if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT lifecycle_operation')
    return client.query(sql, values)
  }, release() {} }),
}
const service = administrationService(adapter, async () => user)
const run = (op, input) => service.execute(school, op, input)
const row = async (table, key) => (await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE school_id=$1 AND id=$2`, [school, key])).rows[0]?.row
const test = async (label, fn) => { await fn(); passed++; console.log(`PASS ${label}`) }
const reject = (label, op, fields, code = 'INVALID_INPUT') => test(label, () => assert.rejects(run(op, fields), new RegExp(code)))
const counts = async () => (await client.query(`SELECT (SELECT count(*) FROM learner_enrolments)::int AS enrolments,(SELECT count(*) FROM class_placements)::int AS placements,(SELECT count(*) FROM learner_subject_enrolments)::int AS subjects,(SELECT count(*) FROM teacher_assignments)::int AS assignments,(SELECT count(*) FROM audit_events)::int AS audits`)).rows[0]
const preview = async fields => JSON.parse(await run('previewRollover', fields))
const commit = (fields, p) => run('commitRollover', { ...fields, preview_token: p.token, confirmed: 'true' })
try {
  await client.query('BEGIN')
  const baseline = await counts()
  const today = (await client.query("SELECT (now() AT TIME ZONE 'Africa/Nairobi')::date::text AS today")).rows[0].today
  const exit = { learner_id: id('learner-1'), effective_on: '2026-06-01', reason: 'Moved school' }
  const beforePlacement = await row('class_placements', id('placement-1'))
  const beforeAssignment = await row('teacher_assignments', id('assignment-math'))
  await reject('withdrawal requires reason', 'withdrawLearner', { ...exit, reason: '' })
  await reject('withdrawal rejects future date', 'withdrawLearner', { ...exit, effective_on: '2099-01-01' })
  await reject('withdrawal rejects date before admission', 'withdrawLearner', { ...exit, effective_on: '2025-12-31' })
  await test('successful withdrawal closes admission, enrolment, placement and subjects', async () => {
    await run('withdrawLearner', exit)
    assert.equal((await row('learners', exit.learner_id)).status, 'left')
    assert.equal((await row('learner_admissions', id('admission-1'))).left_on, exit.effective_on)
    assert.equal((await row('learner_admissions', id('admission-1'))).status, 'closed')
    assert.equal((await row('learner_enrolments', id('enrolment-1'))).status, 'withdrawn')
    assert.equal((await row('learner_enrolments', id('enrolment-1'))).ends_on, exit.effective_on)
    assert.equal((await row('class_placements', id('placement-1'))).ends_on, exit.effective_on)
    for (const key of ['math', 'english', 'biology']) {
      const s = await row('learner_subject_enrolments', id(`subject-enrolment-1-${key}`))
      assert.equal(s.status, 'withdrawn'); assert.equal(s.ends_on, exit.effective_on)
    }
    const after = await row('class_placements', id('placement-1'))
    assert.equal(after.starts_on, beforePlacement.starts_on); assert.equal(after.created_at, beforePlacement.created_at)
    assert.deepEqual(await row('teacher_assignments', id('assignment-math')), beforeAssignment)
  })
  await test('withdrawn learners disappear from current offering roster', async () => {
    const roster = await foundationService(adapter, async () => user).getOfferingRoster(school, id('offering-math'))
    assert.ok(!roster.some(l => l.id === exit.learner_id))
  })
  await reject('repeat withdrawal rejected', 'withdrawLearner', exit, 'CONFLICT')
  await reject('normal admission blocked after withdrawal', 'admit', { learner_id: exit.learner_id, admitted_on: '2026-07-01', admission_number: 'BLOCKED' })
  const readmit = { learner_id: exit.learner_id, effective_on: '2026-07-01', admission_number: 'LIFECYCLE-READMIT', reason: 'Returned to school' }
  await reject('re-admission cannot overlap prior admission', 'readmitLearner', { ...readmit, effective_on: '2026-06-01' })
  await test('re-admission creates new admission and retains closed history', async () => {
    const old = await row('learner_admissions', id('admission-1'))
    const newId = await run('readmitLearner', readmit)
    assert.notEqual(newId, old.id)
    assert.equal((await row('learners', exit.learner_id)).status, 'active')
    assert.deepEqual(await row('learner_admissions', old.id), old)
    assert.equal((await row('learner_enrolments', id('enrolment-1'))).status, 'withdrawn')
    await assert.rejects(run('enrol', { admission_id: newId, academic_year_id: id('year'), grade_id: id('grade'), starts_on: '2026-07-01' }), /CONFLICT/)
  })
  await reject('active learner cannot be re-admitted again', 'readmitLearner', readmit, 'CONFLICT')
  const complete = { learner_id: id('learner-2'), effective_on: '2026-06-30', reason: 'Programme completed' }
  await test('completion closes academic records and sets completed status', async () => {
    await run('completeLearner', complete)
    assert.equal((await row('learners', complete.learner_id)).status, 'completed')
    assert.equal((await row('learner_enrolments', id('enrolment-2'))).status, 'completed')
    assert.equal((await row('learner_subject_enrolments', id('subject-enrolment-2-math'))).status, 'completed')
    assert.equal((await row('class_placements', id('placement-2'))).ends_on, complete.effective_on)
  })
  await reject('repeated completion rejected', 'completeLearner', complete, 'CONFLICT')
  await reject('normal enrolment blocked after completion', 'enrol', { admission_id: id('admission-2'), academic_year_id: id('year'), grade_id: id('grade'), starts_on: '2026-07-01' })
  await test('completed learner may be explicitly re-admitted', async () => {
    await run('readmitLearner', { ...readmit, learner_id: complete.learner_id, admission_number: 'LIFECYCLE-COMPLETE-RETURN' })
    assert.equal((await row('learners', complete.learner_id)).status, 'active')
  })
  const nextYear = await run('saveYear', { code: 'LIFECYCLE-2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'active' })
  const nextGrade = id('lifecycle-grade-11')
  await client.query(`INSERT INTO grades (id,curriculum_code,code,label,ordinal,created_by_actor_id,updated_by_actor_id) VALUES ($1,'DEMO','LIFECYCLE-G11','Grade 11',11,$2,$2)`, [nextGrade, id('bootstrap')])
  await client.query(`INSERT INTO subject_grades (subject_id,grade_id,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,$3)`, [id('subject-math'), nextGrade, id('bootstrap')])
  const promotedClass = await run('saveClass', { academic_year_id: nextYear, grade_id: nextGrade, code: 'LIFE11', label: 'Lifecycle Grade 11', status: 'active' })
  const repeatClass = await run('saveClass', { academic_year_id: nextYear, grade_id: id('grade'), code: 'LIFE10', label: 'Lifecycle Grade 10', status: 'active' })
  const nextMath = await run('createOffering', { class_group_id: promotedClass, school_subject_id: id('school-subject-math') })
  await run('createOffering', { class_group_id: repeatClass, school_subject_id: id('school-subject-math') })
  const selection = [{ enrolment_id: id('enrolment-3'), outcome: 'promote', class_group_id: promotedClass }, { enrolment_id: id('enrolment-4'), outcome: 'repeat', class_group_id: repeatClass }]
  const fields = { source_year_id: id('year'), destination_year_id: nextYear, selections: JSON.stringify(selection), copy_teachers: 'true' }
  await reject('invalid grade progression rejected', 'previewRollover', { ...fields, selections: JSON.stringify([{ ...selection[0], class_group_id: repeatClass }]) })
  await reject('invalid destination class year rejected', 'previewRollover', { ...fields, selections: JSON.stringify([{ ...selection[1], class_group_id: id('class') }]) })
  await reject('same source and destination rejected', 'previewRollover', { ...fields, destination_year_id: id('year') })
  await test('inactive destination rejected', async () => {
    await run('saveYear', { id: nextYear, code: 'LIFECYCLE-2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'draft' })
    await assert.rejects(preview(fields), /INVALID_INPUT/)
    await run('saveYear', { id: nextYear, code: 'LIFECYCLE-2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'active' })
  })
  await test('preview has no mutations and identifies carried/omitted subjects and teachers', async () => {
    const before = await counts(), p = await preview(fields)
    assert.deepEqual(await counts(), before)
    assert.equal(p.learners.length, 2)
    assert.deepEqual(p.learners[0].subjects, ['Mathematics'])
    assert.equal(p.learners[0].skippedSubjects.length, 2)
    assert.equal(p.teachers.length, 2)
  })
  await reject('commit requires explicit confirmation', 'commitRollover', { ...fields, preview_token: (await preview(fields)).token })
  await test('stale preview rejected after destination changes', async () => {
    const p = await preview(fields)
    await run('saveClass', { id: promotedClass, code: 'LIFE11', label: 'Lifecycle Grade Eleven', status: 'active' })
    await assert.rejects(commit(fields, p), /CONFLICT/)
  })
  await test('late teacher assignment failure rolls back every selected learner and audit', async () => {
    const before = await counts(), p = await preview(fields)
    const failing = { connect: async () => { const c = await adapter.connect(); return { ...c, query: (sql, values) => sql.startsWith('INSERT INTO teacher_assignments') ? Promise.reject(new Error('Injected late failure')) : c.query(sql, values) } } }
    await assert.rejects(administrationService(failing, async () => user).execute(school, 'commitRollover', { ...fields, preview_token: p.token, confirmed: 'true' }), /Injected late failure/)
    assert.deepEqual(await counts(), before)
  })
  await test('promotion, repeat, destination placement, subjects and teachers succeed together', async () => {
    const sourceBefore = await row('learner_enrolments', id('enrolment-3'))
    const placementBefore = await row('class_placements', id('placement-3'))
    const subjectBefore = await row('learner_subject_enrolments', id('subject-enrolment-3-math'))
    const result = JSON.parse(await commit(fields, await preview(fields)))
    assert.deepEqual(result, { learners: 2, enrolments: 2, placements: 2, subjects: 2, teacherAssignments: 2, completed: 0, withdrawn: 0 })
    const destinationRows = (await client.query('SELECT id,learner_id,grade_id FROM learner_enrolments WHERE school_id=$1 AND academic_year_id=$2', [school, nextYear])).rows
    assert.equal(destinationRows.find(e => e.learner_id === id('learner-3')).grade_id, nextGrade)
    assert.equal(destinationRows.find(e => e.learner_id === id('learner-4')).grade_id, id('grade'))
    assert.equal((await client.query('SELECT count(*)::int AS n FROM class_placements WHERE school_id=$1 AND academic_year_id=$2', [school, nextYear])).rows[0].n, 2)
    assert.equal((await client.query('SELECT count(*)::int AS n FROM teacher_assignments WHERE school_id=$1 AND offering_id=$2', [school, nextMath])).rows[0].n, 1)
    assert.deepEqual(await row('learner_enrolments', id('enrolment-3')), sourceBefore)
    assert.deepEqual(await row('class_placements', id('placement-3')), placementBefore)
    assert.deepEqual(await row('learner_subject_enrolments', id('subject-enrolment-3-math')), subjectBefore)
    assert.deepEqual(await row('teacher_assignments', id('assignment-math')), beforeAssignment)
  })
  await reject('repeated rollover preview rejected', 'previewRollover', fields, 'CONFLICT')
  await reject('repeated rollover commit rejected', 'commitRollover', { ...fields, confirmed: 'true', preview_token: 'old' }, 'CONFLICT')
  await reject('withdrawal with future scheduled destination records rejected cleanly', 'withdrawLearner', { ...exit, learner_id: id('learner-3'), effective_on: today })

  // A separate learner exercises terminal rollover and fully historical enrolments.
  const historyYear = await run('saveYear', { code: 'LIFECYCLE-2025', starts_on: '2025-01-01', ends_on: '2025-12-31', status: 'active' })
  async function newLearner(number) {
    const learner = await run('addLearner', { display_name: `Lifecycle history ${number}` })
    const admission = await run('admit', { learner_id: learner, admission_number: `LIFE-HISTORY-${number}`, admitted_on: '2025-01-01' })
    const old = await run('enrol', { admission_id: admission, academic_year_id: historyYear, grade_id: id('grade'), starts_on: '2025-01-01' })
    const current = await run('enrol', { admission_id: admission, academic_year_id: id('year'), grade_id: id('grade'), starts_on: '2026-01-01' })
    return { learner, old, current }
  }
  const one = await newLearner(1), two = await newLearner(2)
  await test('bulk completion and withdrawal preserve already-ended historical records', async () => {
    const old = await row('learner_enrolments', one.old)
    const terminal = { ...fields, copy_teachers: 'false', selections: JSON.stringify([{ enrolment_id: one.current, outcome: 'complete', effective_on: '2026-06-01', reason: 'Finished programme' }, { enrolment_id: two.current, outcome: 'withdraw', effective_on: '2026-06-01', reason: 'Transferred school' }]) }
    const result = JSON.parse(await commit(terminal, await preview(terminal)))
    assert.equal(result.completed, 1); assert.equal(result.withdrawn, 1); assert.equal(result.enrolments, 0)
    assert.deepEqual(await row('learner_enrolments', one.old), old)
    assert.equal((await row('learners', one.learner)).status, 'completed')
  })
  await test('lifecycle audit keeps reason, effective date, previous and next status', async () => {
    const history = (await service.read(school)).lifecycle_history.filter(h => h.learner_id === exit.learner_id)
    assert.equal(history.length, 2)
    assert.ok(history.some(h => h.from_status === 'active' && h.to_status === 'left' && h.reason === exit.reason && h.effective_on === exit.effective_on))
    const changes = (await client.query("SELECT safe_changes FROM audit_events WHERE school_id=$1 AND resource_id=$2 AND event_type='academics.withdrawLearner'", [school, id('placement-1')])).rows[0].safe_changes
    assert.equal(changes.before.ends_on, '2026-12-31'); assert.equal(changes.after.ends_on, exit.effective_on)
  })
  const foreignSchool = id('lifecycle-other-school'), foreignLearner = id('lifecycle-foreign-learner')
  await client.query(`INSERT INTO schools (id,code,name,created_by_actor_id,updated_by_actor_id) VALUES ($1,'LIFE-OTHER','Other School',$2,$2)`, [foreignSchool, id('bootstrap')])
  await client.query(`INSERT INTO learners (id,school_id,display_name,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,'Foreign Learner',$3,$3)`, [foreignLearner, foreignSchool, id('bootstrap')])
  await reject('cross-school learner reference rejected', 'withdrawLearner', { ...exit, learner_id: foreignLearner }, 'NOT_FOUND')
  await test('cross-school execution rejected', () => assert.rejects(service.execute(foreignSchool, 'previewRollover', fields), /FORBIDDEN/))
  for (const role of ['teacher', 'moderator']) {
    user = id(`user-${role}`)
    for (const op of ['withdrawLearner', 'completeLearner', 'readmitLearner', 'previewRollover', 'commitRollover']) await reject(`${role} cannot ${op}`, op, {}, 'FORBIDDEN')
  }
  user = null
  await reject('anonymous access rejected', 'withdrawLearner', exit, 'UNAUTHORIZED')
  await client.query('ROLLBACK')
  assert.deepEqual(await counts(), baseline)
  console.log(`Learner lifecycle integration PASS: ${passed} checks; all fixture changes rolled back`)
} catch (error) { await client.query('ROLLBACK'); safeFailure(error) } finally { client.release(); await pool.end() }
