'use server'

import { assessments } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { revalidatePath } from 'next/cache'
import { record } from '@/lib/domain/assessment-validation'
import { DefinitionError } from '@/lib/domain/scoring-guide'

export type AssessmentActionState = { ok: boolean; message: string; resourceId?: string }
export async function planAssessment(school: string, operation: string, _previous: AssessmentActionState, form: FormData): Promise<AssessmentActionState> {
  try {
    let resourceId: string | undefined
    if (operation === 'initializeTypes') await assessments.initializeTypes(school)
    else {
      const payload = form.get('payload')
      // Allow JSON escaping at the 100-task/4,000-character field limits.
      if (typeof payload !== 'string' || payload.length > 3000000) throw new DomainError('INVALID_INPUT')
      let input: Record<string, unknown>
      try { input = record(JSON.parse(payload)) } catch { throw new DomainError('INVALID_INPUT') }
      const id = input.id === undefined ? undefined : typeof input.id === 'string' ? input.id : (() => { throw new DomainError('INVALID_INPUT') })()
      const version = input.expectedVersion === undefined ? undefined : typeof input.expectedVersion === 'number' ? input.expectedVersion : (() => { throw new DomainError('INVALID_INPUT') })()
      if (operation === 'save') resourceId = (await assessments.save(school, input, id, version)).id
      else if (operation === 'open' && id && version) resourceId = (await assessments.open(school, id, version)).id
      else if (operation === 'saveType') resourceId = await assessments.saveType(school, input, id, version)
      else throw new DomainError('INVALID_INPUT')
    }
    revalidatePath('/admin/assessments')
    revalidatePath('/academics')
    return { ok: true, message: operation === 'open' ? 'Assessment opened. The definition is locked.' : 'Saved successfully.', resourceId }
  } catch (error) {
    const messages = {
      UNAUTHORIZED: 'Your session has expired. Sign in again.', FORBIDDEN: 'You need school administrator access or a current teaching assignment for this offering.',
      NOT_FOUND: 'This draft is unavailable in this school.', INVALID_INPUT: 'Check fields, task limits and dates. Dates must fit the offering academic year; the term must belong to that year.',
      CONFLICT: 'This record changed or its code already exists. Reload and review before retrying.',
    }
    return { ok: false, message: error instanceof DefinitionError ? error.issues.join(' ') : error instanceof DomainError ? messages[error.code] : 'Unable to save. Please try again.' }
  }
}
