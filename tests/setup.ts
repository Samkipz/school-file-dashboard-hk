import { vi } from 'vitest'

// Unit tests must not initialize real database, auth or object-storage clients.
vi.mock('pg', () => {
  throw new Error('Database access is forbidden in the unit test suite')
})
vi.mock('better-auth', () => {
  throw new Error('Mock the session boundary in unit tests; do not initialize Better Auth')
})
vi.mock('@aws-sdk/client-s3', () => {
  throw new Error('Object storage access is forbidden in the unit test suite')
})
