import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { administrationService, dateInput, dateRange, previousDay } from '../../lib/domain/administration'

const school = '12345678-1234-4123-8123-123456789012'
describe('administration date validation', () => {
  it.each(['', '2026-02-30', '2026-02-29', '2026-13-01', '09/10/2026', '2026-1-01', '2026-01-01T00:00:00Z'])('rejects invalid date %s', value => expect(() => dateInput(value)).toThrow('INVALID_INPUT'))
  it('accepts leap dates and computes inclusive transfer boundaries', () => {
    expect(dateInput('2028-02-29')).toBe('2028-02-29')
    expect(previousDay('2028-03-01')).toBe('2028-02-29')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
  it('rejects reversed intervals and accepts same-day intervals', () => {
    expect(() => dateRange('2026-09-10', '2026-09-09')).toThrow('INVALID_INPUT')
    expect(() => dateRange('2026-09-10', '2026-09-10')).not.toThrow()
  })
})
describe('administration authorization', () => {
  it('requires a session before database access', async () => {
    const connect = vi.fn()
    const service = administrationService({ connect } as unknown as Pool, async () => null)
    await expect(service.read(school)).rejects.toThrow('UNAUTHORIZED')
    await expect(service.execute(school, 'addLearner', { display_name: 'Test learner' })).rejects.toThrow('UNAUTHORIZED')
    expect(connect).not.toHaveBeenCalled()
  })
  it.each([['teacher'], ['moderator'], []])('denies general administration to %j', async (...roles) => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ roles: roles.flat() }] }), release: vi.fn() }
    const service = administrationService({ connect: async () => client } as unknown as Pool, async () => 'user')
    await expect(service.read(school)).rejects.toThrow('FORBIDDEN')
    await expect(service.execute(school, 'addLearner', { display_name: 'Test learner' })).rejects.toThrow('FORBIDDEN')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false)
  })
})
