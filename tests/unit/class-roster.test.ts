import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { administrationService } from '../../lib/domain/administration'

const school = '12345678-1234-4123-8123-123456789012'
const classId = '22345678-1234-4123-8123-123456789012'

function setup({ roles = ['school_admin'], isCurrent = true, classFound = true, total = 37, rows = [] as Record<string, unknown>[] } = {}) {
  const queries: { sql: string; values?: unknown[] }[] = []
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values })
      if (sql.includes('SELECT m.id AS membership_id')) return { rows: [{ membership_id: 'membership', actor_id: 'actor', school_id: school, timezone: 'Africa/Nairobi', roles }] }
      if (sql.includes('AS today')) return { rows: [{ today: '2026-06-15' }] }
      if (sql.includes('AS "activeAssignments"')) return { rows: [] }
      if (sql.includes('AS is_history')) return { rows: classFound ? [{ is_history: !isCurrent, is_current: isCurrent }] : [] }
      if (sql.includes('count(DISTINCT l.id)::int AS total')) return { rows: [{ total }] }
      if (sql.includes('SELECT roster.learner_id')) return { rows }
      if (sql.includes('FROM class_groups c JOIN academic_years y')) return { rows: [] }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  const service = administrationService({ connect: async () => client } as unknown as Pool, async () => 'user')
  return { service, client, queries }
}

describe('administrative class roster read', () => {
  it('requires school administrator authorization before roster queries', async () => {
    const { service, client, queries } = setup({ roles: ['teacher'] })
    await expect(service.classRoster(school, classId)).rejects.toThrow(/FORBIDDEN/)
    expect(queries.some(query => query.sql.includes('FROM class_placements'))).toBe(false)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('isolates a class lookup to the requested school and hides foreign classes', async () => {
    const { service, queries } = setup({ classFound: false })
    await expect(service.classRoster(school, classId)).rejects.toThrow(/NOT_FOUND/)
    const classQuery = queries.find(query => query.sql.includes('AS is_history'))!
    expect(classQuery.sql).toContain('c.school_id=$1 AND c.id=$2')
    expect(classQuery.values).toEqual([school, classId, 'Africa/Nairobi'])
  })

  it('returns a stable bounded page, exact total and escaped search criteria', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ learner_id: `learner-${index}`, display_name: `Learner ${index}`, admission_number: `ADM-${index}` }))
    const { service, queries } = setup({ total: 37, rows })
    const result = await service.classRoster(school, classId, 'A_%!', 2)
    expect(result).toMatchObject({ mode: 'current', page: 2, pageSize: 25, total: 37, search: 'A_%!', learners: rows })
    const countQuery = queries.find(query => query.sql.includes('count(DISTINCT l.id)::int AS total'))!
    const pageQuery = queries.find(query => query.sql.includes('SELECT roster.learner_id'))!
    expect(countQuery.sql).toContain('l.display_name ILIKE $4 ESCAPE \'!\'')
    expect(countQuery.sql).toContain('a.admission_number ILIKE $4 ESCAPE \'!\'')
    expect(countQuery.sql).toContain("l.status='active' AND a.status='active' AND e.status='active'")
    expect(countQuery.sql).toContain('p.school_id=$1 AND c.id=$2')
    expect(countQuery.sql).toContain('c.archived_at IS NULL AND y.archived_at IS NULL')
    expect(countQuery.sql).toContain('e.archived_at IS NULL AND l.archived_at IS NULL AND a.archived_at IS NULL')
    expect(countQuery.sql).toContain('p.archived_at IS NULL')
    expect(countQuery.sql).toContain("c.status='active' AND y.status='active'")
    expect(countQuery.sql).toContain('BETWEEN a.admitted_on AND coalesce(a.left_on,y.ends_on)')
    expect(countQuery.sql).toContain('BETWEEN e.starts_on AND coalesce(e.ends_on,y.ends_on)')
    expect(countQuery.sql).toContain('BETWEEN p.starts_on AND coalesce(p.ends_on,y.ends_on)')
    expect(countQuery.sql).toContain('p.academic_year_id=c.academic_year_id AND p.grade_id=c.grade_id')
    expect(countQuery.sql).toContain('e.academic_year_id=c.academic_year_id AND e.grade_id=c.grade_id')
    expect(countQuery.sql).toContain('e.school_id=p.school_id')
    expect(countQuery.values).toEqual([school, classId, 'Africa/Nairobi', '%A!_!%!!%'])
    expect(pageQuery.sql).toContain('ORDER BY lower(roster.display_name),roster.display_name,roster.learner_id')
    expect(pageQuery.sql).toContain('LIMIT $5 OFFSET $6')
    expect(pageQuery.values?.slice(-2)).toEqual([25, 25])
  })

  it('returns an empty search result without expanding the query', async () => {
    const { service } = setup({ total: 0 })
    await expect(service.classRoster(school, classId, 'No match')).resolves.toMatchObject({ total: 0, learners: [], search: 'No match' })
  })

  it('preserves non-archived placement records for closed or historical classes', async () => {
    const historyRow = { learner_id: 'learner-history', display_name: 'Former learner', admission_number: 'ADM-H', learner_status: 'left', enrolment_status: 'completed', placement_starts_on: '2025-01-01', placement_ends_on: '2025-12-31' }
    const { service, queries } = setup({ isCurrent: false, total: 1, rows: [historyRow] })
    const result = await service.classRoster(school, classId)
    const countQuery = queries.find(query => query.sql.includes('count(DISTINCT l.id)::int AS total'))!
    expect(result).toMatchObject({ mode: 'history', total: 1, learners: [historyRow] })
    expect(countQuery.sql).not.toContain("l.status='active'")
    expect(countQuery.sql).toContain('p.archived_at IS NULL')
    expect(countQuery.sql).toContain('a.archived_at IS NULL')
  })

  it('validates search length and page bounds', async () => {
    const { service, client } = setup()
    await expect(Promise.resolve().then(() => service.classRoster(school, classId, 'x'.repeat(161)))).rejects.toThrow('INVALID_INPUT')
    await expect(Promise.resolve().then(() => service.classRoster(school, classId, '', 0))).rejects.toThrow('INVALID_INPUT')
    expect(client.query).not.toHaveBeenCalled()
  })
})

describe('class overview aggregate read', () => {
  it('can load the admin Academics shell without school-wide learner lifecycle rows', async () => {
    const { service, queries } = setup()
    const data = await service.read(school, false)
    expect(data.learners).toEqual([])
    expect(data.learner_admissions).toEqual([])
    expect(data.learner_enrolments).toEqual([])
    expect(data.class_placements).toEqual([])
    expect(data.learner_subject_enrolments).toEqual([])
    expect(data.lifecycle_history).toEqual([])
    expect(queries.some(query => /FROM (learners|learner_admissions|learner_enrolments|class_placements|learner_subject_enrolments) t/.test(query.sql))).toBe(false)
  })

  it('computes current learners, active offerings and effective assignments in one class aggregate query', async () => {
    const { service, queries } = setup()
    await service.classSummaries(school)
    const summaryQuery = queries.find(query => query.sql.includes('AS "activeAssignments"'))!
    expect(summaryQuery.sql).toContain('l.status=\'active\' AND a.status=\'active\' AND e.status=\'active\'')
    expect(summaryQuery.sql).toContain("o.status='active' AND o.archived_at IS NULL")
    expect(summaryQuery.sql).toContain('ta.starts_on<=')
    expect(summaryQuery.sql).toContain('(ta.ends_on IS NULL OR ta.ends_on>=')
    expect(summaryQuery.sql).toContain('p.school_id=c.school_id AND p.class_group_id=c.id')
    expect(summaryQuery.values).toEqual([school, 'Africa/Nairobi'])
  })

  it('requires school administrator authorization for summaries', async () => {
    const { service, queries } = setup({ roles: ['teacher'] })
    await expect(service.classSummaries(school)).rejects.toThrow(/FORBIDDEN/)
    expect(queries.some(query => query.sql.includes('AS "activeAssignments"'))).toBe(false)
  })
})
