'use server'

import { foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { revalidatePath } from 'next/cache'

export async function getOfferingRoster(schoolId: string, offeringId: string) {
  try { return await foundation.getOfferingRoster(schoolId, offeringId) }
  catch (error) { throw new Error(error instanceof DomainError ? error.code : 'Unable to load roster') }
}
export async function renameLearner(schoolId: string, learnerId: string, name: string, expectedVersion: number) {
  try {
    const result = await foundation.renameLearner(schoolId, learnerId, name, expectedVersion)
    revalidatePath('/academics')
    return result
  } catch (error) { throw new Error(error instanceof DomainError ? error.code : 'Unable to update learner') }
}
