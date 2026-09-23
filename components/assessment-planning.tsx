'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { planAssessment } from '@/app/actions/assessments'
import type { AssessmentData, AssessmentDraft, AssessmentType } from '@/lib/domain/assessments'
import { CriteriaEditor, ScaleEditor } from '@/components/scoring-guide-editor'
import type { Criterion, PerformanceLevel } from '@/lib/domain/scoring-guide'
import type { PlanningFields } from '@/lib/domain/assessment-validation'

const empty: PlanningFields = { title: '', instructions: null, starts_on: null, due_on: null }
const initial = { ok: false, message: '' }
const fieldClass = 'block w-full min-w-0 rounded border bg-background p-3'
const labelClass = 'block space-y-1.5'
const helperClass = 'text-sm text-muted-foreground'
export function Fields({ value, change, prefix }: { value: PlanningFields; change: (value: PlanningFields) => void; prefix: string }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className={`${labelClass} sm:col-span-2`}><span className="font-medium">Title</span><p className={helperClass}>What will learners do? A clear, specific name for this assessment.</p><input aria-label={`${prefix} title`} className={fieldClass} required maxLength={160} value={value.title} onChange={e => change({ ...value, title: e.target.value })} /></label>
    <label className={`${labelClass} sm:col-span-2`}><span className="font-medium">Instructions</span><p className={helperClass}>What should learners know before starting? Include any special requirements or context.</p><textarea aria-label={`${prefix} instructions`} className={fieldClass} maxLength={4000} rows={3} value={value.instructions ?? ''} onChange={e => change({ ...value, instructions: e.target.value || null })} /></label>
    <label className={labelClass}><span className="font-medium">Start date (optional)</span><p className={helperClass}>When does this assessment become available to learners?</p><input aria-label={`${prefix} start date`} className={fieldClass} type="date" value={value.starts_on ?? ''} onChange={e => change({ ...value, starts_on: e.target.value || null })} /></label>
    <label className={labelClass}><span className="font-medium">Due date (optional)</span><p className={helperClass}>When must learners complete this assessment?</p><input aria-label={`${prefix} due date`} className={fieldClass} type="date" value={value.due_on ?? ''} onChange={e => change({ ...value, due_on: e.target.value || null })} /></label>
  </div>
}
function TypeForm({ school, type }: { school: string; type?: AssessmentType }) {
  const [state, action, pending] = useActionState(planAssessment.bind(null, school, 'saveType'), initial)
  const [value, setValue] = useState({ code: type?.code ?? '', name: type?.name ?? '', enabled: type?.enabled ?? true })
  return <form action={action} className="border rounded p-5 space-y-4">
    <h3 className="font-semibold">{type ? `Edit ${type.name}` : 'Add assessment type'}</h3>
    <input type="hidden" name="payload" value={JSON.stringify({ ...value, id: type?.id, expectedVersion: type ? Number(type.row_version) : undefined })} />
    <label className={labelClass}><span className="font-medium">Code</span><p className={helperClass}>Short identifier (uppercase, numbers, underscores only).</p><input className={fieldClass} required maxLength={64} pattern="[A-Z][A-Z0-9_]*" value={value.code} onChange={e => setValue({ ...value, code: e.target.value })} /></label>
    <label className={labelClass}><span className="font-medium">Name</span><p className={helperClass}>Display name for this assessment type.</p><input className={fieldClass} required maxLength={160} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={value.enabled} onChange={e => setValue({ ...value, enabled: e.target.checked })} /><span className="font-medium">Enabled for planning</span></label>
    <Button type="submit" disabled={pending}>Save type</Button>
    {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
  </form>
}
export function AssessmentPlanning({ school, data, selected, offeringId }: { school: string; data: AssessmentData; selected?: AssessmentDraft; offeringId?: string }) {
  const router = useRouter()
  const [fields, setFields] = useState<PlanningFields>(selected ?? empty)
  const [offering, setOffering] = useState(selected?.offering_id ?? offeringId ?? '')
  const [term, setTerm] = useState(selected?.term_id ?? '')
  const [type, setType] = useState(selected?.assessment_type_id ?? '')
  const [tasks, setTasks] = useState<(PlanningFields & { id?: string; clientKey?: string; criteria: Criterion[] })[]>(selected?.tasks ?? [])
  const [levels, setLevels] = useState<PerformanceLevel[]>(selected?.levels ?? [])
  const [origin, setOrigin] = useState(selected?.origin ?? 'internal')
  const [authority, setAuthority] = useState(selected?.authority ?? '')
  const [externalReference, setExternalReference] = useState(selected?.external_reference ?? '')
  const locked = selected?.status === 'open'
  const [dirty, setDirty] = useState(false)
  const href = (id?: string) => offeringId ? '/academics?' + new URLSearchParams({ school, offering: offeringId, view: 'assessments', ...(id ? { draft: id } : {}) }) : '/admin/assessments?' + new URLSearchParams({ school, ...(id ? { draft: id } : {}) })
  const [openState, openAction, opening] = useActionState(async (previous: typeof initial, form: FormData) => {
    const result = await planAssessment(school, 'open', previous, form)
    if (result.ok) router.refresh()
    return result
  }, initial)
  // The version belongs to the opened form; refreshed list props must not silently replace it.
  const [version] = useState(selected ? Number(selected.row_version) : undefined)
  const [state, action, pending] = useActionState(async (previous: typeof initial, form: FormData) => {
    const result = await planAssessment(school, 'save', previous, form)
    if (result.ok && result.resourceId) { router.push(href(result.resourceId)); router.refresh() }
    return result
  }, initial)
  const [typesState, typesAction, typesPending] = useActionState(planAssessment.bind(null, school, 'initializeTypes'), initial)
  const year = data.offerings.find(o => o.id === offering)?.academic_year_id
  function move(index: number, delta: number) { const next = [...tasks]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setTasks(next) }
  return <div className="space-y-6">
    <section className="space-y-2"><h2 className="text-xl font-semibold">Assessments</h2>
      <Link className="underline" href={href()}>{offeringId ? 'New assessment' : 'New draft'}</Link>
      {data.drafts.length ? <ul className="space-y-2">{data.drafts.map(d => <li key={d.id}><Link className="underline break-words" href={offeringId && d.status === 'open' ? '/academics?' + new URLSearchParams({school,offering:offeringId,view:'assessments',assessment:d.id}) : href(d.id)}>{d.title}</Link> — {d.status === 'open' ? 'Open' : 'Draft'} · Structured · {d.tasks.length} tasks</li>)}</ul> : <p>No assessments yet.</p>}
    </section>
    <form action={action} onChange={() => setDirty(true)} onClickCapture={e => { const button = (e.target as HTMLElement).closest('button'); if (button?.type === 'button' && button.textContent !== 'Reload') setDirty(true) }} className="border rounded p-4 space-y-4" aria-label="Assessment draft">
      <h2 className="text-xl font-semibold">{locked ? 'Assessment definition' : selected ? 'Edit draft' : 'Create draft'}</h2><p>Status: {locked ? 'Open - definition locked' : 'Draft'}</p>
      {selected && <p>Saved assessment maximum: {selected.maximum_score}</p>}
      {locked && offeringId && <Link className="underline" href={'/academics?' + new URLSearchParams({school,offering:offeringId,view:'assessments',assessment:selected!.id})}>Open assessment roster</Link>}
      <fieldset disabled={locked || pending} className="min-w-0 space-y-5">
      <input type="hidden" name="payload" value={JSON.stringify({ ...fields, id: selected?.id, expectedVersion: version, offering_id: offering, term_id: term || null, assessment_type_id: type, tasks, levels, origin, authority: authority || null, external_reference: externalReference || null })} />
      {!offeringId && <label className={labelClass}><span className="font-medium">Subject offering</span><p className={helperClass}>Choose the subject and class this assessment is for.</p><select aria-label="Subject offering" className={fieldClass} required value={offering} onChange={e => { setOffering(e.target.value); setTerm('') }}><option value="">Select offering</option>{selected && !data.offerings.some(o => o.id === selected.offering_id) && <option value={selected.offering_id}>Previous offering (unavailable for planning)</option>}{data.offerings.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
      <label className={labelClass}><span className="font-medium">Term (optional)</span><p className={helperClass}>Which term does this assessment belong to?</p><select aria-label="Term" className={fieldClass} value={term} onChange={e => setTerm(e.target.value)}><option value="">No term</option>{data.terms.filter(t => t.academic_year_id === year || t.id === selected?.term_id).map(t => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
      <label className={labelClass}><span className="font-medium">Assessment type</span><p className={helperClass}>What kind of assessment is this? (e.g., Quiz, Project, Exam)</p><select aria-label="Assessment type" className={fieldClass} required value={type} onChange={e => setType(e.target.value)}><option value="">Select type</option>{data.types.filter(t => t.enabled || t.id === selected?.assessment_type_id).map(t => <option key={t.id} value={t.id}>{t.name}{!t.enabled ? ' (disabled)' : ''}</option>)}</select></label>
      <label className={labelClass}><span className="font-medium">Origin</span><p className={helperClass}>Is this assessment created by your school or mandated externally?</p><select className={fieldClass} value={origin} onChange={e => { setOrigin(e.target.value as 'internal' | 'external'); setAuthority(''); setExternalReference('') }}><option value="internal">School / internal</option><option value="external">External authority</option></select></label>
      {origin === 'external' && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}><span className="font-medium">Authority name</span><p className={helperClass}>Name of the external body that mandates this assessment.</p><input className={fieldClass} required maxLength={160} value={authority} onChange={e => setAuthority(e.target.value)} /></label><label className={labelClass}><span className="font-medium">External reference (optional)</span><p className={helperClass}>Reference code or identifier from the external authority.</p><input className={fieldClass} maxLength={160} value={externalReference} onChange={e => setExternalReference(e.target.value)} /></label></div>}
      <Fields prefix="Assessment" value={fields} change={setFields} />
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold">Ordered tasks ({tasks.length}/100)</h3>
        <p className="text-sm text-muted-foreground">Tasks may be added later. Dates may span terms within the offering year.</p>
        {tasks.map((task, i) => <fieldset key={task.id ?? task.clientKey} className="rounded-xl border bg-card p-5 space-y-4"><legend className="font-medium">Task {i + 1}</legend>
          <Fields prefix={`Task ${i + 1}`} value={task} change={value => setTasks(tasks.map((t, n) => n === i ? { ...t, ...value } : t))} />
          <CriteriaEditor task={i + 1} value={task.criteria} change={criteria => setTasks(tasks.map((t, n) => n === i ? { ...t, criteria } : t))} />
          <div className="flex flex-wrap gap-2 pt-2 border-t"><Button type="button" disabled={i === 0} onClick={() => move(i, -1)} variant="outline">Move up</Button><Button type="button" disabled={i === tasks.length - 1} onClick={() => move(i, 1)} variant="outline">Move down</Button><Button type="button" onClick={() => { if (window.confirm("Remove this task and its scoring criteria? Save draft to apply this change.")) setTasks(tasks.filter((_, n) => n !== i)) }} variant="destructive">Remove task</Button></div>
        </fieldset>)}
      </div>
      <ScaleEditor value={levels} change={setLevels} />
      <div className="flex flex-wrap gap-3"><Button type="button" disabled={tasks.length === 100} onClick={() => setTasks([...tasks, { ...empty, criteria: [], clientKey: crypto.randomUUID() }])}>Add task</Button><Button type="submit" disabled={pending}>Save draft</Button><Button type="button" onClick={() => window.location.reload()}>Reload</Button></div>
      </fieldset>
      {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
    </form>
    {selected && !locked && <form action={openAction} onSubmit={e => { if (!window.confirm('Open this saved assessment? Its tasks, scoring guide and performance ranges will be locked. Save any changes first.')) e.preventDefault() }} className="space-y-3 rounded border p-4"><h3 className="font-semibold">Open assessment</h3><p>Opening locks the saved definition because learner assessment will depend on it. Save and review your draft first. Assigned teachers can then open the assessment roster.</p>{dirty && <p role="status">Save your changes before opening.</p>}<input type="hidden" name="payload" value={JSON.stringify({ id: selected.id, expectedVersion: version })} /><Button type="submit" disabled={opening || pending || dirty}>Open assessment</Button>{openState.message && <p role={openState.ok ? 'status' : 'alert'}>{openState.message}</p>}</form>}
    {!offeringId && <details><summary className="cursor-pointer font-semibold">Configure assessment types</summary><div className="space-y-4 mt-4">
      <form action={typesAction}><Button type="submit" disabled={typesPending}>Add standard planning types</Button>{typesState.message && <p role={typesState.ok ? 'status' : 'alert'}>{typesState.message}</p>}</form>
      <TypeForm school={school} />{data.types.map(t => <TypeForm key={`${t.id}:${t.row_version}`} school={school} type={t} />)}
    </div></details>}
  </div>
}
