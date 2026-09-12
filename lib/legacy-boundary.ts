import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// Removed tables must never be queried, nor old R2 operations reached.
// There is deliberately no environment switch that re-enables this adapter.
export function legacyUnavailable() { return true }
export async function legacyEmptyRead() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return true
}
export async function rejectLegacyOperation(): Promise<void> {
  throw new Error('This feature is awaiting integration with the school foundation.')
}
