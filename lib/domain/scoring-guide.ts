import { DomainError, learnerName, uuidInput } from './validation.ts'
import { record } from './assessment-validation.ts'

export class DefinitionError extends DomainError {
  readonly issues: string[]
  constructor(issues: string[]) { super('INVALID_INPUT'); this.issues = issues }
}
export type Indicator = { id?: string; descriptor: string; score: string }
export type Criterion = { id?: string; title: string; description: string | null; indicators: Indicator[] }
export type PerformanceLevel = { id?: string; code: string | null; descriptor: string; lower: string; upper: string }
export type Guide = { criteria: Criterion[] }

// Authoritative arithmetic uses integer hundredths, never floating-point scores.
// Limits keep sums (100 tasks x 100 criteria) inside Number's exact integer range.
export function scoreUnits(value: unknown): number {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(value)) throw new DefinitionError(['Scores must be decimal text from 0 to 999999.99, with at most two decimal places.'])
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
export function scoreText(units: number): string { return `${Math.floor(units / 100)}.${String(units % 100).padStart(2, '0')}` }
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new DefinitionError([`Use at most ${maximum} entries.`])
  return value
}
function descriptor(value: unknown, limit = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\u0000')) throw new DefinitionError([`Enter a description of 1–${limit} characters.`])
  return value.trim()
}
function identity(value: Record<string, unknown>, ids: Set<string>) {
  if (value.id === undefined) return {}
  const id = uuidInput(value.id as string).toLowerCase()
  if (ids.has(id)) throw new DefinitionError(['Duplicate definition IDs are not allowed.'])
  ids.add(id)
  return { id }
}
export function criteriaInput(value: unknown): Criterion[] {
  const ids = new Set<string>()
  return list(value, 100).map(raw => {
    const c = record(raw), scores = new Set<number>()
    return { ...identity(c, ids), title: learnerName(descriptor(c.title, 160)), description: c.description == null || c.description === '' ? null : descriptor(c.description, 4000),
      indicators: list(c.indicators, 100).map(raw => {
        const i = record(raw), units = scoreUnits(i.score)
        if (scores.has(units)) throw new DefinitionError(['Each indicator in a criterion must award a distinct score.'])
        scores.add(units)
        return { ...identity(i, ids), descriptor: descriptor(i.descriptor), score: i.score as string }
      }) }
  })
}
export function scaleInput(value: unknown): PerformanceLevel[] {
  const ids = new Set<string>()
  return list(value, 100).map(raw => {
    const level = record(raw)
    const lower = scoreUnits(level.lower), upper = scoreUnits(level.upper)
    if (lower > upper) throw new DefinitionError(['A performance range lower boundary must not exceed its upper boundary.'])
    return { ...identity(level, ids), code: level.code == null || level.code === '' ? null : descriptor(level.code, 32), descriptor: descriptor(level.descriptor, 160), lower: level.lower as string, upper: level.upper as string }
  })
}
export function derivedMaximum(tasks: Guide[]) {
  const criteria = tasks.map(t => t.criteria.map(c => Math.max(0, ...c.indicators.map(i => scoreUnits(i.score)))))
  const taskUnits = criteria.map(values => values.reduce((sum, value) => sum + value, 0))
  return { criteria, tasks: taskUnits, total: taskUnits.reduce((sum, value) => sum + value, 0) }
}
export function validateScale(levels: PerformanceLevel[], maximum: number) {
  if (!levels.length) return
  const sorted = [...levels].sort((a, b) => scoreUnits(a.lower) - scoreUnits(b.lower))
  let next = 0
  for (const level of sorted) {
    const lower = scoreUnits(level.lower), upper = scoreUnits(level.upper)
    if (lower !== next || upper < lower) throw new DefinitionError(['Performance ranges must cover every hundredth without gaps or overlaps, starting at zero.'])
    next = upper + 1
  }
  if (next !== maximum + 1) throw new DefinitionError(['The final performance boundary must equal the derived assessment maximum.'])
}
export function interpretScore(value: string, levels: PerformanceLevel[]) {
  const units = scoreUnits(value)
  return levels.find(level => units >= scoreUnits(level.lower) && units <= scoreUnits(level.upper)) ?? null
}
export function validateOpening(tasks: Guide[], levels: PerformanceLevel[]) {
  const issues: string[] = []
  if (!tasks.length) issues.push('Add at least one task.')
  tasks.forEach((task, t) => {
    if (!task.criteria.length) issues.push(`Task ${t + 1}: add at least one criterion.`)
    task.criteria.forEach((criterion, c) => { if (!criterion.indicators.length) issues.push(`Task ${t + 1}, criterion ${c + 1}: add at least one indicator.`) })
  })
  const maximum = derivedMaximum(tasks)
  if (maximum.total <= 0) issues.push('The assessment maximum must be greater than zero.')
  if (issues.length) throw new DefinitionError(issues)
  validateScale(levels, maximum.total)
  return maximum
}
