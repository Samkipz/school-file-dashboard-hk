import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { DomainError, learnerName, uuidInput, type Context } from './foundation.ts'
import { adminTables, dateInput, type AdminRow, type Table } from './administration.ts'

type Writer = {
  db: PoolClient; ctx: Context; school: string; command: string
  get: (table: Table, id: string) => Promise<AdminRow>
  insert: (table: Table, fields: Record<string, unknown>) => Promise<string>
  update: (table: Table, row: AdminRow, fields: Record<string, unknown>) => Promise<string>
  assign: (staff: string, offering: AdminRow, start: string, end: string | null) => Promise<string>
}
export type RolloverSelection = { enrolment_id: string; outcome: 'promote' | 'repeat' | 'complete' | 'withdraw'; class_group_id?: string; effective_on?: string; reason?: string }
export type RolloverPreview = {
  token: string; source: string; destination: string
  learners: { learner: string; outcome: string; grade: string; destinationClass: string; subjects: string[]; skippedSubjects: string[]; effectiveOn: string; reason: string }[]
  teachers: { teacher: string; subject: string; destinationClass: string; action: string }[]
}
const invalid = (): never => { throw new DomainError('INVALID_INPUT') }
const conflict = (): never => { throw new DomainError('CONFLICT') }
export function rolloverSelections(raw: string): RolloverSelection[] {
  let rows: unknown
  try { rows = JSON.parse(raw) } catch { return invalid() }
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) return invalid()
  const seen = new Set<string>()
  return rows.map(row => {
    if (!row || typeof row !== 'object' || !['promote', 'repeat', 'complete', 'withdraw'].includes(row.outcome)) return invalid()
    const enrolment_id = uuidInput(row.enrolment_id)
    if (seen.has(enrolment_id)) return invalid()
    seen.add(enrolment_id)
    return row.outcome === 'promote' || row.outcome === 'repeat'
      ? { enrolment_id, outcome: row.outcome, class_group_id: uuidInput(row.class_group_id) }
      : { enrolment_id, outcome: row.outcome, effective_on: dateInput(row.effective_on ?? ''), reason: learnerName(row.reason) }
  }).sort((a, b) => a.enrolment_id.localeCompare(b.enrolment_id))
}
export function validProgression(source: AdminRow, destination: AdminRow, outcome: string) {
  return source.curriculum_code === destination.curriculum_code && (outcome === 'repeat'
    ? source.id === destination.id
    : outcome === 'promote' && Number(destination.ordinal) === Number(source.ordinal) + 1)
}

// Runs inside administrationService's authorized, serializable transaction.
// Preview has no writes. Commit rebuilds its snapshot and rejects stale confirmation.
export async function lifecycleWorkflow(w: Writer, operation: string, input: Record<string, string>): Promise<string> {
  const { db, school, ctx } = w
  const today: string = (await db.query('SELECT ((now() AT TIME ZONE $1)::date)::text AS today', [ctx.timezone])).rows[0].today
  const data = {} as Record<Table | 'grades' | 'subject_catalogue' | 'subject_grades', AdminRow[]>
  for (const table of adminTables) data[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE school_id=$1 ORDER BY id`, [school])).rows.map(r => r.row)
  for (const table of ['grades', 'subject_catalogue', 'subject_grades'] as const) data[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).rows.map(r => r.row)
  const find = (table: keyof typeof data, id: unknown): AdminRow => {
    const row = data[table].find(r => r.id === id && !r.archived_at)
    if (!row) throw new DomainError('NOT_FOUND')
    return row
  }
  let eventSequence = 1000000 // Separate from the shared mutation audit sequence.
  const event = async (type: string, learner: AdminRow, changes: Record<string, unknown>, reason: string | null = null) => {
    await db.query(`INSERT INTO audit_events (school_id,actor_id,membership_id,event_type,resource_type,resource_id,command_id,sequence,reason,safe_changes) VALUES ($1,$2,$3,$4,'learners',$5,$6,$7,$8,$9::jsonb)`, [school, ctx.actor_id, ctx.membership_id, type, learner.id, w.command, ++eventSequence, reason, JSON.stringify(changes)])
  }
  const exitPlan = (learner: AdminRow, effective: string) => {
    if (learner.status !== 'active') conflict()
    if (effective > today) invalid()
    const admissions = data.learner_admissions.filter(a => a.learner_id === learner.id && a.status === 'active' && !a.archived_at)
    if (admissions.length !== 1 || effective < String(admissions[0].admitted_on)) invalid()
    const enrolments = data.learner_enrolments.filter(e => e.learner_id === learner.id && (!e.ends_on || String(e.ends_on) >= effective))
    // Scheduled records must be resolved first; never invert dates or delete them.
    if (enrolments.some(e => e.archived_at || e.status !== 'active' || String(e.starts_on) > effective)) invalid()
    const placements = data.class_placements.filter(p => enrolments.some(e => e.id === p.enrolment_id) && (!p.ends_on || String(p.ends_on) >= effective))
    const subjects = data.learner_subject_enrolments.filter(s => enrolments.some(e => e.id === s.enrolment_id) && (!s.ends_on || String(s.ends_on) >= effective))
    if ([...placements, ...subjects].some(r => r.archived_at || String(r.starts_on) > effective) || subjects.some(s => s.status !== 'active')) invalid()
    return { admissions, enrolments, placements, subjects }
  }
  const close = async (learner: AdminRow, effective: string, outcome: string, reason: string) => {
    const plan = exitPlan(learner, effective)
    const status = outcome === 'withdraw' ? 'withdrawn' : 'completed'
    await w.get('learners', learner.id)
    for (const row of plan.subjects) await w.update('learner_subject_enrolments', row, { ends_on: effective, status })
    for (const row of plan.placements) await w.update('class_placements', row, { ends_on: effective })
    for (const row of plan.enrolments) await w.update('learner_enrolments', row, { ends_on: effective, status })
    for (const row of plan.admissions) await w.update('learner_admissions', row, { left_on: effective, status: 'closed' })
    const to_status = outcome === 'withdraw' ? 'left' : 'completed'
    await w.update('learners', learner, { status: to_status })
    await event('learner.lifecycle', learner, { from_status: learner.status, to_status, effective_on: effective }, reason)
    return learner.id
  }
  if (operation === 'withdrawLearner' || operation === 'completeLearner') {
    return close(find('learners', uuidInput(input.learner_id)), dateInput(input.effective_on ?? ''), operation === 'withdrawLearner' ? 'withdraw' : 'complete', learnerName(input.reason))
  }
  if (operation === 'readmitLearner') {
    const learner = find('learners', uuidInput(input.learner_id))
    if (!['left', 'completed'].includes(String(learner.status))) conflict()
    const effective = dateInput(input.effective_on ?? '')
    const reason = learnerName(input.reason)
    const number = learnerName(input.admission_number)
    const prior = data.learner_admissions.filter(a => a.learner_id === learner.id)
    if (effective > today || !prior.length || prior.some(a => a.status !== 'closed' || !a.left_on || String(a.left_on) >= effective)) invalid()
    if (data.learner_enrolments.some(e => e.learner_id === learner.id && (!e.ends_on || String(e.ends_on) >= effective))) invalid()
    await w.get('learners', learner.id)
    await w.update('learners', learner, { status: 'active' })
    const admission = await w.insert('learner_admissions', { learner_id: learner.id, admission_number: number, admitted_on: effective })
    await event('learner.lifecycle', learner, { from_status: learner.status, to_status: 'active', effective_on: effective, admission_id: admission }, reason)
    return admission
  }

  const selections = rolloverSelections(input.selections)
  if (!['true', 'false'].includes(input.copy_teachers)) invalid()
  const source = find('academic_years', uuidInput(input.source_year_id))
  const destination = find('academic_years', uuidInput(input.destination_year_id))
  if (source.status !== 'active' || destination.status !== 'active' || String(destination.starts_on) <= String(source.ends_on)) invalid()
  const eligibleStaff = (await db.query(`SELECT sp.id FROM staff_profiles sp JOIN school_memberships m ON m.school_id=sp.school_id AND m.id=sp.membership_id WHERE sp.school_id=$1 AND sp.status='active' AND sp.archived_at IS NULL AND m.status='active' AND m.archived_at IS NULL AND m.joined_at<=now() AND m.ended_at IS NULL AND EXISTS (SELECT 1 FROM membership_roles mr JOIN roles r ON r.id=mr.role_id WHERE mr.school_id=m.school_id AND mr.membership_id=m.id AND mr.archived_at IS NULL AND mr.revoked_at IS NULL AND mr.valid_from<=now() AND (mr.valid_until IS NULL OR mr.valid_until>now()) AND r.code='teacher' AND r.scope='school' AND r.policy_version=1 AND r.archived_at IS NULL) ORDER BY sp.id`, [school])).rows.map(r => r.id)
  const previous = (await db.query(`SELECT resource_id,safe_changes FROM audit_events WHERE school_id=$1 AND event_type='learner.rollover' ORDER BY id`, [school])).rows
  const teacherPlans = new Map<string, { staff: AdminRow; offering: AdminRow; existing: boolean }>()
  const plans = selections.map(selection => {
    const enrolment = find('learner_enrolments', selection.enrolment_id)
    const learner = find('learners', enrolment.learner_id)
    const admission = find('learner_admissions', enrolment.admission_id)
    if (enrolment.academic_year_id !== source.id) invalid()
    if (enrolment.status !== 'active' || learner.status !== 'active' || admission.status !== 'active') conflict()
    if (previous.some(p => p.safe_changes.source_enrolment_id === enrolment.id)) conflict()
    if (data.learner_enrolments.some(e => e.learner_id === learner.id && e.academic_year_id === destination.id)) conflict()
    if (selection.outcome === 'complete' || selection.outcome === 'withdraw') {
      const effective = selection.effective_on!
      if (effective < String(enrolment.starts_on) || effective > String(enrolment.ends_on ?? source.ends_on)) invalid()
      exitPlan(learner, effective)
      return { selection, enrolment, learner, admission, target: null, offerings: [] as AdminRow[], skipped: [] as string[] }
    }
    const target = find('class_groups', selection.class_group_id)
    if (target.academic_year_id !== destination.id || target.status !== 'active' || !validProgression(find('grades', enrolment.grade_id), find('grades', target.grade_id), selection.outcome)) invalid()
    if (String(admission.admitted_on) > String(destination.starts_on) || (admission.left_on && String(admission.left_on) < String(destination.ends_on))) invalid()
    // Only subjects held at the source enrolment's end are candidates, including the last transferred class.
    const end = String(enrolment.ends_on ?? source.ends_on)
    const sourceSubjects = data.learner_subject_enrolments.filter(s => s.enrolment_id === enrolment.id && s.status === 'active' && !s.archived_at && String(s.starts_on) <= end && (!s.ends_on || String(s.ends_on) >= end))
    const offerings: AdminRow[] = [], skipped: string[] = []
    for (const subject of sourceSubjects) {
      const old = find('subject_offerings', subject.offering_id)
      const schoolSubject = find('school_subjects', old.school_subject_id)
      const catalogue = find('subject_catalogue', old.subject_id)
      const applicable = schoolSubject.enabled && catalogue.status === 'active' && data.subject_grades.some(g => g.subject_id === old.subject_id && g.grade_id === target.grade_id && !g.archived_at)
      const next = data.subject_offerings.find(o => o.class_group_id === target.id && o.school_subject_id === old.school_subject_id && o.status === 'active' && !o.archived_at)
      if (!applicable || !next) { skipped.push(String(schoolSubject.display_name)); continue }
      if (!offerings.some(o => o.id === next.id)) offerings.push(next)
      if (input.copy_teachers === 'true') {
        for (const assignment of data.teacher_assignments.filter(a => a.offering_id === old.id && a.status === 'active' && !a.archived_at && String(a.starts_on) <= end && (!a.ends_on || String(a.ends_on) >= end))) {
          const staff = find('staff_profiles', assignment.staff_id)
          if (!eligibleStaff.includes(staff.id)) invalid()
          const overlapping = data.teacher_assignments.filter(a => a.staff_id === staff.id && a.offering_id === next.id && a.status !== 'revoked' && String(a.starts_on) <= String(destination.ends_on) && (!a.ends_on || String(a.ends_on) >= String(destination.starts_on)))
          if (overlapping.some(a => a.status !== 'active' || a.archived_at || String(a.starts_on) !== String(destination.starts_on) || String(a.ends_on) !== String(destination.ends_on))) conflict()
          teacherPlans.set(`${staff.id}:${next.id}`, { staff, offering: next, existing: overlapping.length > 0 })
        }
      }
    }
    return { selection, enrolment, learner, admission, target, offerings, skipped }
  })
  const teachers = [...teacherPlans.values()]
  const token = createHash('sha256').update(JSON.stringify({ school, actor: ctx.actor_id, today, data, eligibleStaff, previous, selections, source: source.id, destination: destination.id, copy: input.copy_teachers })).digest('hex')
  const preview: RolloverPreview = {
    token, source: String(source.code), destination: String(destination.code),
    learners: plans.map(p => ({ learner: String(p.learner.display_name), outcome: p.selection.outcome, grade: String(find('grades', p.target?.grade_id ?? p.enrolment.grade_id).label), destinationClass: String(p.target?.label ?? 'None'), subjects: p.offerings.map(o => String(find('school_subjects', o.school_subject_id).display_name)), skippedSubjects: p.skipped, effectiveOn: p.selection.effective_on ?? String(destination.starts_on), reason: p.selection.reason ?? '' })),
    teachers: teachers.map(t => ({ teacher: String(t.staff.display_name), subject: String(find('school_subjects', t.offering.school_subject_id).display_name), destinationClass: String(find('class_groups', t.offering.class_group_id).label), action: t.existing ? 'Keep existing assignment' : 'Create assignment' })),
  }
  if (operation === 'previewRollover') return JSON.stringify(preview)
  if (operation !== 'commitRollover' || input.confirmed !== 'true') invalid()
  if (input.preview_token !== token) conflict()
  let createdEnrolments = 0, createdSubjects = 0, createdAssignments = 0
  for (const plan of plans) {
    const { learner, enrolment, admission, selection, target, offerings } = plan
    await w.get('learners', learner.id)
    let destinationEnrolment: string | null = null
    if (!target) await close(learner, selection.effective_on!, selection.outcome, selection.reason!)
    else {
      destinationEnrolment = await w.insert('learner_enrolments', { learner_id: learner.id, admission_id: admission.id, academic_year_id: destination.id, grade_id: target.grade_id, starts_on: destination.starts_on, ends_on: destination.ends_on })
      createdEnrolments++
      const context = { enrolment_id: destinationEnrolment, class_group_id: target.id, academic_year_id: destination.id, grade_id: target.grade_id, starts_on: destination.starts_on, ends_on: destination.ends_on }
      const placement = await w.insert('class_placements', context)
      for (const offering of offerings) { await w.insert('learner_subject_enrolments', { ...context, placement_id: placement, offering_id: offering.id }); createdSubjects++ }
    }
    await event('learner.rollover', learner, { source_enrolment_id: enrolment.id, source_year_id: source.id, destination_year_id: destination.id, destination_enrolment_id: destinationEnrolment, outcome: selection.outcome, preview_token: token })
  }
  for (const teacher of teachers) if (!teacher.existing) { await w.assign(teacher.staff.id, teacher.offering, String(destination.starts_on), String(destination.ends_on)); createdAssignments++ }
  return JSON.stringify({ learners: plans.length, enrolments: createdEnrolments, placements: createdEnrolments, subjects: createdSubjects, teacherAssignments: createdAssignments, completed: selections.filter(s => s.outcome === 'complete').length, withdrawn: selections.filter(s => s.outcome === 'withdraw').length })
}
