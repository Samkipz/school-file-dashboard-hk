'use server'

import { administration } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { revalidatePath } from 'next/cache'
import type { RolloverPreview } from '@/lib/domain/learner-lifecycle'

export type AdminActionState = { ok: boolean; message: string; resourceId?: string; preview?: RolloverPreview }
export async function administer(school: string, operation: string, _previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  try {
    const input: Record<string, string> = {}
    for (const [key, value] of form.entries()) {
      const limit = key === 'selections' && ['previewRollover', 'commitRollover'].includes(operation) ? 60000 : 500
      if (typeof value !== 'string' || value.length > limit) return { ok: false, message: 'Check the form values and try again.' }
      input[key] = value
    }
    const resourceId = await administration.execute(school, operation, input)
    if (operation === 'previewRollover') return { ok: true, message: 'Preview ready. Review every selected outcome before confirming.', preview: JSON.parse(resourceId) }
    revalidatePath('/admin/academics')
    revalidatePath('/academics')
    if (operation === 'commitRollover') {
      const result = JSON.parse(resourceId)
      return { ok: true, message: `Rollover complete: ${result.learners} learners; ${result.enrolments} enrolments; ${result.placements} placements; ${result.subjects} subjects; ${result.teacherAssignments} teacher assignments; ${result.completed} completed; ${result.withdrawn} withdrawn.` }
    }
    return { ok: true, message: 'Saved successfully.', resourceId }
  } catch (error) {
    const messages = {
      UNAUTHORIZED: 'Your session has expired. Sign in again.',
      FORBIDDEN: 'School administrator access is required for this school.',
      NOT_FOUND: 'A selected record is unavailable in this school. Refresh and try again.',
      INVALID_INPUT: 'Check required fields, dates, year and grade. Dates must fit the parent record and must not overlap existing records.',
      CONFLICT: 'This record already exists or changed while you were editing. Refresh and check its history before retrying.',
    }
    return { ok: false, message: error instanceof DomainError ? messages[error.code] : 'Unable to save. Please try again.' }
  }
}
