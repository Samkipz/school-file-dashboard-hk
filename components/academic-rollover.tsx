'use client'

import { useState, useTransition } from 'react'
import { administer, type AdminActionState } from '@/app/actions/administration'
import type { AdminData } from '@/lib/domain/administration'
import type { RolloverSelection } from '@/lib/domain/learner-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AcademicRollover({ school, data }: { school: string; data: AdminData }) {
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [selections, setSelections] = useState<Record<string, RolloverSelection>>({})
  const [teachers, setTeachers] = useState(false)
  const [state, setState] = useState<AdminActionState>({ ok: false, message: '' })
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  const resetPreview = () => { setState({ ok: false, message: '' }); setConfirmed(false) }
  const change = (id: string, fields: Partial<RolloverSelection>) => {
    resetPreview()
    setSelections(current => ({ ...current, [id]: { ...current[id], ...fields, enrolment_id: id } }))
  }
  const submit = (operation: string) => startTransition(async () => {
    const form = new FormData()
    form.set('source_year_id', source); form.set('destination_year_id', destination)
    form.set('copy_teachers', String(teachers)); form.set('selections', JSON.stringify(Object.values(selections)))
    if (operation === 'commitRollover') { form.set('preview_token', state.preview?.token ?? ''); form.set('confirmed', String(confirmed)) }
    const result = await administer(school, operation, { ok: false, message: '' }, form)
    setState(result); setConfirmed(false)
    if (result.ok && operation === 'commitRollover') setSelections({})
  })
  const years = data.academic_years.filter(y => y.status === 'active')
  const selected = Object.keys(selections).length
  return <section className="space-y-5">
    <h2 className="text-2xl font-semibold">Academic Year Rollover</h2>
    <p>Choose active source and destination years, then explicitly select each learner’s outcome (up to 100 per batch). The destination must start after the source year ends. The entire selected batch commits together.</p>
    <p className="text-sm text-muted-foreground">Subjects held at the source enrolment’s end carry forward only when an enabled, applicable destination offering exists. The preview lists omitted subjects. Completion and withdrawal use an inclusive last day, on or before today. Resolve future scheduled records before closing a learner.</p>
    <fieldset disabled={pending} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">{[['Source academic year', source, true], ['Destination academic year', destination, false]].map(([label, selectedYear, isSource]) => <label key={String(label)} className="space-y-1 block"><span>{String(label)}</span><select className="w-full border rounded-md p-2 bg-background" value={String(selectedYear)} onChange={e => { resetPreview(); setSelections({}); if (isSource) setSource(e.target.value); else setDestination(e.target.value) }}><option value="">Select year</option>{years.map(y => <option key={y.id} value={y.id}>{String(y.code)}</option>)}</select></label>)}</div>
      {source && destination && <div className="space-y-3">{data.learner_enrolments.filter(e => e.academic_year_id === source).map(e => {
        const learner = data.learners.find(l => l.id === e.learner_id)
        const grade = data.grades.find(g => g.id === e.grade_id)
        const selection = selections[e.id]
        const duplicate = data.learner_enrolments.some(other => other.learner_id === e.learner_id && other.academic_year_id === destination)
        const eligible = learner?.status === 'active' && e.status === 'active' && !duplicate
        const terminal = selection?.outcome === 'withdraw' || selection?.outcome === 'complete'
        const classes = data.class_groups.filter(c => c.academic_year_id === destination && c.status === 'active' && data.grades.some(g => g.id === c.grade_id && g.curriculum_code === grade?.curriculum_code && (selection?.outcome === 'repeat' ? g.id === grade.id : Number(g.ordinal) === Number(grade?.ordinal) + 1)))
        return <div key={e.id} className="rounded-md border p-3 space-y-3"><p className="font-medium">{String(learner?.display_name)} · {String(grade?.label)} · {learner?.status === 'left' ? 'withdrawn' : String(learner?.status)}{duplicate && ' · Already enrolled in destination'}</p>
          <label className="block">Outcome<select aria-label={`Outcome for ${learner?.display_name}`} disabled={!eligible} className="block w-full border rounded-md p-2 bg-background" value={selection?.outcome ?? ''} onChange={event => { resetPreview(); if (!event.target.value) { setSelections(current => { const next = { ...current }; delete next[e.id]; return next }) } else setSelections(current => ({ ...current, [e.id]: { enrolment_id: e.id, outcome: event.target.value as RolloverSelection['outcome'], effective_on: data.today, reason: '' } })) }}><option value="">Do not include</option>{['promote', 'repeat', 'complete', 'withdraw'].map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}</select></label>
          {selection && (terminal ? <div className="grid md:grid-cols-2 gap-3"><label>Last day<Input type="date" max={data.today} value={selection.effective_on ?? ''} onChange={event => change(e.id, { effective_on: event.target.value })} /></label><label>Reason<Input maxLength={160} value={selection.reason ?? ''} onChange={event => change(e.id, { reason: event.target.value })} /></label></div> : <label className="block">Destination class<select aria-label={`Destination class for ${learner?.display_name}`} className="block w-full border rounded-md p-2 bg-background" value={selection.class_group_id ?? ''} onChange={event => change(e.id, { class_group_id: event.target.value })}><option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{String(c.label)}</option>)}</select></label>)}
        </div>
      })}</div>}
      <label className="flex items-start gap-2"><input type="checkbox" checked={teachers} onChange={e => { resetPreview(); setTeachers(e.target.checked) }} /><span>Copy eligible teachers from carried subjects at source-year end. Existing identical destination assignments are retained.</span></label>
      <Button onClick={() => submit('previewRollover')} disabled={!source || !destination || !selected || selected > 100 || pending}>Preview {selected} selected learners</Button>
      {state.preview && <div className="space-y-4 border rounded-md p-4">
        <h3 className="text-xl font-semibold">Rollover preview: {state.preview.source} → {state.preview.destination}</h3>
        <ul className="space-y-3">{state.preview.learners.map((l, i) => <li key={i}><p className="font-semibold">{l.learner}: {l.outcome} · {l.grade} · {l.destinationClass}</p><p>Effective: {l.effectiveOn}{l.reason && ` · Reason: ${l.reason}`}</p><p>Subjects: {l.subjects.join(', ') || 'None'}</p>{!!l.skippedSubjects.length && <p className="font-medium">Not carried: {l.skippedSubjects.join(', ')}. Configure missing offerings before previewing again if needed.</p>}</li>)}</ul>
        <h4 className="font-semibold">Teacher assignments</h4>{state.preview.teachers.length ? <ul>{state.preview.teachers.map((t, i) => <li key={i}>{t.teacher} · {t.subject} · {t.destinationClass} · {t.action}</li>)}</ul> : <p>No teacher assignment changes.</p>}
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm every outcome, destination, subject omission and teacher assignment shown above.</label>
        <Button onClick={() => submit('commitRollover')} disabled={!confirmed || pending}>Confirm and execute rollover</Button>
      </div>}
    </fieldset>
    {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
  </section>
}
