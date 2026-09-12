import { describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ uploadToR2: vi.fn(), deleteFromR2: vi.fn(), getR2PresignedUrl: vi.fn() }))
vi.mock('@/lib/r2', () => storage)
vi.mock('@/lib/db', () => ({ db: new Proxy({}, { get() { throw new Error('Legacy database access reached') } }) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: 'signed-in-user' } }) } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import * as staff from '../../app/actions/staff-resources'
import * as notices from '../../app/actions/noticeboard'
import * as calendar from '../../app/actions/calendar'

const reads = new Set(['getMediaFolders','getMediaFiles','getStudents','getPortfolioFiles','getRootFolders','getFilesInFolder','getLatestAnnouncements','getEvents','getUpcomingEvents'])
describe('deferred legacy adapters never reach removed tables or R2', () => {
  for (const [moduleName, module] of Object.entries({ staff, notices, calendar })) {
    for (const [name, fn] of Object.entries(module)) {
      it(`${moduleName}.${name} fails closed`, async () => {
        const result = Reflect.apply(fn, undefined, [])
        if (reads.has(name)) await expect(result).resolves.toEqual([])
        else await expect(result).rejects.toThrow('awaiting integration')
        for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled()
      })
    }
  }
})

