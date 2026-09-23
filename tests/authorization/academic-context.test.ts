import { beforeEach, expect, it, vi } from 'vitest'
import { DomainError } from '../../lib/domain/foundation'
const mocks = vi.hoisted(() => ({ listSchools: vi.fn(), getSchoolContext: vi.fn(), getFoundation: vi.fn(), getOfferingRoster: vi.fn() }))
vi.mock('@/lib/domain/server', () => ({ foundation: mocks }))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
import { loadSchoolContext, loadTeaching } from '../../lib/academic-context'

beforeEach(() => vi.resetAllMocks())
it('redirects anonymous users before loading school context', async () => {
  mocks.listSchools.mockRejectedValue(new DomainError('UNAUTHORIZED'))
  await expect(loadSchoolContext()).rejects.toThrow('redirect:/sign-in')
  expect(mocks.getSchoolContext).not.toHaveBeenCalled()
})
it('never queries context outside the authenticated memberships', async () => {
  mocks.listSchools.mockResolvedValue([{ id: 'own', name: 'Own school' }])
  expect((await loadSchoolContext('foreign')).denied).toBe(true)
  expect(mocks.getSchoolContext).not.toHaveBeenCalled()
})
it('requires an explicit choice for multiple memberships', async () => {
  mocks.listSchools.mockResolvedValue([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
  expect((await loadSchoolContext()).school).toBeUndefined()
  expect(mocks.getSchoolContext).not.toHaveBeenCalled()
})
it('exposes no capabilities after a revoked membership or role', async () => {
  mocks.listSchools.mockResolvedValue([{ id: 'own', name: 'Own school' }])
  mocks.getSchoolContext.mockRejectedValue(new DomainError('FORBIDDEN'))
  expect(await loadSchoolContext('own')).toMatchObject({ context: null, denied: true })
})
it('does not disguise a database failure as an empty school or zero learners', async () => {
  mocks.listSchools.mockRejectedValue(new Error('database unavailable'))
  await expect(loadSchoolContext()).rejects.toThrow('database unavailable')
  mocks.getFoundation.mockResolvedValue({ offerings: [{ id: 'offering' }] })
  mocks.getOfferingRoster.mockRejectedValue(new DomainError('NOT_FOUND'))
  await expect(loadTeaching('own')).rejects.toThrow('NOT_FOUND')
})
it('uses assigned scope and the authorized roster for each count', async () => {
  mocks.getFoundation.mockResolvedValue({ offerings: [{ id: 'offering-a', subject: 'A' }, { id: 'offering-b', subject: 'B' }] })
  mocks.getOfferingRoster.mockImplementation(async (_school: string, offering: string) => offering === 'offering-a' ? [{ id: 'learner' }] : [])
  expect(await loadTeaching('own')).toEqual([{ id: 'offering-a', subject: 'A', learnerCount: 1 }, { id: 'offering-b', subject: 'B', learnerCount: 0 }])
  expect(mocks.getFoundation).toHaveBeenCalledWith('own', 'assigned')
  expect(mocks.getOfferingRoster).toHaveBeenCalledWith('own', 'offering-a')
  expect(mocks.getOfferingRoster).toHaveBeenCalledWith('own', 'offering-b')
})
