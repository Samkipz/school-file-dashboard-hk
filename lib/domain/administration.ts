import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { DomainError, foundationService, learnerName, uuidInput } from './foundation.ts'
import { CLASS_ROSTER_PAGE_SIZE, type ClassRosterPage, type ClassSummary } from './class-administration.ts'
import { lifecycleWorkflow } from './learner-lifecycle.ts'
import type { PeriodRecord } from '../academic-navigation.ts'

export type AdminRow = { id: string; [key: string]: string | boolean | number | null }
export const adminTables = ['learners', 'learner_admissions', 'learner_enrolments', 'class_placements', 'learner_subject_enrolments', 'academic_years', 'terms', 'class_groups', 'school_subjects', 'subject_offerings', 'staff_profiles', 'teacher_assignments'] as const
export type Table = typeof adminTables[number]
export type AdminData = Omit<Record<Table | 'grades' | 'subject_catalogue' | 'subject_grades' | 'lifecycle_history', AdminRow[]>, 'academic_years' | 'terms'> & {
  academic_years: (AdminRow & Required<PeriodRecord>)[]
  terms: (AdminRow & Required<PeriodRecord>)[]
  today: string
}
export function dateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new DomainError('INVALID_INPUT')
  return value
}
export function previousDay(value: string) { return new Date(Date.parse(dateInput(value)) - 86400000).toISOString().slice(0, 10) }
export function dateRange(start: string, end: string | null) {
  dateInput(start)
  if (end && dateInput(end) < start) throw new DomainError('INVALID_INPUT')
}
export function administrationService(pool: Pool, identify: () => Promise<string | null>) {
  const access = foundationService(pool, identify)
  return {
    classRoster(school: string, classId: string, search = '', page = 1): Promise<ClassRosterPage> {
      uuidInput(classId)
      const query = search.trim()
      if (query.length > 160 || !Number.isSafeInteger(page) || page < 1 || page > Math.floor(2147483647 / CLASS_ROSTER_PAGE_SIZE)) throw new DomainError('INVALID_INPUT')
      const escaped = query.replace(/[!%_]/g, '!$&')
      const pattern = escaped ? `%${escaped}%` : null
      const offset = (page - 1) * CLASS_ROSTER_PAGE_SIZE
      return access.inSchool(school, async (db, ctx) => {
        if (!ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
        const currentDate = `(now() AT TIME ZONE $3::text)::date`
        const context = (await db.query(`SELECT c.status='closed' OR y.status='closed' OR ${currentDate}>y.ends_on AS is_history,
          c.status='active' AND y.status='active' AND ${currentDate} BETWEEN y.starts_on AND y.ends_on AS is_current
          FROM class_groups c JOIN academic_years y ON y.school_id=c.school_id AND y.id=c.academic_year_id
          WHERE c.school_id=$1 AND c.id=$2 AND c.archived_at IS NULL AND y.archived_at IS NULL`, [school, classId, ctx.timezone])).rows[0] as { is_current: boolean; is_history: boolean } | undefined
        if (!context) throw new DomainError('NOT_FOUND')
        const rosterFrom = `FROM class_placements p
          JOIN class_groups c ON c.school_id=p.school_id AND c.id=p.class_group_id
          JOIN academic_years y ON y.school_id=c.school_id AND y.id=c.academic_year_id
          JOIN learner_enrolments e ON e.school_id=p.school_id AND e.id=p.enrolment_id
          JOIN learners l ON l.school_id=e.school_id AND l.id=e.learner_id
          JOIN learner_admissions a ON a.school_id=e.school_id AND a.id=e.admission_id AND a.learner_id=e.learner_id
          WHERE p.school_id=$1 AND c.id=$2 AND p.archived_at IS NULL AND c.archived_at IS NULL AND y.archived_at IS NULL
            AND e.archived_at IS NULL AND l.archived_at IS NULL AND a.archived_at IS NULL
            AND ${currentDate} IS NOT NULL
            AND ($4::text IS NULL OR l.display_name ILIKE $4 ESCAPE '!' OR a.admission_number ILIKE $4 ESCAPE '!')`
          const searchValues = [school, classId, ctx.timezone, pattern]
        const currentPredicate = `AND c.status='active' AND y.status='active' AND ${currentDate} BETWEEN y.starts_on AND y.ends_on
          AND p.academic_year_id=c.academic_year_id AND p.grade_id=c.grade_id
          AND e.academic_year_id=c.academic_year_id AND e.grade_id=c.grade_id
          AND l.status='active' AND a.status='active' AND e.status='active'
          AND ${currentDate} BETWEEN a.admitted_on AND coalesce(a.left_on,y.ends_on)
          AND ${currentDate} BETWEEN e.starts_on AND coalesce(e.ends_on,y.ends_on)
          AND ${currentDate} BETWEEN p.starts_on AND coalesce(p.ends_on,y.ends_on)`
        const historyMode = context.is_history
        const filter = `${rosterFrom} ${historyMode ? '' : currentPredicate}`
        const total = Number((await db.query(`SELECT count(DISTINCT l.id)::int AS total ${filter}`, searchValues)).rows[0].total)
        const learners = (await db.query(`SELECT roster.learner_id,roster.display_name,roster.admission_number,roster.learner_status,roster.enrolment_status,roster.placement_starts_on,roster.placement_ends_on
          FROM (SELECT DISTINCT ON (l.id) l.id AS learner_id,l.display_name,a.admission_number,l.status AS learner_status,e.status AS enrolment_status,p.starts_on::text AS placement_starts_on,p.ends_on::text AS placement_ends_on
            ${filter} ORDER BY l.id,p.starts_on DESC,p.id DESC) roster
          ORDER BY lower(roster.display_name),roster.display_name,roster.learner_id LIMIT $5 OFFSET $6`, [...searchValues, CLASS_ROSTER_PAGE_SIZE, offset])).rows
        return { mode: historyMode ? 'history' : 'current', page, pageSize: CLASS_ROSTER_PAGE_SIZE, total, search: query, learners }
      })
    },
    classSummaries(school: string): Promise<ClassSummary[]> {
      return access.inSchool(school, async (db, ctx) => {
        if (!ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
        const currentDate = `(now() AT TIME ZONE $2::text)::date`
        const currentClass = `c.status='active' AND y.status='active' AND ${currentDate} BETWEEN y.starts_on AND y.ends_on`
        const historicalClass = `c.status='closed' OR y.status='closed' OR ${currentDate}>y.ends_on`
        const currentLearner = `p.academic_year_id=c.academic_year_id AND p.grade_id=c.grade_id
          AND e.academic_year_id=c.academic_year_id AND e.grade_id=c.grade_id
          AND l.status='active' AND a.status='active' AND e.status='active'
          AND ${currentDate} BETWEEN a.admitted_on AND coalesce(a.left_on,y.ends_on)
          AND ${currentDate} BETWEEN e.starts_on AND coalesce(e.ends_on,y.ends_on)
          AND ${currentDate} BETWEEN p.starts_on AND coalesce(p.ends_on,y.ends_on)`
        const result = await db.query(`SELECT c.id AS class_group_id,
          CASE WHEN ${historicalClass} THEN 'history' ELSE 'current' END AS roster_mode,
          CASE WHEN ${historicalClass} THEN (
            SELECT count(DISTINCT l.id)::int FROM class_placements p
            JOIN learner_enrolments e ON e.school_id=p.school_id AND e.id=p.enrolment_id
            JOIN learners l ON l.school_id=e.school_id AND l.id=e.learner_id
            JOIN learner_admissions a ON a.school_id=e.school_id AND a.id=e.admission_id AND a.learner_id=e.learner_id
            WHERE p.school_id=c.school_id AND p.class_group_id=c.id AND p.archived_at IS NULL AND e.archived_at IS NULL AND l.archived_at IS NULL AND a.archived_at IS NULL
          ) ELSE (
            SELECT count(DISTINCT l.id)::int FROM class_placements p
            JOIN learner_enrolments e ON e.school_id=p.school_id AND e.id=p.enrolment_id
            JOIN learners l ON l.school_id=e.school_id AND l.id=e.learner_id
            JOIN learner_admissions a ON a.school_id=e.school_id AND a.id=e.admission_id AND a.learner_id=e.learner_id
            WHERE p.school_id=c.school_id AND p.class_group_id=c.id AND p.archived_at IS NULL AND e.archived_at IS NULL AND l.archived_at IS NULL AND a.archived_at IS NULL
              AND ${currentLearner}
          ) END AS learners,
          CASE WHEN ${currentClass} THEN (
            SELECT count(*)::int FROM subject_offerings o JOIN school_subjects ss ON ss.school_id=o.school_id AND ss.id=o.school_subject_id
            WHERE o.school_id=c.school_id AND o.class_group_id=c.id AND o.academic_year_id=c.academic_year_id
              AND o.status='active' AND o.archived_at IS NULL AND ss.enabled AND ss.archived_at IS NULL
          ) ELSE 0 END AS offerings,
          CASE WHEN ${currentClass} THEN (
            SELECT count(DISTINCT ta.id)::int FROM subject_offerings o
            JOIN school_subjects ss ON ss.school_id=o.school_id AND ss.id=o.school_subject_id
            JOIN teacher_assignments ta ON ta.school_id=o.school_id AND ta.offering_id=o.id
            JOIN staff_profiles sp ON sp.school_id=ta.school_id AND sp.id=ta.staff_id
            WHERE o.school_id=c.school_id AND o.class_group_id=c.id AND o.academic_year_id=c.academic_year_id
              AND o.status='active' AND o.archived_at IS NULL AND ss.enabled AND ss.archived_at IS NULL
              AND ta.status='active' AND ta.archived_at IS NULL AND sp.status='active' AND sp.archived_at IS NULL
              AND ta.starts_on<=${currentDate} AND (ta.ends_on IS NULL OR ta.ends_on>=${currentDate})
          ) ELSE 0 END AS "activeAssignments"
          FROM class_groups c JOIN academic_years y ON y.school_id=c.school_id AND y.id=c.academic_year_id
          WHERE c.school_id=$1 AND c.archived_at IS NULL AND y.archived_at IS NULL ORDER BY c.academic_year_id,c.grade_id,c.label,c.id`, [school, ctx.timezone])
        return result.rows.map(row => ({ ...row, learners: Number(row.learners), offerings: Number(row.offerings), activeAssignments: Number(row.activeAssignments) })) as ClassSummary[]
      })
    },
    read(school: string, includeLearnerLifecycle = true) {
      return access.inSchool(school, async (db, ctx) => {
        if (!ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
        const data = {} as AdminData
        const lifecycleTables = new Set<Table>(['learners', 'learner_admissions', 'learner_enrolments', 'class_placements', 'learner_subject_enrolments'])
        for (const table of adminTables) {
          data[table] = !includeLearnerLifecycle && lifecycleTables.has(table) ? [] : (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE school_id=$1 AND archived_at IS NULL ORDER BY created_at,id`, [school])).rows.map(r => r.row)
        }
        for (const table of ['grades', 'subject_catalogue', 'subject_grades'] as const) data[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE archived_at IS NULL ORDER BY id`)).rows.map(r => r.row)
        data.today = (await db.query('SELECT ((now() AT TIME ZONE $1)::date)::text AS today', [ctx.timezone])).rows[0].today
        data.lifecycle_history = includeLearnerLifecycle ? (await db.query(`SELECT id,resource_id AS learner_id,event_type,reason,occurred_at::text,safe_changes->>'effective_on' AS effective_on,safe_changes->>'from_status' AS from_status,safe_changes->>'to_status' AS to_status FROM audit_events WHERE school_id=$1 AND event_type='learner.lifecycle' ORDER BY occurred_at,id`, [school])).rows : []
        return data
      })
    },
    execute(school: string, operation: string, input: Record<string, string>) {
      return access.inSchool(school, async (db, ctx) => {
        if (!ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
        const command = randomUUID()
        let sequence = 0
        const text = (key: string) => learnerName(input[key])
        const ref = (key: string) => uuidInput(input[key])
        const day = (key: string) => dateInput(input[key] ?? '')
        const ends = () => input.ends_on ? day('ends_on') : null
        const fail = () => { throw new DomainError('INVALID_INPUT') }
        const get = async (table: Table, id: string) => {
          const row = (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE school_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE`, [school, uuidInput(id)])).rows[0]?.row as AdminRow | undefined
          if (!row) throw new DomainError('NOT_FOUND')
          return row
        }
        const audit = async (table: Table, id: string, fields: string[], history = {}) => {
          await db.query(`INSERT INTO audit_events (school_id,actor_id,membership_id,event_type,resource_type,resource_id,command_id,sequence,safe_changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [school, ctx.actor_id, ctx.membership_id, `academics.${operation}`, table, id, command, ++sequence, JSON.stringify({ fields, ...history })])
        }
        // Table and column identifiers below come exclusively from server-owned branches.
        const insert = async (table: Table, fields: Record<string, unknown>) => {
          const values = { ...fields, school_id: school, created_by_actor_id: ctx.actor_id, updated_by_actor_id: ctx.actor_id }
          const keys = Object.keys(values)
          const row = (await db.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(values))).rows[0] as { id: string }
          await audit(table, row.id, Object.keys(fields))
          return row.id
        }
        const update = async (table: Table, row: AdminRow, fields: Record<string, unknown>) => {
          const keys = Object.keys(fields)
          await db.query(`UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 4}`).join(',')},updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2`, [school, row.id, ctx.actor_id, ...Object.values(fields)])
          const dated = keys.filter(k => ['status', 'starts_on', 'ends_on', 'left_on'].includes(k))
          await audit(table, row.id, keys, { before: Object.fromEntries(dated.map(k => [k, row[k]])), after: Object.fromEntries(dated.map(k => [k, fields[k]])) })
          return row.id
        }
        const year = async (id: string) => { const y = await get('academic_years', id); if (y.status === 'closed') fail(); return y }
        const grade = async (id: string) => {
          const result = await db.query('SELECT id FROM grades WHERE id=$1 AND archived_at IS NULL', [id])
          if (!result.rowCount) fail()
          return id
        }
        const activeEnrolment = async (id: string) => {
          const e = await get('learner_enrolments', id)
          const l = await get('learners', String(e.learner_id))
          const a = await get('learner_admissions', String(e.admission_id))
          if (e.status !== 'active' || l.status !== 'active' || a.status !== 'active') fail()
          return e
        }
        const within = (start: string, end: string | null, parent: AdminRow, startKey = 'starts_on') => {
          dateRange(start, end)
          if (start < String(parent[startKey]) || (parent.ends_on && (start > String(parent.ends_on) || (end && end > String(parent.ends_on))))) fail()
        }
        const group = async (id: string) => { const c = await get('class_groups', id); if (c.status !== 'active') fail(); await year(String(c.academic_year_id)); return c }
        const offering = async (id: string) => { const o = await get('subject_offerings', id); if (o.status !== 'active') fail(); await group(String(o.class_group_id)); const s = await get('school_subjects', String(o.school_subject_id)); if (!s.enabled) fail(); return o }
        const assign = async (staff: string, o: AdminRow, start: string, end: string | null) => {
          const s = await get('staff_profiles', staff)
          if (s.status !== 'active') fail()
          const eligible = await db.query(`SELECT 1 FROM school_memberships m JOIN membership_roles mr ON mr.school_id=m.school_id AND mr.membership_id=m.id JOIN roles r ON r.id=mr.role_id WHERE m.school_id=$1 AND m.id=$2 AND m.status='active' AND m.archived_at IS NULL AND m.joined_at<=now() AND m.ended_at IS NULL AND mr.archived_at IS NULL AND mr.revoked_at IS NULL AND mr.valid_from<=now() AND (mr.valid_until IS NULL OR mr.valid_until>now()) AND r.code='teacher' AND r.scope='school' AND r.policy_version=1 AND r.archived_at IS NULL`, [school, s.membership_id])
          if (!eligible.rowCount) fail()
          const y = await year(String(o.academic_year_id))
          within(start, end, y)
          return insert('teacher_assignments', { staff_id: staff, offering_id: o.id, starts_on: start, ends_on: end ?? y.ends_on })
        }
        if (['withdrawLearner', 'completeLearner', 'readmitLearner', 'previewRollover', 'commitRollover'].includes(operation)) {
          return lifecycleWorkflow({ db, ctx, school, command, get, insert, update, assign }, operation, input)
        }
        switch (operation) {
          case 'addLearner': return insert('learners', { display_name: text('display_name') })
          case 'admit': {
            const l = await get('learners', ref('learner_id')); if (l.status !== 'active') fail()
            return insert('learner_admissions', { learner_id: l.id, admission_number: text('admission_number'), admitted_on: day('admitted_on') })
          }
          case 'enrol': {
            const a = await get('learner_admissions', ref('admission_id'))
            const l = await get('learners', String(a.learner_id)); if (a.status !== 'active' || l.status !== 'active') fail()
            const y = await year(ref('academic_year_id')); const start = day('starts_on'); const end = ends() ?? String(y.ends_on)
            within(start, end, y); if (start < String(a.admitted_on) || (a.left_on && end > String(a.left_on))) fail()
            return insert('learner_enrolments', { learner_id: l.id, admission_id: a.id, academic_year_id: y.id, grade_id: await grade(ref('grade_id')), starts_on: start, ends_on: end })
          }
          case 'place': case 'transfer': {
            const e = await activeEnrolment(ref('enrolment_id'))
            const c = await group(ref('class_group_id')); if (c.academic_year_id !== e.academic_year_id || c.grade_id !== e.grade_id) fail()
            const start = day('starts_on'); const end = ends() ?? String(e.ends_on ?? (await year(String(e.academic_year_id))).ends_on)
            within(start, end, e)
            if (operation === 'transfer') {
              const p = await get('class_placements', ref('placement_id'))
              if (p.enrolment_id !== e.id || p.class_group_id === c.id || start <= String(p.starts_on) || (p.ends_on && start > String(p.ends_on))) fail()
              const subjects = (await db.query('SELECT to_jsonb(t) AS row FROM learner_subject_enrolments t WHERE school_id=$1 AND placement_id=$2 AND (ends_on IS NULL OR ends_on >= $3::date) FOR UPDATE', [school, p.id, start])).rows
              for (const { row } of subjects) {
                if (String(row.starts_on) >= start) fail()
                await update('learner_subject_enrolments', row, { ends_on: previousDay(start) })
              }
              await update('class_placements', p, { ends_on: previousDay(start) })
            }
            return insert('class_placements', { enrolment_id: e.id, class_group_id: c.id, academic_year_id: e.academic_year_id, grade_id: e.grade_id, starts_on: start, ends_on: end })
          }
          case 'enrolSubject': {
            const p = await get('class_placements', ref('placement_id')); const o = await offering(ref('offering_id'))
            await activeEnrolment(String(p.enrolment_id)); if (p.class_group_id !== o.class_group_id) fail()
            const start = day('starts_on'); const end = ends() ?? String(p.ends_on ?? (await year(String(p.academic_year_id))).ends_on)
            within(start, end, p)
            return insert('learner_subject_enrolments', { enrolment_id: p.enrolment_id, placement_id: p.id, offering_id: o.id, class_group_id: p.class_group_id, academic_year_id: p.academic_year_id, grade_id: p.grade_id, starts_on: start, ends_on: end })
          }
          case 'assign': return assign(ref('staff_id'), await offering(ref('offering_id')), day('starts_on'), ends())
          case 'endAssignment': case 'replaceAssignment': {
            const a = await get('teacher_assignments', ref('assignment_id')); if (a.status !== 'active') fail()
            const end = operation === 'replaceAssignment' ? previousDay(day('starts_on')) : day('ends_on')
            if (end < String(a.starts_on) || (a.ends_on && end > String(a.ends_on))) fail()
            // Keep dated assignments active until their inclusive end date so future changes do not revoke today's access.
            const today = (await db.query('SELECT ((now() AT TIME ZONE $1)::date)::text AS today', [ctx.timezone])).rows[0].today
            await update('teacher_assignments', a, { ends_on: end, status: end < today ? 'ended' : 'active' })
            if (operation === 'replaceAssignment') {
              if (ref('staff_id') === a.staff_id) fail()
              return assign(ref('staff_id'), await offering(String(a.offering_id)), day('starts_on'), ends())
            }
            return a.id
          }
          case 'saveYear': {
            const fields = { code: text('code'), starts_on: day('starts_on'), ends_on: day('ends_on'), status: text('status') }
            if (!['draft', 'active', 'closed'].includes(fields.status)) fail(); dateRange(fields.starts_on, fields.ends_on)
            return input.id ? update('academic_years', await get('academic_years', ref('id')), fields) : insert('academic_years', fields)
          }
          case 'saveTerm': {
            const y = await year(ref('academic_year_id')); const start = day('starts_on'); const end = day('ends_on'); within(start, end, y)
            const ordinal = Number(input.ordinal); if (!Number.isSafeInteger(ordinal) || ordinal < 1) fail()
            const fields = { academic_year_id: y.id, code: text('code'), ordinal, starts_on: start, ends_on: end }
            return input.id ? update('terms', await get('terms', ref('id')), fields) : insert('terms', fields)
          }
          case 'saveClass': {
            const fields = { code: text('code'), label: text('label'), status: text('status') }; if (!['active', 'closed'].includes(fields.status)) fail()
            if (input.id) return update('class_groups', await get('class_groups', ref('id')), fields)
            return insert('class_groups', { ...fields, academic_year_id: (await year(ref('academic_year_id'))).id, grade_id: await grade(ref('grade_id')) })
          }
          case 'saveSubject': {
            const fields = { local_code: text('local_code'), display_name: text('display_name'), enabled: input.enabled === 'true' }
            if (!['true', 'false'].includes(input.enabled)) fail()
            if (input.id) return update('school_subjects', await get('school_subjects', ref('id')), fields)
            const subject = await db.query("SELECT id FROM subject_catalogue WHERE id=$1 AND status='active' AND archived_at IS NULL", [ref('subject_id')]); if (!subject.rowCount) fail()
            return insert('school_subjects', { ...fields, subject_id: ref('subject_id') })
          }
          case 'createOffering': {
            const c = await group(ref('class_group_id')); const s = await get('school_subjects', ref('school_subject_id')); if (!s.enabled) fail()
            const eligible = await db.query("SELECT 1 FROM subject_grades sg JOIN subject_catalogue sc ON sc.id=sg.subject_id WHERE sg.subject_id=$1 AND sg.grade_id=$2 AND sg.archived_at IS NULL AND sc.status='active' AND sc.archived_at IS NULL", [s.subject_id, c.grade_id])
            if (!eligible.rowCount) fail()
            return insert('subject_offerings', { class_group_id: c.id, academic_year_id: c.academic_year_id, grade_id: c.grade_id, school_subject_id: s.id, subject_id: s.subject_id })
          }
          case 'closeOffering': return update('subject_offerings', await get('subject_offerings', ref('id')), { status: 'closed' })
          default: throw new DomainError('INVALID_INPUT')
        }
      })
    },
  }
}
