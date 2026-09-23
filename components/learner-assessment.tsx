'use client'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { assessLearner } from '@/app/actions/learner-assessments'
import { calculateResult, statusLabel, type EvidenceInput } from '@/lib/domain/learner-result'
import { scoreText } from '@/lib/domain/scoring-guide'
import type { AssessmentRosterData, LearnerAssessmentData } from '@/lib/domain/learner-assessments'

export function resultHref(school: string, offering: string, assessment: string, learner?: string) {
  return '/academics?' + new URLSearchParams({ school, offering, view: 'assessments', assessment, ...(learner ? { learner } : {}) })
}
const linkClass = 'inline-flex min-h-11 items-center rounded-md px-3 underline focus-visible:outline-2 focus-visible:outline-primary'
const field = 'block w-full min-w-0 rounded border bg-background p-3'
const labelClass = 'block space-y-1.5'
export function AssessmentRoster({ school, data }: { school: string; data: AssessmentRosterData }) {
  const { assessment: a, learners } = data
  return <section className="space-y-6"><h2 className="break-words text-2xl font-semibold">{a.title}</h2><p className="text-muted-foreground">Open · Maximum: {learners[0]?.result.maximum ?? calculateResult(a.tasks,a.levels,[],'not_started').maximum}</p>
    <h3 className="text-xl font-semibold">Assessment roster</h3><p className="text-sm text-muted-foreground">{learners.length} learners · {Object.entries(statusLabel).map(([key,label]) => `${learners.filter(l => l.status === key).length} ${label.toLowerCase()}`).join(' · ')}</p>
    <p className="text-sm text-muted-foreground">Current eligible learners. Partial scores are in progress, not completed results.</p>
    {learners.length ? <ul className="divide-y rounded-xl border">{learners.map(l => <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="min-w-0"><p className="break-words font-medium">{l.display_name}</p><p className="text-sm">{statusLabel[l.status]}</p><p className="text-sm">{l.result.score === null ? '—' : `${l.result.score} / ${l.result.maximum}${l.status === 'in_progress' ? ' (partial)' : ''}`}</p>{l.status === 'completed' && l.result.performance && <p className="text-sm text-primary">{l.result.performance.code} {l.result.performance.descriptor}</p>}</div><Link className={linkClass} href={resultHref(school,a.offering_id,a.id,l.id)}>{l.status === 'completed' ? 'View' : l.status === 'in_progress' ? 'Continue' : l.status === 'absent' ? 'Review' : 'Assess'}<span className="sr-only"> {l.display_name}</span></Link></li>)}</ul> : <p className="rounded-xl border border-dashed p-6">No current eligible learners. Contact your administrator if this is unexpected.</p>}
    <Link className={linkClass} href={'/academics?' + new URLSearchParams({ school,offering:a.offering_id,view:'assessments',draft:a.id })}>View scoring guide</Link>
  </section>
}

export function LearnerAssessment({ school, data }: { school: string; data: LearnerAssessmentData }) {
  const router = useRouter(), { assessment: a, learner, participation: row } = data
  const [selected,setSelected] = useState(Object.fromEntries(data.observations.map(o => [o.criterion_id,o.indicator_id])))
  const [feedback,setFeedback] = useState(row?.feedback ?? '')
  const [evidence,setEvidence] = useState<EvidenceInput[]>(data.evidence.map(({asset_id,task_id,criterion_id}) => ({asset_id,task_id,criterion_id})))
  const [version] = useState(Number(row?.row_version ?? 0))
  const [message,setMessage] = useState(''), [failed,setFailed] = useState(false), [pending,start] = useTransition(), [dirty,setDirty] = useState(false)
  const state = row?.status ?? 'not_started', locked = state === 'completed', absent = state === 'absent'
  const observations = Object.entries(selected).map(([criterion_id,indicator_id]) => ({criterion_id,indicator_id}))
  const result = calculateResult(a.tasks,a.levels,observations,absent ? 'absent' : state === 'not_started' && !observations.length ? 'not_started' : 'in_progress')
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload',guard)
    return () => window.removeEventListener('beforeunload',guard)
  },[dirty])
  function submit(command: 'save' | 'complete' | 'absent' | 'begin') {
    if (command === 'absent' && !window.confirm(`Mark ${learner.display_name} absent? No score will be assigned. You can begin assessment later.${dirty ? ' Unsaved edits will be discarded.' : ''}`)) return
    if (command === 'complete' && !window.confirm('Complete this assessment? Observations, feedback and evidence will become read-only.')) return
    start(async () => {
      const form = new FormData(); form.set('command',command); form.set('payload',JSON.stringify({ expectedVersion:version,input:{ observations,feedback,evidence } }))
      const saved = await assessLearner(school,a.id,learner.id,form)
      setMessage(saved.message); setFailed(!saved.ok)
      if (saved.ok) { setDirty(false); if (command === 'complete') router.push(resultHref(school,a.offering_id,a.id,saved.next ?? undefined)); router.refresh() }
    })
  }
  return <section className="space-y-6">
    <Link className={linkClass} onClick={e => { if (dirty && !window.confirm('Leave without saving your changes?')) e.preventDefault() }} href={resultHref(school,a.offering_id,a.id)}>← Assessment roster</Link>
    <header className="space-y-2"><h2 className="break-words text-2xl font-semibold">{a.title}</h2><h3 className="break-words text-xl font-semibold">{learner.display_name}</h3><p className="text-muted-foreground">Learner {data.roster.findIndex(l => l.id === learner.id)+1} of {data.roster.length} · {statusLabel[state]}</p>
      {locked && <p className="text-muted-foreground">Completed · Read-only. Recorded {row?.completed_at}. Changes require a future controlled correction workflow.</p>}
    </header>
    {absent ? <div className="space-y-3 rounded-xl border bg-card p-5"><p className="text-muted-foreground">Absent · Score: —. No zero assigned.</p><Button disabled={pending} onClick={() => submit('begin')}>Begin assessment</Button></div> : <>
    <nav aria-label="Assessment tasks" className="flex flex-wrap gap-2 mb-4">{a.tasks.map((t,i) => <a key={t.id} className={linkClass} href={`#task-${t.id}`}>Task {i+1} · {result.tasks[i].observed}/{result.tasks[i].required}</a>)}</nav>
    <div aria-live="polite" className="rounded-xl border bg-card p-5 space-y-2"><p className="font-medium">{result.observed} / {result.required} criteria observed</p><p className="font-medium">{locked ? 'Result' : 'Current score'}: {result.score === null ? '—' : `${result.score} / ${result.maximum}`}</p>{!locked && <p className="text-sm text-muted-foreground">Preview. Save to persist; Complete to finalize.</p>}<p>{result.missing.length ? 'Performance: Incomplete' : result.performance ? `${locked ? 'Performance' : 'Performance preview'}: ${result.performance.code ?? ''} ${result.performance.descriptor}` : 'No performance scale configured.'}</p></div>
    <form onSubmit={e => { e.preventDefault(); submit('save') }} className="space-y-6" aria-label="Assess learner" onChange={() => setDirty(true)}>
      <fieldset disabled={locked || pending} className="min-w-0 space-y-6">
      {a.tasks.map((task,t) => <section id={`task-${task.id}`} key={task.id} className="scroll-mt-4 space-y-5 rounded-xl border bg-card p-5"><h4 className="break-words text-lg font-semibold">Task {t+1} — {task.title}</h4>{task.instructions && <p className="whitespace-pre-wrap break-words text-muted-foreground">{task.instructions}</p>}
        {task.criteria.map((c,n) => <fieldset key={c.id} className="space-y-3 rounded-lg border p-4"><legend className="break-words font-medium">{c.title}</legend>{c.description && <p className="break-words text-muted-foreground">{c.description}</p>}
          {c.indicators.map(i => <label key={i.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected[c.id!] === i.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><input className="mt-1 size-5 shrink-0 accent-primary" type="radio" name={c.id} value={i.id} checked={selected[c.id!] === i.id} onChange={() => setSelected({...selected,[c.id!]:i.id!})} /><span className="min-w-0 flex-1 break-words">{i.descriptor}</span><span className="shrink-0 font-medium">{i.score}</span></label>)}
          {!selected[c.id!] && <p className="text-sm text-muted-foreground">Observation needed — select one outcome above.</p>}{!locked && selected[c.id!] && <button type="button" className={linkClass} onClick={() => { const next={...selected}; delete next[c.id!]; setSelected(next); setDirty(true) }}>Clear observation<span className="sr-only"> for {c.title}</span></button>}
          <p className="text-sm text-muted-foreground">Criterion score: {result.tasks[t].criteria[n].units === null ? '—' : scoreText(result.tasks[t].criteria[n].units!)} / {scoreText(result.tasks[t].criteria[n].maximum)}</p>
        </fieldset>)}<p className="font-medium pt-3 border-t">Task score: {scoreText(result.tasks[t].units)} / {scoreText(result.tasks[t].maximum)}</p></section>)}
      <label className="block space-y-2"><span className="font-medium">Teacher feedback (optional, up to 4,000 characters)</span><textarea aria-label="Teacher feedback" maxLength={4000} className="block min-h-28 w-full rounded border bg-background p-3" value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
      <section className="space-y-4"><h4 className="text-lg font-semibold">Evidence</h4><p className="text-sm text-muted-foreground">Attach an existing learner file. Ask an administrator to upload new evidence through Private Files.</p>
        {!data.assets.length && !evidence.length && <p className="text-muted-foreground">No evidence files available.</p>}
        {evidence.map(e => <div key={e.asset_id} className="space-y-3 rounded-lg border bg-card p-4"><p className="break-words font-medium">{data.assets.find(f => f.id === e.asset_id)?.title ?? data.evidence.find(f => f.asset_id === e.asset_id)?.title ?? 'Unavailable file'}</p>
          <label className={labelClass}><span className="font-medium">Applies to</span><select aria-label="Evidence applies to" className={field} value={e.criterion_id ? `criterion:${e.criterion_id}` : e.task_id ? `task:${e.task_id}` : ''} onChange={event => { const [kind,id]=event.target.value.split(':'); setEvidence(evidence.map(f => f.asset_id === e.asset_id ? {...f,task_id:kind==='task'?id:null,criterion_id:kind==='criterion'?id:null} : f)) }}><option value="">Entire assessment</option>{a.tasks.map((t,i) => <optgroup key={t.id} label={`Task ${i+1}: ${t.title}`}><option value={`task:${t.id}`}>Task {i+1}</option>{t.criteria.map(c => <option key={c.id} value={`criterion:${c.id}`}>{c.title}</option>)}</optgroup>)}</select></label>
          {!locked && <Button type="button" variant="outline" onClick={() => { setEvidence(evidence.filter(f => f.asset_id !== e.asset_id)); setDirty(true) }}>Remove evidence</Button>}
        </div>)}
        {!locked && <label className={labelClass}><span className="font-medium">Attach evidence</span><select aria-label="Attach evidence" className={field} value="" onChange={event => { if(event.target.value) setEvidence([...evidence,{asset_id:event.target.value,task_id:null,criterion_id:null}]) }}><option value="">Select a learner file</option>{data.assets.filter(f => !evidence.some(e => e.asset_id === f.id)).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></label>}
      </section>
      </fieldset>
{data.evidence.map(e => <p key={e.id} className="mt-2">{e.available ? <a className={linkClass} href={`/academics/evidence/${e.id}?` + new URLSearchParams({school,assessment:a.id,learner:learner.id})}>Download {e.title}</a> : <span className="text-destructive">Evidence unavailable: {e.title}. Remove it or ask your administrator before saving.</span>}</p>)}
      {!locked && <div className="flex flex-wrap gap-3 pt-4 border-t"><Button type="submit" disabled={pending || !dirty}>Save</Button><Button type="button" disabled={pending} onClick={() => submit('complete')}>Complete & Next</Button><Button type="button" variant="outline" disabled={pending} onClick={() => submit('absent')}>Mark absent</Button></div>}
      {!locked && <p className="text-sm text-muted-foreground">Save keeps work in progress. Complete & Next requires every criterion and makes this learner's assessment read-only.</p>}
    </form></>}
    {message && <p role={failed ? 'alert' : 'status'} className="mt-4 break-words">{message}</p>}
    {failed && <Button variant="outline" className="mt-4" onClick={() => { if (!dirty || window.confirm('Reload and discard unsaved changes?')) window.location.reload() }}>Reload</Button>}
  </section>
}
