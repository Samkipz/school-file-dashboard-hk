import { DomainError, learnerName, uuidInput } from './validation.ts'
import { dateInput } from './administration.ts'

export const initialAssessmentTypes = [
  ['PROJECT', 'Project'], ['PRACTICAL', 'Practical'], ['PERFORMANCE_TASK', 'Performance task'],
  ['WRITTEN_TEST', 'Written test'], ['CLASSROOM_ASSESSMENT', 'Classroom assessment'],
] as const
export type PlanningFields = { title: string; instructions: string | null; starts_on: string | null; due_on: string | null }
export type TaskInput = PlanningFields & { id?: string }
export type DraftInput = PlanningFields & { offering_id: string; term_id: string | null; assessment_type_id: string; tasks: TaskInput[] }
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('INVALID_INPUT')
  return value as Record<string, unknown>
}
function text(value: unknown) { if (typeof value !== 'string' || value.includes('\u0000')) throw new DomainError('INVALID_INPUT'); return value }
function optionalDate(value: unknown) { return value === null || value === undefined || value === '' ? null : dateInput(text(value)) }
export function planningFields(value: unknown): PlanningFields {
  const input = record(value)
  const title = learnerName(text(input.title))
  const instructions = input.instructions == null ? null : text(input.instructions).trim() || null
  if (instructions && instructions.length > 4000) throw new DomainError('INVALID_INPUT')
  const starts_on = optionalDate(input.starts_on), due_on = optionalDate(input.due_on)
  if (starts_on && due_on && starts_on > due_on) throw new DomainError('INVALID_INPUT')
  return { title, instructions, starts_on, due_on }
}
export function draftInput(value: unknown): DraftInput {
  const input = record(value)
  if (!Array.isArray(input.tasks) || input.tasks.length > 100) throw new DomainError('INVALID_INPUT')
  const ids = new Set<string>()
  const tasks = input.tasks.map(value => {
    const task = record(value)
    const id = task.id === undefined ? undefined : uuidInput(text(task.id)).toLowerCase()
    if (id && ids.has(id)) throw new DomainError('INVALID_INPUT')
    if (id) ids.add(id)
    return { ...planningFields(task), ...(id ? { id } : {}) }
  })
  return { ...planningFields(input), offering_id: uuidInput(text(input.offering_id)),
    term_id: input.term_id == null || input.term_id === '' ? null : uuidInput(text(input.term_id)),
    assessment_type_id: uuidInput(text(input.assessment_type_id)), tasks }
}
export function versionInput(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new DomainError('INVALID_INPUT')
  return value
}
export function typeInput(value: unknown) {
  const input = record(value), code = text(input.code), name = learnerName(text(input.name))
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code) || typeof input.enabled !== 'boolean') throw new DomainError('INVALID_INPUT')
  return { code, name, enabled: input.enabled }
}
