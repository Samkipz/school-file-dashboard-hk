import assert from 'node:assert/strict'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
import { foundationService } from '../lib/domain/foundation.ts'

const pool = developmentPool()
let passed = 0
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const actor = id('bootstrap')
  const school2 = id('test-school-2')
  await client.query(`INSERT INTO schools (id,code,name,timezone,created_by_actor_id,updated_by_actor_id) VALUES ($1,'TEST-SECOND','Transient second school','Africa/Nairobi',$2,$2)`, [school2,actor])
  async function rejectSql(label, sql, values, expected = '23514') {
    await client.query('SAVEPOINT negative_case')
    let error
    try { await client.query(sql,values); await client.query('SET CONSTRAINTS ALL IMMEDIATE') } catch (e) { error = e }
    await client.query('ROLLBACK TO SAVEPOINT negative_case')
    assert.equal(error?.code,expected,label)
    console.log(`PASS ${label}`); passed++
  }
  async function clone(table, key, changes) {
    const names = Object.keys(changes)
    const row = (await client.query(`SELECT * FROM "${table}" WHERE id=$1`,[id(key)])).rows[0]
    assert.ok(row)
    return { sql: `INSERT INTO "${table}" SELECT (jsonb_populate_record(NULL::"${table}", to_jsonb(t) || $2::jsonb)).* FROM "${table}" t WHERE id=$1`, values: [row.id,JSON.stringify(Object.fromEntries(names.map(n=>[n,changes[n]])))] }
  }
  async function rejectClone(label,table,key,changes,code) { const q = await clone(table,key,changes); await rejectSql(label,q.sql,q.values,code) }
  await rejectClone('cross-school staff membership FK','staff_profiles','staff-teacher',{id:id('bad-staff'),school_id:school2},'23503')
  await rejectClone('cross-school admission learner FK','learner_admissions','admission-1',{id:id('bad-admission'),school_id:school2},'23503')
  await rejectClone('admission numbers cannot be reused','learner_admissions','admission-1',{id:id('bad-admission'),status:'closed'},'23505')
  await rejectSql('wrong learner admission context','UPDATE learner_enrolments SET admission_id=$1 WHERE id=$2',[id('admission-2'),id('enrolment-1')],'23503')
  await rejectClone('overlapping terms','terms','term-1',{id:id('bad-term'),code:'OVERLAP',ordinal:4})
  await rejectSql('term outside year','UPDATE terms SET ends_on=$1 WHERE id=$2',['2027-01-01',id('term-3')])
  await rejectClone('overlapping active years','academic_years','year',{id:id('bad-year'),code:'OVERLAP'})
  await rejectClone('overlapping class placement','class_placements','placement-1',{id:id('bad-placement'),starts_on:'2026-02-01'})
  await rejectClone('wrong class placement context','class_placements','placement-1',{id:id('bad-placement'),grade_id:id('wrong-grade'),starts_on:'2026-02-01'},'23503')
  await rejectSql('wrong learner subject context','UPDATE learner_subject_enrolments SET placement_id=$1 WHERE id=$2',[id('placement-2'),id('subject-enrolment-1-math')],'23503')
  await rejectClone('overlapping subject enrolment','learner_subject_enrolments','subject-enrolment-1-math',{id:id('bad-subject-enrolment'),starts_on:'2026-02-01'})
  await rejectClone('overlapping teacher assignment','teacher_assignments','assignment-math',{id:id('bad-assignment'),starts_on:'2026-02-01'})
  await rejectClone('overlapping bounded role grant','membership_roles','grant-teacher',{id:id('bad-grant'),valid_from:'2026-02-01',valid_until:'2026-12-01'})
  await rejectSql('unknown lifecycle status','UPDATE learners SET status=$1 WHERE id=$2',['invented',id('learner-1')])
  await rejectSql('blank learner name','UPDATE learners SET display_name=$1 WHERE id=$2',['  ',id('learner-1')])
  await rejectSql('invalid timezone','UPDATE schools SET timezone=$1 WHERE id=$2',['Invalid/Zone',school])
  await rejectSql('curriculum mismatch','UPDATE subject_catalogue SET curriculum_code=$1 WHERE id=$2',['WRONG',id('subject-math')])
  await rejectSql('platform grant rejected','UPDATE roles SET scope=$1 WHERE id=$2',['platform',id('role-teacher')])
  await rejectSql('audit events cannot be updated','UPDATE audit_events SET reason=$1 WHERE id=$2',['edited',id('seed-audit')])
  await rejectSql('audit events cannot be deleted','DELETE FROM audit_events WHERE id=$1',[id('seed-audit')])
  await rejectSql('audit events cannot be truncated','TRUNCATE audit_events',[])
  await rejectSql('actors cannot be rewritten','UPDATE audit_actors SET actor_code=$1 WHERE id=$2',['edited',id('actor-teacher')])
  await rejectSql('referenced learners cannot be deleted','DELETE FROM learners WHERE id=$1',[id('learner-1')],'23503')
  await rejectSql('auth identity cannot cascade into academic history','DELETE FROM "user" WHERE id=$1',[id('user-teacher')],'23503')
  await rejectSql('actor school membership checked', 'INSERT INTO learners (school_id,display_name,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,$3)',[school2,'Wrong actor',id('actor-teacher')])

  // Run the real domain queries using savepoints so every test write is rolled back.
  let userId = id('user-teacher')
  const adapter = {
    query: (...args) => client.query(...args),
    connect: async () => ({
      query: async (sql,values) => {
        if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return client.query('SAVEPOINT domain_operation')
        if (sql === 'COMMIT') { await client.query('SET CONSTRAINTS ALL IMMEDIATE'); await client.query('SET CONSTRAINTS ALL DEFERRED'); return client.query('RELEASE SAVEPOINT domain_operation') }
        if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT domain_operation')
        return client.query(sql,values)
      }, release() {},
    }),
  }
  const service = foundationService(adapter,async()=>userId)
  async function test(label,run) { await run(); console.log(`PASS ${label}`); passed++ }
  for (const [table,key,changes] of [
    ['academic_years','year',{id:id('year-school-2'),school_id:school2}],
    ['class_groups','class',{id:id('class-school-2'),school_id:school2,academic_year_id:id('year-school-2')}],
    ['school_subjects','school-subject-math',{id:id('subject-school-2'),school_id:school2}],
    ['subject_offerings','offering-math',{id:id('offering-school-2'),school_id:school2,academic_year_id:id('year-school-2'),class_group_id:id('class-school-2'),school_subject_id:id('subject-school-2')}],
    ['class_groups','class',{id:id('class-other'),code:'10-WEST'}],
    ['subject_offerings','offering-math',{id:id('offering-other'),class_group_id:id('class-other')}],
  ]) { const q = await clone(table,key,changes); await client.query(q.sql,q.values) }
  await rejectSql('same-school wrong offering class context','UPDATE learner_subject_enrolments SET offering_id=$1 WHERE id=$2',[id('offering-other'),id('subject-enrolment-1-math')],'23503')
  await test('teacher sees only its school',async()=>assert.deepEqual((await service.listSchools()).map(s=>s.id),[school]))
  await test('teacher sees 3 assigned offerings',async()=>assert.equal((await service.getFoundation(school)).offerings.length,3))
  await test('assigned teacher sees 4 enrolled learners',async()=>assert.equal((await service.getOfferingRoster(school,id('offering-math'))).length,4))
  await test('cross-school read denied',()=>assert.rejects(service.getFoundation(school2),/FORBIDDEN/))
  await test('unknown offering denied',()=>assert.rejects(service.getOfferingRoster(school,id('foreign-offering')),/NOT_FOUND/))
  await test('real foreign-school offering denied with own school ID',()=>assert.rejects(service.getOfferingRoster(school,id('offering-school-2')),/NOT_FOUND/))
  await test('same-school unassigned offering denied',()=>assert.rejects(service.getOfferingRoster(school,id('offering-other')),/NOT_FOUND/))
  await test('teacher cannot rename learners',()=>assert.rejects(service.renameLearner(school,id('learner-1'),'Changed',1),/FORBIDDEN/))
  async function withChange(sql,values,run) { await client.query('SAVEPOINT state_case'); try { await client.query(sql,values); await run() } finally { await client.query('ROLLBACK TO SAVEPOINT state_case') } }
  await test('revoked teacher assignment denied',()=>withChange('UPDATE teacher_assignments SET status=$1 WHERE id=$2',['revoked',id('assignment-math')],()=>assert.rejects(service.getOfferingRoster(school,id('offering-math')),/NOT_FOUND/)))
  await test('expired teacher assignment denied',()=>withChange('UPDATE teacher_assignments SET ends_on=$1 WHERE id=$2',['2026-01-02',id('assignment-math')],()=>assert.rejects(service.getOfferingRoster(school,id('offering-math')),/NOT_FOUND/)))
  await test('inactive staff denied',()=>withChange('UPDATE staff_profiles SET status=$1 WHERE id=$2',['inactive',id('staff-teacher')],()=>assert.rejects(service.getOfferingRoster(school,id('offering-math')),/NOT_FOUND/)))
  await test('suspended membership denied',()=>withChange('UPDATE school_memberships SET status=$1 WHERE id=$2',['suspended',id('membership-teacher')],()=>assert.rejects(service.getFoundation(school),/FORBIDDEN/)))
  await test('revoked role denied',()=>withChange('UPDATE membership_roles SET revoked_at=now() WHERE id=$1',[id('grant-teacher')],()=>assert.rejects(service.getFoundation(school),/FORBIDDEN/)))
  await test('expired role denied',()=>withChange('UPDATE membership_roles SET valid_until=$1 WHERE id=$2',['2026-01-02',id('grant-teacher')],()=>assert.rejects(service.getFoundation(school),/FORBIDDEN/)))
  await test('future role denied',()=>withChange('UPDATE membership_roles SET valid_from=$1 WHERE id=$2',['2030-01-01',id('grant-teacher')],()=>assert.rejects(service.getFoundation(school),/FORBIDDEN/)))
  await test('closed school denied',()=>withChange('UPDATE schools SET status=$1 WHERE id=$2',['suspended',school],()=>assert.rejects(service.getFoundation(school),/FORBIDDEN/)))
  await test('withdrawn learner excluded',()=>withChange('UPDATE learner_subject_enrolments SET status=$1 WHERE id=$2',['withdrawn',id('subject-enrolment-1-math')],async()=>assert.equal((await service.getOfferingRoster(school,id('offering-math'))).length,3)))
  userId = id('user-moderator')
  await test('Moderator role alone does not grant teacher roster access',()=>assert.rejects(service.getOfferingRoster(school,id('offering-math')),/FORBIDDEN/))
  const unassignedTeacher = await clone('membership_roles','grant-teacher',{id:id('grant-unassigned'),membership_id:id('membership-moderator')})
  await test('second teacher cannot use another staff assignment',()=>withChange(unassignedTeacher.sql,unassignedTeacher.values,()=>assert.rejects(service.getOfferingRoster(school,id('offering-math')),/NOT_FOUND/)))
  userId = id('user-admin')
  await test('admin can view school context',async()=>assert.equal((await service.getFoundation(school)).canManage,true))
  await test('admin rename increments version and writes audit atomically',async()=> {
    const row = await service.renameLearner(school,id('learner-1'),'Renamed in rollback test',1)
    assert.equal(row.row_version,'2')
    assert.equal((await client.query("SELECT count(*) AS n FROM audit_events WHERE event_type='learner.renamed' AND resource_id=$1",[id('learner-1')])).rows[0].n,'1')
  })
  await test('stale version rejected',()=>assert.rejects(service.renameLearner(school,id('learner-1'),'Stale',1),/CONFLICT/))
  await test('cross-school mutation denied',()=>assert.rejects(service.renameLearner(school2,id('learner-1'),'Attack',2),/FORBIDDEN/))
  await test('audit failure rolls back learner mutation',async()=> {
    const failingPool = { ...adapter, connect: async()=> {
      const connection = await adapter.connect()
      return { ...connection, query: (sql,values)=>sql.startsWith('INSERT INTO audit_events') ? Promise.reject(new Error('simulated audit failure')) : connection.query(sql,values) }
    } }
    const failingService = foundationService(failingPool,async()=>userId)
    await assert.rejects(failingService.renameLearner(school,id('learner-2'),'Must roll back',1),/simulated audit failure/)
    assert.equal((await client.query('SELECT display_name FROM learners WHERE id=$1',[id('learner-2')])).rows[0].display_name,'Sample Learner 2')
  })
  userId = null
  await test('missing session denied',()=>assert.rejects(service.listSchools(),/UNAUTHORIZED/))
  await client.query('ROLLBACK')
  console.log(`Integration PASS: ${passed} checks; all test fixtures and mutations rolled back`)
} catch (error) { await client.query('ROLLBACK'); safeFailure(error) } finally { client.release(); await pool.end() }
