'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { planAssessment } from '@/app/actions/assessments'
import type { AssessmentData, AssessmentDraft, AssessmentType } from '@/lib/domain/assessments'
import type { PlanningFields } from '@/lib/domain/assessment-validation'

const empty: PlanningFields = { title: '', instructions: null, starts_on: null, due_on: null }
const initial = { ok: false, message: '' }
const fieldClass = 'block w-full min-w-0 rounded border p-2 bg-background'
function Fields({ value, change, prefix }: { value: PlanningFields; change: (value: PlanningFields) => void; prefix: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="sm:col-span-2">Title<input aria-label={`${prefix} title`} className={fieldClass} required maxLength={160} value={value.title} onChange={e => change({ ...value, title: e.target.value })} /></label>
    <label className="sm:col-span-2">Instructions<textarea aria-label={`${prefix} instructions`} className={fieldClass} maxLength={4000} value={value.instructions ?? ''} onChange={e => change({ ...value, instructions: e.target.value || null })} /></label>
    <label>Start date (optional)<input aria-label={`${prefix} start date`} className={fieldClass} type="date" value={value.starts_on ?? ''} onChange={e => change({ ...value, starts_on: e.target.value || null })} /></label>
    <label>Due date (optional)<input aria-label={`${prefix} due date`} className={fieldClass} type="date" value={value.due_on ?? ''} onChange={e => change({ ...value, due_on: e.target.value || null })} /></label>
  </div>
}
function TypeForm({ school, type }: { school: string; type?: AssessmentType }) {
  const [state, action, pending] = useActionState(planAssessment.bind(null, school, 'saveType'), initial)
  const [value, setValue] = useState({ code: type?.code ?? '', name: type?.name ?? '', enabled: type?.enabled ?? true })
  return <form action={action} className="border rounded p-4 space-y-3">
    <h3 className="font-semibold">{type ? `Edit ${type.name}` : 'Add assessment type'}</h3>
    <input type="hidden" name="payload" value={JSON.stringify({ ...value, id: type?.id, expectedVersion: type ? Number(type.row_version) : undefined })} />
    <label className="block">Code<input className={fieldClass} required maxLength={64} pattern="[A-Z][A-Z0-9_]*" value={value.code} onChange={e => setValue({ ...value, code: e.target.value })} /></label>
    <label className="block">Name<input className={fieldClass} required maxLength={160} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={value.enabled} onChange={e => setValue({ ...value, enabled: e.target.checked })} />Enabled for planning</label>
    <Button type="submit" disabled={pending}>Save type</Button>
    {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
  </form>
}
export function AssessmentPlanning({ school, data, selected }: { school: string; data: AssessmentData; selected?: AssessmentDraft }) {
  const router = useRouter()
  const [fields, setFields] = useState<PlanningFields>(selected ?? empty)
  const [offering, setOffering] = useState(selected?.offering_id ?? '')
  const [term, setTerm] = useState(selected?.term_id ?? '')
  const [type, setType] = useState(selected?.assessment_type_id ?? '')
  const [tasks, setTasks] = useState<(PlanningFields & { id?: string; clientKey?: string })[]>(selected?.tasks ?? [])
  // The version belongs to the opened form; refreshed list props must not silently replace it.
  const [version] = useState(selected ? Number(selected.row_version) : undefined)
  const [state, action, pending] = useActionState(async (previous: typeof initial, form: FormData) => {
    const result = await planAssessment(school, 'save', previous, form)
    if (result.ok && result.resourceId) router.push(`/admin/assessments?school=${school}&draft=${result.resourceId}`)
    return result
  }, initial)
  const [typesState, typesAction, typesPending] = useActionState(planAssessment.bind(null, school, 'initializeTypes'), initial)
  const year = data.offerings.find(o => o.id === offering)?.academic_year_id
  function move(index: number, delta: number) { const next = [...tasks]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setTasks(next) }
  return <div className="space-y-6">
    <section className="space-y-2"><h2 className="text-xl font-semibold">Draft assessments</h2>
      <Link className="underline" href={`/admin/assessments?school=${school}`}>New draft</Link>
      {data.drafts.length ? <ul className="space-y-2">{data.drafts.map(d => <li key={d.id}><Link className="underline break-words" href={`/admin/assessments?school=${school}&draft=${d.id}`}>{d.title}</Link> — Draft · {d.tasks.length} tasks</li>)}</ul> : <p>No drafts yet.</p>}
    </section>
    <form action={action} className="border rounded p-4 space-y-4" aria-label="Assessment draft">
      <h2 className="text-xl font-semibold">{selected ? 'Edit draft' : 'Create draft'}</h2><p>Status: Draft</p>
      <input type="hidden" name="payload" value={JSON.stringify({ ...fields, id: selected?.id, expectedVersion: version, offering_id: offering, term_id: term || null, assessment_type_id: type, tasks })} />
      <label className="block">Subject offering<select aria-label="Subject offering" className={fieldClass} required value={offering} onChange={e => { setOffering(e.target.value); setTerm('') }}><option value="">Select offering</option>{selected && !data.offerings.some(o => o.id === selected.offering_id) && <option value={selected.offering_id}>Previous offering (unavailable for planning)</option>}{data.offerings.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <label className="block">Term (optional)<select aria-label="Term" className={fieldClass} value={term} onChange={e => setTerm(e.target.value)}><option value="">No term</option>{data.terms.filter(t => t.academic_year_id === year || t.id === selected?.term_id).map(t => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
      <label className="block">Assessment type<select aria-label="Assessment type" className={fieldClass} required value={type} onChange={e => setType(e.target.value)}><option value="">Select type</option>{data.types.filter(t => t.enabled || t.id === selected?.assessment_type_id).map(t => <option key={t.id} value={t.id}>{t.name}{!t.enabled ? ' (disabled)' : ''}</option>)}</select></label>
      <Fields prefix="Assessment" value={fields} change={setFields} />
      <h3 className="font-semibold">Ordered tasks ({tasks.length}/100)</h3><p>Tasks may be added later. Dates may span terms within the offering year.</p>
      {tasks.map((task, i) => <fieldset className="border rounded p-3 space-y-3 min-w-0" key={task.id ?? task.clientKey}><legend>Task {i + 1}</legend>
        <Fields prefix={`Task ${i + 1}`} value={task} change={value => setTasks(tasks.map((t, n) => n === i ? { ...t, ...value } : t))} />
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={i === 0} onClick={() => move(i, -1)}>Move up</Button><Button type="button" disabled={i === tasks.length - 1} onClick={() => move(i, 1)}>Move down</Button><Button type="button" onClick={() => setTasks(tasks.filter((_, n) => n !== i))}>Remove task</Button></div>
      </fieldset>)}
      <div className="flex flex-wrap gap-3"><Button type="button" disabled={tasks.length === 100} onClick={() => setTasks([...tasks, { ...empty, clientKey: crypto.randomUUID() }])}>Add task</Button><Button type="submit" disabled={pending}>Save draft</Button><Button type="button" onClick={() => window.location.reload()}>Reload</Button></div>
      {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
    </form>
    <details><summary className="cursor-pointer font-semibold">Configure assessment types</summary><div className="space-y-4 mt-4">
      <form action={typesAction}><Button type="submit" disabled={typesPending}>Add standard planning types</Button>{typesState.message && <p role={typesState.ok ? 'status' : 'alert'}>{typesState.message}</p>}</form>
      <TypeForm school={school} />{data.types.map(t => <TypeForm key={`${t.id}:${t.row_version}`} school={school} type={t} />)}
    </div></details>
  </div>
}
