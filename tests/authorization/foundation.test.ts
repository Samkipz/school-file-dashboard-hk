import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { foundationService } from '../../lib/domain/foundation'

describe('foundation authentication boundary', () => {
  it('rejects missing sessions before opening a connection', async () => {
    const connect = vi.fn()
    const query = vi.fn()
    const service = foundationService({ connect, query } as unknown as Pool, async () => null)
    await expect(service.listSchools()).rejects.toThrow('UNAUTHORIZED')
    await expect(service.getFoundation('12345678-1234-4123-8123-123456789012')).rejects.toThrow('UNAUTHORIZED')
    expect(connect).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })
  it('rolls back and releases the connection when membership is absent', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
    const service = foundationService({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, async () => 'authenticated-user')
    await expect(service.getFoundation('12345678-1234-4123-8123-123456789012')).rejects.toThrow('FORBIDDEN')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
  })
})
