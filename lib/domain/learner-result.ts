import { DomainError, uuidInput } from './validation.ts'
import { record } from './assessment-validation.ts'
import { DefinitionError, derivedMaximum, scoreUnits, scoreText, type Guide, type PerformanceLevel } from './scoring-guide.ts'

export type ResultStatus = 'in_progress' | 'completed' | 'absent'
export type Observation = { criterion_id: string; indicator_id: string }
export type EvidenceInput = { asset_id: string; task_id: string | null; criterion_id: string | null }
export type ResultInput = { observations: Observation[]; feedback: string | null; evidence: EvidenceInput[] }
export const statusLabel = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', absent: 'Absent' }

export function resultInput(value: unknown): ResultInput {
  const raw = record(value)
  if (Object.keys(raw).some(k => !['observations', 'feedback', 'evidence'].includes(k))) throw new DomainError('INVALID_INPUT')
  if (!Array.isArray(raw.observations) || raw.observations.length > 10000 || !Array.isArray(raw.evidence) || raw.evidence.length > 100) throw new DomainError('INVALID_INPUT')
  if (raw.feedback != null && (typeof raw.feedback !== 'string' || raw.feedback.length > 4000 || raw.feedback.includes('\u0000'))) throw new DefinitionError(['Feedback must be at most 4,000 characters.'])
  const seen = new Set<string>(), assets = new Set<string>()
  const observations = raw.observations.map(value => {
    const row = record(value)
    if (Object.keys(row).some(k => !['criterion_id','indicator_id'].includes(k))) throw new DomainError('INVALID_INPUT')
    const criterion_id = uuidInput(row.criterion_id as string).toLowerCase(), indicator_id = uuidInput(row.indicator_id as string).toLowerCase()
    if (seen.has(criterion_id)) throw new DomainError('INVALID_INPUT')
    seen.add(criterion_id)
    return { criterion_id, indicator_id }
  })
  const evidence = raw.evidence.map(value => {
    const row = record(value)
    if (Object.keys(row).some(k => !['asset_id','task_id','criterion_id'].includes(k))) throw new DomainError('INVALID_INPUT')
    const asset_id = uuidInput(row.asset_id as string).toLowerCase()
    if (assets.has(asset_id)) throw new DomainError('INVALID_INPUT')
    assets.add(asset_id)
    return { asset_id, task_id: row.task_id == null ? null : uuidInput(row.task_id as string).toLowerCase(), criterion_id: row.criterion_id == null ? null : uuidInput(row.criterion_id as string).toLowerCase() }
  })
  return { observations, feedback: (raw.feedback as string | null)?.trim() || null, evidence }
}

export function calculateResult(tasks: Guide[], levels: PerformanceLevel[], observations: Observation[], status: ResultStatus | 'not_started') {
  const maximum = derivedMaximum(tasks), selected = new Map<string, string>()
  for (const o of observations) {
    if (selected.has(o.criterion_id)) throw new DomainError('INVALID_INPUT')
    selected.set(o.criterion_id, o.indicator_id)
  }
  const missing: string[] = []
  const taskResults = tasks.map((task, t) => {
    let observed = 0, units = 0
    const criteria = task.criteria.map((c, n) => {
      const chosen = c.id ? selected.get(c.id) : undefined
      const indicator = chosen ? c.indicators.find(i => i.id === chosen) : undefined
      if (chosen && !indicator) throw new DomainError('INVALID_INPUT')
      if (c.id) selected.delete(c.id)
      if (indicator) { observed++; units += scoreUnits(indicator.score) }
      else missing.push(`Task ${t + 1}, criterion ${n + 1}: ${c.title}`)
      return { criterion_id: c.id, indicator: indicator ?? null, units: indicator ? scoreUnits(indicator.score) : null, maximum: maximum.criteria[t][n] }
    })
    return { units, observed, required: task.criteria.length, maximum: maximum.tasks[t], criteria }
  })
  if (selected.size) throw new DomainError('INVALID_INPUT')
  const total = taskResults.reduce((sum, task) => sum + task.units, 0)
  const scored = status !== 'absent' && status !== 'not_started'
  if (!scored && observations.length) throw new DomainError('INVALID_INPUT')
  return { tasks: taskResults, missing, observed: observations.length, required: taskResults.reduce((sum,t) => sum + t.required,0),
    units: scored ? total : null, score: scored ? scoreText(total) : null, maximum: scoreText(maximum.total),
    performance: scored && !missing.length ? levels.find(l => total >= scoreUnits(l.lower) && total <= scoreUnits(l.upper)) ?? null : null }
}
export function requireComplete(result: ReturnType<typeof calculateResult>) {
  if (result.missing.length) throw new DefinitionError([`${result.missing.length} criteria still need observations before this learner can be completed.`, ...result.missing])
}
export function requireTransition(status: ResultStatus | 'not_started', command: 'save' | 'complete' | 'absent' | 'begin') {
  if (status === 'completed' || (status === 'absent' && command !== 'begin') || (command === 'begin' && !['absent','not_started'].includes(status))) throw new DomainError('CONFLICT')
}
export function nextLearner(roster: { id: string }[], current: string) {
  const index = roster.findIndex(l => l.id === current)
  if (index < 0) throw new DomainError('NOT_FOUND')
  return roster[index + 1]?.id ?? null
}
