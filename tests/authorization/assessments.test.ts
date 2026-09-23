import { expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { assessmentService } from '../../lib/domain/assessments'
const school = '12345678-1234-4123-8123-123456789012'
it('denies anonymous callers on every assessment entry point before opening a connection', async () => {
  const connect = vi.fn()
  const service = assessmentService({connect} as unknown as Pool, async () => null)
  for (const operation of [() => service.read(school), () => service.get(school,school), () => service.save(school,{}), () => service.open(school,school,1), () => service.readOffering(school,school), () => service.saveType(school,{}), () => service.initializeTypes(school)]) await expect(operation()).rejects.toThrow('UNAUTHORIZED')
  expect(connect).not.toHaveBeenCalled()
})
it.each(['teacher','moderator'])('denies %s on admin-only entry points', async role => {
  const query = vi.fn().mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT m.id AS membership_id') ? [{ roles:[role],school_id:school }] : [] }))
  const service = assessmentService({connect: async () => ({query,release:vi.fn()})} as unknown as Pool, async () => 'user')
  for (const operation of [() => service.read(school), () => service.get(school,school), () => service.saveType(school,{}), () => service.initializeTypes(school)]) await expect(operation()).rejects.toThrow('FORBIDDEN')
  expect(query.mock.calls.some(([sql]) => /FROM assessments|INTO assessment/i.test(sql))).toBe(false)
})
