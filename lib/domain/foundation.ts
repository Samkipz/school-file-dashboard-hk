import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'

export class DomainError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT'
  constructor(code: DomainError['code']) { super(code); this.code = code }
}
export function uuidInput(value: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new DomainError('INVALID_INPUT')
  return value
}
export function learnerName(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) throw new DomainError('INVALID_INPUT')
  return value.trim()
}
export type Context = { membership_id: string; actor_id: string; school_id: string; timezone: string; roles: string[] }
type Offering = { id: string; subject: string; class_name: string; year: string }
type Learner = { id: string; display_name: string; row_version: string }

// Identity comes only from the server session adapter. This factory is not a Server Action.
export function foundationService(pool: Pool, identify: () => Promise<string | null>) {
  async function identity() {
    const userId = await identify()
    if (!userId) throw new DomainError('UNAUTHORIZED')
    return userId
  }
  async function inSchool<T>(schoolId: string, run: (client: PoolClient, context: Context) => Promise<T>): Promise<T> {
    const userId = await identity()
    uuidInput(schoolId)
    const client = await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
      const result = await client.query<Context>(`
        SELECT m.id AS membership_id, a.id AS actor_id, s.id AS school_id, s.timezone,
          ARRAY(SELECT r.code FROM membership_roles mr JOIN roles r ON r.id = mr.role_id
            WHERE mr.school_id = s.id AND mr.membership_id = m.id AND mr.archived_at IS NULL
              AND mr.revoked_at IS NULL AND mr.valid_from <= now() AND (mr.valid_until IS NULL OR mr.valid_until > now())
              AND r.scope = 'school' AND r.policy_version = 1 AND r.archived_at IS NULL) AS roles
        FROM school_memberships m JOIN schools s ON s.id = m.school_id JOIN audit_actors a ON a.user_id = m.user_id
        WHERE m.user_id = $1 AND s.id = $2 AND m.status = 'active' AND m.archived_at IS NULL
          AND m.joined_at <= now() AND m.ended_at IS NULL AND s.status = 'active' AND s.archived_at IS NULL
        FOR SHARE OF m, s`, [userId, schoolId])
      const context = result.rows[0]
      if (!context || !context.roles.some(r => ['school_admin','teacher','moderator'].includes(r))) throw new DomainError('FORBIDDEN')
      const value = await run(client, context)
      await client.query('COMMIT')
      return value
    } catch (error) {
      await client.query('ROLLBACK')
      if (error instanceof DomainError) throw error
      if (typeof error === 'object' && error && 'code' in error && ['40001','40P01','23505'].includes(String(error.code))) throw new DomainError('CONFLICT')
      if (typeof error === 'object' && error && 'code' in error && ['23503','23514','22007','22008'].includes(String(error.code))) throw new DomainError('INVALID_INPUT')
      throw error
    } finally { client.release() }
  }
  const assignmentExists = `EXISTS (
    SELECT 1 FROM teacher_assignments ta JOIN staff_profiles sp ON sp.school_id = ta.school_id AND sp.id = ta.staff_id
    WHERE ta.school_id = o.school_id AND ta.offering_id = o.id AND sp.membership_id = $2
      AND ta.status = 'active' AND ta.archived_at IS NULL AND sp.status = 'active' AND sp.archived_at IS NULL
      AND ta.starts_on <= (now() AT TIME ZONE $3)::date AND (ta.ends_on IS NULL OR ta.ends_on >= (now() AT TIME ZONE $3)::date))`
  const offeringActive = `o.status = 'active' AND o.archived_at IS NULL AND c.status = 'active' AND c.archived_at IS NULL
    AND ss.enabled AND ss.archived_at IS NULL AND y.status = 'active' AND y.archived_at IS NULL
    AND (now() AT TIME ZONE $3)::date BETWEEN y.starts_on AND y.ends_on`
  const offeringFrom = `FROM subject_offerings o
    JOIN class_groups c ON c.school_id = o.school_id AND c.id = o.class_group_id
    JOIN school_subjects ss ON ss.school_id = o.school_id AND ss.id = o.school_subject_id
    JOIN academic_years y ON y.school_id = o.school_id AND y.id = o.academic_year_id`
  return {
    // Server-only composition point; callers still receive verified session context.
    inSchool,
    async listSchools() {
      const userId = await identity()
      return (await pool.query<{ id: string; name: string }>(`SELECT s.id, s.name FROM schools s JOIN school_memberships m ON m.school_id = s.id
        WHERE m.user_id = $1 AND m.status = 'active' AND m.archived_at IS NULL AND m.joined_at <= now() AND m.ended_at IS NULL
          AND s.status = 'active' AND s.archived_at IS NULL ORDER BY s.name`, [userId])).rows
    },
    getFoundation(schoolId: string) {
      return inSchool(schoolId, async (client, context) => {
        const admin = context.roles.includes('school_admin')
        if (!admin && !context.roles.includes('teacher')) return { offerings: [] as Offering[], canManage: false }
        const offerings = await client.query<Offering>(`SELECT o.id, ss.display_name AS subject, c.label AS class_name, y.code AS year
          ${offeringFrom} WHERE o.school_id = $1 AND (${admin ? '$2::uuid IS NOT NULL AND $3::text IS NOT NULL' : `${offeringActive} AND ${assignmentExists}`}) ORDER BY y.code, c.label, ss.display_name`, [schoolId, context.membership_id, context.timezone])
        return { offerings: offerings.rows, canManage: admin }
      })
    },
    getOfferingRoster(schoolId: string, offeringId: string) {
      uuidInput(offeringId)
      return inSchool(schoolId, async (client, context) => {
        const admin = context.roles.includes('school_admin')
        if (!admin && !context.roles.includes('teacher')) throw new DomainError('FORBIDDEN')
        const allowed = await client.query(`SELECT o.id ${offeringFrom} WHERE o.school_id = $1 AND o.id = $4
          AND (${admin ? '$2::uuid IS NOT NULL AND $3::text IS NOT NULL' : `${offeringActive} AND ${assignmentExists}`})`, [schoolId, context.membership_id, context.timezone, offeringId])
        if (!allowed.rowCount) throw new DomainError('NOT_FOUND')
        return (await client.query<Learner>(`SELECT l.id, l.display_name, l.row_version FROM learner_subject_enrolments se
          JOIN learner_enrolments e ON e.school_id = se.school_id AND e.id = se.enrolment_id
          JOIN class_placements p ON p.school_id = se.school_id AND p.id = se.placement_id
          JOIN learners l ON l.school_id = e.school_id AND l.id = e.learner_id
          JOIN learner_admissions a ON a.school_id = e.school_id AND a.id = e.admission_id
          JOIN academic_years y ON y.school_id = e.school_id AND y.id = e.academic_year_id
          WHERE se.school_id = $1 AND se.offering_id = $2 AND se.status = 'active' AND se.archived_at IS NULL
            AND e.status = 'active' AND e.archived_at IS NULL AND l.status = 'active' AND l.archived_at IS NULL
            AND p.archived_at IS NULL AND a.status = 'active' AND a.archived_at IS NULL
            AND (now() AT TIME ZONE $3)::date BETWEEN se.starts_on AND coalesce(se.ends_on,y.ends_on)
            AND (now() AT TIME ZONE $3)::date BETWEEN p.starts_on AND coalesce(p.ends_on,y.ends_on)
            AND (now() AT TIME ZONE $3)::date BETWEEN e.starts_on AND coalesce(e.ends_on,y.ends_on)
            AND (now() AT TIME ZONE $3)::date BETWEEN a.admitted_on AND coalesce(a.left_on,y.ends_on)
          ORDER BY l.display_name, l.id`, [schoolId, offeringId, context.timezone])).rows
      })
    },
    renameLearner(schoolId: string, learnerId: string, name: string, expectedVersion: number) {
      uuidInput(learnerId)
      const displayName = learnerName(name)
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new DomainError('INVALID_INPUT')
      return inSchool(schoolId, async (client, context) => {
        if (!context.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
        const result = await client.query<Learner>(`UPDATE learners SET display_name = $3, updated_by_actor_id = $4
          WHERE school_id = $1 AND id = $2 AND row_version = $5 AND archived_at IS NULL RETURNING id, display_name, row_version`, [schoolId, learnerId, displayName, context.actor_id, expectedVersion])
        if (!result.rowCount) throw new DomainError('CONFLICT')
        await client.query(`INSERT INTO audit_events (school_id, actor_id, membership_id, event_type, resource_type, resource_id, command_id, sequence, safe_changes)
          VALUES ($1,$2,$3,'learner.renamed','learner',$4,$5,1,$6::jsonb)`, [schoolId, context.actor_id, context.membership_id, learnerId, randomUUID(), JSON.stringify({ fields: ['display_name'], row_version: result.rows[0].row_version })])
        return result.rows[0]
      })
    },
  }
}
