'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowDown, ArrowUp, ArrowRight, ArrowLeft, ChevronDown, Trash2 } from 'lucide-react'
import { CriteriaEditor, ScaleEditor } from '@/components/scoring-guide-editor'
import { planAssessment } from '@/app/actions/assessments'
import type { AssessmentData, AssessmentDraft } from '@/lib/domain/assessments'
import { planningFields, type PlanningFields } from '@/lib/domain/assessment-validation'
import { criteriaInput, derivedMaximum, scaleInput, scoreText, validateOpening, validateScale, type Criterion, type PerformanceLevel } from '@/lib/domain/scoring-guide'

const steps = ['Details', 'Tasks and scoring', 'Result descriptions', 'Review']
const empty: PlanningFields = { title: '', instructions: null, starts_on: null, due_on: null }
const field = 'block w-full min-w-0 rounded-lg border bg-background p-3 focus-visible:outline-primary'
const labelClass = 'block space-y-1.5'

const link = 'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:outline-2'
type Task = PlanningFields & { id?: string; clientKey?: string; criteria: Criterion[] }

function Dates({ value, change, prefix }: { value: PlanningFields; change: (value: PlanningFields) => void; prefix: string }) {
  return <div className="grid gap-4 sm:grid-cols-2">{(['starts_on', 'due_on'] as const).map(key => <label key={key} className={labelClass}><span className="font-medium">{key === 'starts_on' ? 'Start date (optional)' : 'Due date (optional)'}</span><input aria-label={prefix + (key === 'starts_on' ? ' start date' : ' due date')} type="date" className={field} value={value[key] ?? ''} onChange={e => change({ ...value, [key]: e.target.value || null })} /></label>)}</div>
}
function Fields({ value, change, prefix, dates = true, reveal = false }: { value: PlanningFields; change: (value: PlanningFields) => void; prefix: string; dates?: boolean; reveal?: boolean }) {
  return <div className="space-y-4"><label className={labelClass}><span className="font-medium">{prefix === 'Assessment' ? 'Assessment name' : 'Task name'}</span><input aria-label={prefix + ' title'} className={field} required maxLength={160} value={value.title} onChange={e => change({ ...value, title: e.target.value })} /></label><label className={labelClass}><span className="font-medium">Learner instructions</span><textarea aria-label={prefix + ' instructions'} className={field} maxLength={4000} rows={3} value={value.instructions ?? ''} onChange={e => change({ ...value, instructions: e.target.value || null })} /></label>{dates && <details open={reveal || undefined} className="rounded-lg bg-muted/30 p-4"><summary className="cursor-pointer text-sm font-medium">Scheduling</summary><div className="mt-4"><Dates {...{ value, change, prefix }} /></div></details>}</div>
}

export function TeacherAssessments({ school, offeringId, data, selected, creating }: { school: string; offeringId: string; data: AssessmentData; selected?: AssessmentDraft; creating: boolean }) {
  const href = (extra: Record<string, string> = {}) => '/academics?' + new URLSearchParams({ school, offering: offeringId, view: 'assessments', ...extra })
  if (selected || creating) return <Preparation key={selected?.id ?? 'new'} {...{ school, offeringId, data, selected, href }} />
  return <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Assessments</h2><Link className={`${link} bg-primary text-primary-foreground hover:no-underline`} href={href({ prepare: 'new' })}>Create assessment</Link></div>
    {data.drafts.length ? <ul className="divide-y overflow-hidden rounded-xl border bg-card">{data.drafts.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><h3 className="break-words font-semibold">{a.title}</h3><p className="text-sm text-muted-foreground"><span className="mr-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{a.status === 'draft' ? 'Draft' : 'Open'}</span>{a.tasks.length} tasks · Maximum {a.maximum_score}</p></div><Link className={link} href={href(a.status === 'draft' ? { draft: a.id } : { assessment: a.id })}>{a.status === 'draft' ? 'Continue preparing' : 'Assess learners'}<ArrowRight aria-hidden="true" className="size-4" /><span className="sr-only">: {a.title}</span></Link></li>)}</ul> : <p className="text-muted-foreground">No assessments yet. Create one to start preparing.</p>}
  </section>
}

function Preparation({ school, offeringId, data, selected, href }: { school: string; offeringId: string; data: AssessmentData; selected?: AssessmentDraft; href: (extra?: Record<string, string>) => string }) {
  const [fields, setFields] = useState<PlanningFields>(selected ?? empty)
  const [type, setType] = useState(selected?.assessment_type_id ?? '')
  const [term, setTerm] = useState(selected?.term_id ?? '')
  const [origin, setOrigin] = useState(selected?.origin ?? 'internal')
  const [authority, setAuthority] = useState(selected?.authority ?? '')
  const [reference, setReference] = useState(selected?.external_reference ?? '')
  const [tasks, setTasks] = useState<Task[]>(selected?.tasks ?? [])
  const [levels, setLevels] = useState<PerformanceLevel[]>(selected?.levels ?? [])
  const [descriptions, setDescriptions] = useState(!!selected?.levels.length)
  const [step, setStep] = useState(selected?.status === 'open' ? 3 : 0)
  const [expanded, setExpanded] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [revealSections, setRevealSections] = useState(false)
  const [failed, setFailed] = useState(false)
  const [record] = useState(selected)
  const busy = useRef(false), unsaved = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const locked = record?.status === 'open'
  const preference = `assessment-step:${school}:${offeringId}:${record?.id ?? 'new'}`
  useEffect(() => {
    if (locked) return
    const frame = requestAnimationFrame(() => { try { const value = sessionStorage.getItem(preference); if (value !== null && /^[0-3]$/.test(value)) setStep(Number(value)) } catch { /* Presentation storage is optional. */ } })
    return () => cancelAnimationFrame(frame)
  }, [preference, locked])
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (unsaved.current || busy.current) { e.preventDefault(); e.returnValue = '' } }
    const confirm = () => !(unsaved.current || busy.current) || window.confirm('Leave preparation? Unsaved changes will be lost. A save in progress may still complete.')
    let approvedLink = false
    const click = (e: MouseEvent) => { const a = (e.target as Element).closest('a[href]'); if (!a) return; if (!confirm()) { e.preventDefault(); e.stopImmediatePropagation() } else { approvedLink = true; setTimeout(() => { approvedLink = false }, 0) } }
    // The Navigation API also covers browser Back/Forward where supported.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation
    const navigate = (e: Event) => { if (!approvedLink && e.cancelable && !confirm()) e.preventDefault() }
    window.addEventListener('beforeunload', before)
    if (navigation) navigation.addEventListener('navigate', navigate)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', before); navigation?.removeEventListener('navigate', navigate); document.removeEventListener('click', click, true) }
  }, [])
  function edit() { unsaved.current = true; setDirty(true); setMessage(''); setFailed(false) }
  function go(next: number) { setStep(next); try { sessionStorage.setItem(preference, String(next)) } catch {} requestAnimationFrame(() => heading.current?.focus()) }
  const issues: { step: number; text: string }[] = []
  const check = (at: number, run: () => void, fallback: string) => { try { run() } catch (error) { issues.push({ step: at, text: error && typeof error === 'object' && 'issues' in error ? (error.issues as string[]).join(' ') : fallback }) } }
  check(0, () => planningFields(fields), 'Enter an assessment name and check the dates and instructions.')
  if (!type) issues.push({ step: 0, text: 'Choose an assessment type.' })
  if (origin === 'external' && !authority.trim()) issues.push({ step: 0, text: 'Enter the external authority name.' })
  tasks.forEach((task, i) => { check(1, () => planningFields(task), `Task ${i + 1}: enter a title and check dates.`); check(1, () => criteriaInput(task.criteria), `Task ${i + 1}: check criteria and observations.`) })
  let maximum: ReturnType<typeof derivedMaximum> | undefined
  try { maximum = derivedMaximum(tasks) } catch { /* Invalid score fields are explained by criteria validation. */ }
  check(1, () => validateOpening(tasks, []), 'Check the tasks and scoring guide.')
  check(2, () => { const parsed = scaleInput(levels); if (maximum) validateScale(parsed, maximum.total) }, 'Check result descriptions and score ranges.')
  const payload = { ...fields, id: record?.id, expectedVersion: record ? Number(record.row_version) : undefined, offering_id: offeringId, term_id: term || null, assessment_type_id: type, tasks, levels, origin, authority: origin === 'external' ? authority : null, external_reference: origin === 'external' ? reference || null : null }
  async function submit(operation: 'save' | 'open') {
    if (busy.current) return
    if (operation === 'open' && !window.confirm('Opening makes the assessment available for assessing learners. Its tasks and scoring guide can no longer be edited.')) return
    busy.current = true; setPending(true); setFailed(false); setMessage(operation === 'save' ? 'Saving draft…' : 'Opening assessment…')
    try {
      const form = new FormData(); form.set('payload', JSON.stringify(operation === 'save' ? payload : { id: record?.id, expectedVersion: Number(record?.row_version) }))
      const result = await planAssessment(school, operation, { ok: false, message: '' }, form)
      setMessage(result.message); setFailed(!result.ok); if (!result.ok) setRevealSections(true)
      if (result.ok && result.resourceId) {
        unsaved.current = false; setDirty(false)
        // Fetch the committed definition before allowing another write: this preserves server IDs and version.
        busy.current = false
        try { sessionStorage.setItem(`assessment-step:${school}:${offeringId}:${result.resourceId}`, String(step)) } catch {}
        window.location.replace(href({ draft: result.resourceId }))
        return
      }
    } catch { setFailed(true); setRevealSections(true); setMessage('Unable to save. Your entered work is still here. Check your connection and try again.') }
    busy.current = false; setPending(false)
  }
  // Snapshot remains bound to its original revision even if parent props refresh.
  function reorder(i: number, delta: number) { const next = [...tasks]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; setTasks(next); setExpanded(i + delta); edit() }
const summary = <div className="space-y-6 break-words"><div><h3 className="text-xl font-semibold">{fields.title || 'Untitled assessment'}</h3><p className="whitespace-pre-wrap mt-2">{fields.instructions || 'No instructions'}</p><p className="mt-2 text-muted-foreground">{data.types.find(t => t.id === type)?.name ?? 'No type selected'} · {data.terms.find(t => t.id === term)?.code ?? 'No term'}</p><p className="mt-1 text-muted-foreground">{origin === 'external' ? `External: ${authority} ${reference}` : 'School / internal'}</p><p className="mt-1 text-muted-foreground">{fields.starts_on || 'No start date'} → {fields.due_on || 'No due date'}</p></div>
    {tasks.map((task, t) => <section key={task.id ?? task.clientKey ?? t} className="space-y-3 rounded-xl border bg-card p-5"><h4 className="font-semibold">Task {t + 1}: {task.title || 'Untitled'} · Maximum {maximum ? scoreText(maximum.tasks[t]) : '—'}</h4><p className="whitespace-pre-wrap">{task.instructions}</p><p className="text-muted-foreground">{task.starts_on || 'No start date'} → {task.due_on || 'No due date'}</p>{task.criteria.map((c, i) => <div key={c.id ?? i}><h5 className="font-medium">{c.title || 'Untitled criterion'} · Maximum {maximum ? scoreText(maximum.criteria[t][i]) : '—'}</h5><p className="whitespace-pre-wrap">{c.description}</p><ul className="list-disc pl-5 mt-1 space-y-1">{c.indicators.map((o, n) => <li key={o.id ?? n}>{o.descriptor || 'Missing observation'} — {o.score || 'Missing'} marks</li>)}</ul></div>)}</section>)}
    <p className="font-semibold pt-3 border-t">{locked ? 'Assessment maximum' : 'Maximum preview'}: {maximum ? scoreText(maximum.total) : 'Check scores'}</p>
    <div><h4 className="font-semibold">Result descriptions</h4>{levels.length ? <ul className="mt-2 space-y-1">{levels.map((l, i) => <li key={l.id ?? i} className="text-muted-foreground">{l.lower}–{l.upper}: {l.code} {l.descriptor}</li>)}</ul> : <p className="mt-2 text-muted-foreground">Marks only</p>}</div>
  </div>
  return <section className="space-y-6"><Link href={href()} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Back to assessments</Link>
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><h2 className="text-2xl font-semibold">{locked ? 'Assessment definition' : 'Prepare an assessment'}</h2><p role="status" aria-live="polite" className="text-sm">{locked ? 'Open — definition locked' : pending ? message : failed ? 'Save failed — entered work retained' : dirty ? 'Unsaved changes' : record ? 'Saved draft' : 'Not saved yet'}</p></div>{!locked && <Button type="submit" form="assessment-preparation" variant="outline" className="min-h-11 px-4" disabled={pending}>Save draft</Button>}</header>
    {locked ? <><div className="rounded-xl border bg-card p-4 sm:p-6">{summary}</div><Link className={link + ' bg-primary text-primary-foreground hover:no-underline'} href={href({ assessment: record!.id })}>Assess learners</Link></> : <>
      <nav aria-label="Preparation steps" className="flex flex-wrap gap-2">{steps.map((name, i) => <Button key={name} type="button" className="min-h-11 px-3" variant={step === i ? 'default' : 'ghost'} aria-current={step === i ? 'step' : undefined} onClick={() => go(i)}>{i + 1}. {name}</Button>)}</nav>
      <form id="assessment-preparation" aria-label="Assessment draft" noValidate onSubmit={e => { e.preventDefault(); void submit('save') }} onChange={edit} className="space-y-6">
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        <div className="space-y-6 rounded-xl border bg-card p-4 sm:p-6">
        <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold focus-visible:outline-2">{step === 0 ? 'What will learners do?' : steps[step]}</h3>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
        {step === 0 && <><Fields prefix="Assessment" value={fields} change={setFields} dates={false} /><label className={labelClass}><span className="font-medium">Assessment type</span><select aria-label="Assessment type" className={field} value={type} onChange={e => setType(e.target.value)}><option value="">Select type</option>{data.types.filter(t => t.enabled || t.id === type).map(t => <option key={t.id} value={t.id}>{t.name}{!t.enabled ? ' (disabled)' : ''}</option>)}</select></label>
          <details open={revealSections || undefined} className="rounded-lg bg-muted/30 p-4"><summary className="cursor-pointer text-sm font-medium">Scheduling<span className="ml-2 font-normal">{fields.starts_on || fields.due_on ? 'Dates set' : 'Optional'}</span></summary><div className="mt-4 space-y-4"><label className={labelClass}><span className="font-medium">Term (optional)</span><select aria-label="Term" className={field} value={term} onChange={e => setTerm(e.target.value)}><option value="">No term</option>{data.terms.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label><Dates prefix="Assessment" value={fields} change={setFields} /></div></details>
          <details open={revealSections || undefined} className="rounded-lg bg-muted/30 p-4"><summary className="cursor-pointer text-sm font-medium">Assessment source<span className="ml-2 font-normal">{origin === 'internal' ? 'School / internal' : authority || 'External authority'}</span></summary><div className="mt-4 space-y-4"><label className={labelClass}><span className="font-medium">Origin</span><select className={field} value={origin} onChange={e => setOrigin(e.target.value as 'internal' | 'external')}><option value="internal">School / internal</option><option value="external">External authority</option></select></label>{origin === 'external' && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}><span className="font-medium">Authority name</span><input className={field} maxLength={160} value={authority} onChange={e => setAuthority(e.target.value)} /></label><label className={labelClass}><span className="font-medium">External reference (optional)</span><input className={field} maxLength={160} value={reference} onChange={e => setReference(e.target.value)} /></label></div>}</div></details>
        </>}
        {step === 1 && <><p className="font-medium">Maximum preview: {maximum ? scoreText(maximum.total) : 'Check scores'}</p>{tasks.map((task, i) => <section key={task.id ?? task.clientKey} className="space-y-4 rounded-lg border bg-muted/20 p-4"><button type="button" className="w-full rounded p-3 text-left font-semibold focus-visible:outline-2" aria-expanded={expanded === i} onClick={() => setExpanded(expanded === i ? -1 : i)}>Task {i + 1}: {task.title || 'Untitled'} · {task.criteria.length} criteria · Maximum {maximum ? scoreText(maximum.tasks[i]) : '—'}<ChevronDown aria-hidden="true" className={expanded === i ? 'ml-2 inline size-4 rotate-180' : 'ml-2 inline size-4'} /></button>{expanded === i && <><Fields reveal={revealSections} prefix={`Task ${i + 1}`} value={task} change={v => setTasks(tasks.map((t, n) => n === i ? { ...t, ...v } : t))} /><CriteriaEditor guided task={i + 1} value={task.criteria} change={criteria => { setTasks(tasks.map((t, n) => n === i ? { ...t, criteria } : t)); edit() }} /><div className="flex flex-wrap gap-2 pt-3 border-t"><Button aria-label="Move task up" title="Move task up" className="min-h-11 min-w-11" type="button" variant="outline" disabled={i === 0} onClick={() => reorder(i, -1)}><ArrowUp aria-hidden="true" className="size-4" /></Button><Button aria-label="Move task down" title="Move task down" className="min-h-11 min-w-11" type="button" variant="outline" disabled={i === tasks.length - 1} onClick={() => reorder(i, 1)}><ArrowDown aria-hidden="true" className="size-4" /></Button><Button aria-label="Remove task" title="Remove task" className="min-h-11 min-w-11" type="button" variant="destructive" onClick={() => { if (window.confirm('Remove this task and its scoring guide? Save draft to apply.')) { setTasks(tasks.filter((_, n) => n !== i)); setExpanded(Math.max(0, i - 1)); edit() } }}><Trash2 aria-hidden="true" className="size-4" /></Button></div></>}</section>)}<Button type="button" variant="outline" disabled={tasks.length >= 100} onClick={() => { setTasks([...tasks, { ...empty, criteria: [], clientKey: crypto.randomUUID() }]); setExpanded(tasks.length); edit() }}>Add task</Button></>}
        {step === 2 && <><fieldset className="space-y-4"><legend className="font-medium">How should results be presented?</legend><label className="flex items-center gap-3"><input type="radio" name="descriptions" checked={!descriptions} onChange={() => { if (!levels.length || window.confirm('Remove all entered result descriptions? This will apply when you save the draft.')) { setDescriptions(false); setLevels([]) } }} /><span className="font-medium">Marks only</span></label><label className="flex items-center gap-3"><input type="radio" name="descriptions" checked={descriptions} onChange={() => setDescriptions(true)} /><span className="font-medium">Marks with result descriptions</span></label></fieldset>{descriptions && <ScaleEditor value={levels} change={v => { setLevels(v); edit() }} />}</>}
        {step === 3 && <div className="space-y-6">{summary}{issues.length > 0 && <div role="alert" className="rounded-xl border bg-destructive/10 p-5"><h4 className="font-semibold">Before opening</h4><ul className="mt-2 space-y-2">{issues.map((issue, i) => <li key={i}><button type="button" className="text-left underline focus-visible:outline-2" onClick={() => { setRevealSections(true); go(issue.step) }}>{steps[issue.step]}: {issue.text}</button></li>)}</ul></div>}<p className="text-muted-foreground">Opening makes the assessment available for assessing learners. Its tasks and scoring guide can no longer be edited.</p>{(!record || dirty) && <p className="text-muted-foreground">Save your draft before opening.</p>}</div>}
        </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 [&_button]:min-h-11 [&_button]:px-4"><Button type="button" variant="outline" disabled={step === 0 || pending} onClick={() => go(step - 1)}>Back</Button>{step < 3 ? <Button type="button" disabled={pending} onClick={() => go(step + 1)}>Next: {steps[step + 1]}</Button> : <Button type="button" disabled={pending || dirty || !record || issues.length > 0} onClick={() => void submit('open')}>Open for assessment</Button>}</div>
      </form>
      {message && !pending && <p role={failed ? 'alert' : 'status'} className="mt-4">{message}</p>}{failed && <div className="mt-4 space-y-3"><p className="text-muted-foreground">Review the relevant step and retry. If another edit was saved, copy your changes before reloading; they cannot overwrite that revision.</p><Button variant="outline" onClick={() => { if (window.confirm('Reload the saved version and discard your unsaved changes?')) { unsaved.current = false; window.location.reload() } }}>Reload saved version</Button></div>}
    </>}
  </section>
}

