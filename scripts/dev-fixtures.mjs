import { createHash } from 'node:crypto'
// Stable fixture identities, no personal data or official curriculum codes.
export const fixtureId = key => {
  const hex = createHash('sha256').update(`schoolhub-dev:${key}`).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`
}
export const devSchoolId = fixtureId('school')
export const devUsers = [
  { key: 'admin', name: 'Development Admin', role: 'school_admin' },
  { key: 'teacher', name: 'Development Teacher', role: 'teacher' },
  { key: 'moderator', name: 'Development Moderator', role: 'moderator' },
]
export const devSubjects = [ ['math', 'Mathematics'], ['english', 'English'], ['biology', 'Biology'] ]
export async function seedFoundation(client, passwordHash) {
  const actor = fixtureId('bootstrap')
  const insert = async (table, values) => {
    const entries = Object.entries(values)
    await client.query(`INSERT INTO "${table}" (${entries.map(([k]) => `"${k}"`).join(',')}) VALUES (${entries.map((_,i) => `$${i+1}`).join(',')}) ON CONFLICT (id) DO NOTHING`, entries.map(([,v]) => v))
  }
  const mutable = (key, values) => ({ id: fixtureId(key), created_by_actor_id: actor, updated_by_actor_id: actor, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...values })
  const tenant = (key, values) => mutable(key, { school_id: devSchoolId, ...values })
  await insert('audit_actors', { id: actor, kind: 'service', actor_code: 'development-bootstrap', created_at: '2026-01-01T00:00:00Z' })
  await insert('schools', mutable('school', { code: 'DEV-SCHOOL', name: 'SchoolHub Development School', timezone: 'Africa/Nairobi', status: 'active' }))
  for (const person of devUsers) {
    await insert('user', { id: fixtureId(`user-${person.key}`), name: person.name, email: `${person.key}@schoolhub.test`, emailVerified: true })
    await insert('account', { id: fixtureId(`account-${person.key}`), accountId: fixtureId(`user-${person.key}`), providerId: 'credential', userId: fixtureId(`user-${person.key}`), password: passwordHash })
    await insert('audit_actors', { id: fixtureId(`actor-${person.key}`), user_id: fixtureId(`user-${person.key}`), kind: 'human', actor_code: `dev-${person.key}` })
    await insert('roles', mutable(`role-${person.role}`, { code: person.role, name: { school_admin: 'School Admin', teacher: 'Teacher', moderator: 'Moderator' }[person.role], scope: 'school', policy_version: 1 }))
    await insert('school_memberships', tenant(`membership-${person.key}`, { user_id: fixtureId(`user-${person.key}`), status: 'active', joined_at: '2026-01-01T00:00:00Z' }))
    await insert('membership_roles', tenant(`grant-${person.key}`, { membership_id: fixtureId(`membership-${person.key}`), role_id: fixtureId(`role-${person.role}`), valid_from: '2026-01-01T00:00:00Z' }))
    await insert('staff_profiles', tenant(`staff-${person.key}`, { membership_id: fixtureId(`membership-${person.key}`), staff_code: `DEV-${person.key.toUpperCase()}`, display_name: person.name, status: 'active' }))
  }
  await insert('academic_years', tenant('year', { code: '2026-DEMO', starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' }))
  for (const [n,start,end] of [[1,'01-01','04-30'],[2,'05-01','08-31'],[3,'09-01','12-31']]) await insert('terms', tenant(`term-${n}`, { academic_year_id: fixtureId('year'), code: `DEMO-T${n}`, ordinal: n, starts_on: `2026-${start}`, ends_on: `2026-${end}` }))
  await insert('grades', mutable('grade', { curriculum_code: 'DEMO', code: 'G10', label: 'Grade 10', ordinal: 10 }))
  await insert('class_groups', tenant('class', { academic_year_id: fixtureId('year'), grade_id: fixtureId('grade'), code: '10-EAST', label: 'Grade 10 East', status: 'active' }))
  for (const [key,name] of devSubjects) {
    await insert('subject_catalogue', mutable(`subject-${key}`, { curriculum_code: 'DEMO', code: `DEMO-${key.toUpperCase()}`, name, status: 'active' }))
    await insert('subject_grades', mutable(`subject-grade-${key}`, { subject_id: fixtureId(`subject-${key}`), grade_id: fixtureId('grade') }))
    await insert('school_subjects', tenant(`school-subject-${key}`, { subject_id: fixtureId(`subject-${key}`), local_code: key.toUpperCase(), display_name: name, enabled: true }))
    await insert('subject_offerings', tenant(`offering-${key}`, { school_subject_id: fixtureId(`school-subject-${key}`), class_group_id: fixtureId('class'), academic_year_id: fixtureId('year'), grade_id: fixtureId('grade'), subject_id: fixtureId(`subject-${key}`), status: 'active' }))
    await insert('teacher_assignments', tenant(`assignment-${key}`, { staff_id: fixtureId('staff-teacher'), offering_id: fixtureId(`offering-${key}`), starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' }))
  }
  for (let n = 1; n <= 4; n++) {
    await insert('learners', tenant(`learner-${n}`, { display_name: `Sample Learner ${n}`, status: 'active' }))
    await insert('learner_admissions', tenant(`admission-${n}`, { learner_id: fixtureId(`learner-${n}`), admission_number: `DEV-2026-00${n}`, admitted_on: '2026-01-01', status: 'active' }))
    await insert('learner_enrolments', tenant(`enrolment-${n}`, { learner_id: fixtureId(`learner-${n}`), admission_id: fixtureId(`admission-${n}`), academic_year_id: fixtureId('year'), grade_id: fixtureId('grade'), starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' }))
    await insert('class_placements', tenant(`placement-${n}`, { enrolment_id: fixtureId(`enrolment-${n}`), class_group_id: fixtureId('class'), academic_year_id: fixtureId('year'), grade_id: fixtureId('grade'), starts_on: '2026-01-01', ends_on: '2026-12-31' }))
    for (const [key] of devSubjects) await insert('learner_subject_enrolments', tenant(`subject-enrolment-${n}-${key}`, { enrolment_id: fixtureId(`enrolment-${n}`), placement_id: fixtureId(`placement-${n}`), offering_id: fixtureId(`offering-${key}`), class_group_id: fixtureId('class'), academic_year_id: fixtureId('year'), grade_id: fixtureId('grade'), starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' }))
  }
  await insert('audit_events', { id: fixtureId('seed-audit'), school_id: devSchoolId, actor_id: actor, event_type: 'school.development_seeded', resource_type: 'school', resource_id: devSchoolId, command_id: fixtureId('seed-command'), sequence: 1, safe_changes: { fixture_version: 1 }, occurred_at: '2026-01-01T00:00:00Z' })
}
