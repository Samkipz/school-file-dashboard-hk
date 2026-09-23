'use server'
import { revalidatePath } from 'next/cache'
import { learnerAssessments } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { DefinitionError } from '@/lib/domain/scoring-guide'
import { record } from '@/lib/domain/assessment-validation'

export async function assessLearner(school: string, assessment: string, learner: string, form: FormData) {
  try {
    const payload = form.get('payload'), command = form.get('command')
    if (typeof payload !== 'string' || payload.length > 2000000 || !['save','complete','absent','begin'].includes(String(command))) throw new DomainError('INVALID_INPUT')
    let raw: Record<string, unknown>
    try { raw = record(JSON.parse(payload)) } catch { throw new DomainError('INVALID_INPUT') }
    if (Object.keys(raw).some(k => !['expectedVersion','input'].includes(k))) throw new DomainError('INVALID_INPUT')
    const saved = await learnerAssessments.mutate(school,assessment,learner,command as 'save' | 'complete' | 'absent' | 'begin',raw.expectedVersion as number,raw.input)
    revalidatePath('/academics')
    return { ok: true, message: command === 'complete' ? `Completed: ${saved.result?.score} / ${saved.result?.maximum}.` : command === 'absent' ? 'Marked absent. No score assigned.' : 'Saved. In progress.', next: saved.next }
  } catch (error) {
    const messages = { UNAUTHORIZED: 'Your session expired. Sign in again.', FORBIDDEN: 'A current teaching assignment is required.', NOT_FOUND: 'This assessment, learner or evidence is unavailable in your current roster.', INVALID_INPUT: 'Check the selected observations and evidence.', CONFLICT: 'This record changed or is read-only. Reload and review before retrying.' }
    return { ok: false, message: error instanceof DefinitionError ? error.issues.join(' ') : error instanceof DomainError ? messages[error.code] : 'Unable to save. Your changes have not been saved. Please try again.', next: null }
  }
}
