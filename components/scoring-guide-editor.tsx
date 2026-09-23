'use client'

import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Criterion, PerformanceLevel } from '@/lib/domain/scoring-guide'
const field = 'block w-full min-w-0 rounded border bg-background p-3'
const labelClass = 'block space-y-1.5'

function Controls({ index, count, move, remove, label }: { index: number; count: number; move: (delta: number) => void; remove: () => void; label: string }) {
  return <div className="flex flex-wrap gap-2"><Button type="button" aria-label={`Move ${label} up`} disabled={!index} onClick={() => move(-1)} title={`Move ${label} up`} className="min-h-11 min-w-11" variant="ghost"><ArrowUp aria-hidden="true" /></Button><Button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => move(1)} title={`Move ${label} down`} className="min-h-11 min-w-11" variant="ghost"><ArrowDown aria-hidden="true" /></Button><Button type="button" onClick={() => { if (window.confirm(`Remove ${label} and its contents? Save draft to apply this change.`)) remove() }} aria-label={`Remove ${label}`} title={`Remove ${label}`} className="min-h-11 min-w-11 text-destructive" variant="ghost"><Trash2 aria-hidden="true" /></Button></div>
}
function reordered<T>(items: T[], index: number, delta: number) { const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next }
export function CriteriaEditor({ value, change, task, guided = false }: { value: Criterion[]; change: (value: Criterion[]) => void; task: number; guided?: boolean }) {
  const update = (index: number, criterion: Criterion) => change(value.map((c, i) => i === index ? criterion : c))
  return <div className="space-y-5"><h4 className="font-semibold">{guided ? 'What you will assess (criteria)' : 'Scoring criteria'}</h4>{value.map((criterion, c) => <fieldset key={criterion.id ?? c} className="rounded-lg bg-muted/40 p-4 space-y-4"><legend className="font-medium">Criterion {c + 1}</legend>
    <label className={labelClass}><span className="font-medium">What will you observe?</span><input aria-label={`Task ${task} criterion ${c + 1} title`} className={field} required maxLength={160} value={criterion.title} onChange={e => update(c, { ...criterion, title: e.target.value })} /></label>
    <label className={labelClass}><span className="font-medium">Description (optional)</span><textarea className={field} maxLength={4000} rows={2} value={criterion.description ?? ''} onChange={e => update(c, { ...criterion, description: e.target.value || null })} /></label>
    <p className="text-sm text-muted-foreground">One indicator will be selected per criterion. Each indicator must have a distinct score.</p>
    {criterion.indicators.map((indicator, i) => <fieldset key={indicator.id ?? i} className="rounded-lg bg-card p-4 space-y-4"><legend className="font-medium">Indicator {i + 1}</legend><div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
      <label className={labelClass}><span className="font-medium">Observable outcome</span><textarea aria-label={`Task ${task} criterion ${c + 1} indicator ${i + 1} descriptor`} className={field} required maxLength={1000} rows={2} value={indicator.descriptor} onChange={e => update(c, { ...criterion, indicators: criterion.indicators.map((v, n) => n === i ? { ...v, descriptor: e.target.value } : v) })} /></label>
      <label className={labelClass}><span className="font-medium">Score</span><input aria-label={`Task ${task} criterion ${c + 1} indicator ${i + 1} score`} className={field} required inputMode="decimal" pattern="(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?" value={indicator.score} onChange={e => update(c, { ...criterion, indicators: criterion.indicators.map((v, n) => n === i ? { ...v, score: e.target.value } : v) })} /></label></div>
      <Controls label="indicator" index={i} count={criterion.indicators.length} move={delta => update(c, { ...criterion, indicators: reordered(criterion.indicators, i, delta) })} remove={() => update(c, { ...criterion, indicators: criterion.indicators.filter((_, n) => n !== i) })} />
    </fieldset>)}
    <Button type="button" disabled={criterion.indicators.length >= 100} onClick={() => update(c, { ...criterion, indicators: [...criterion.indicators, { descriptor: '', score: '' }] })} variant="outline">Add indicator</Button>
    <Controls label="criterion" index={c} count={value.length} move={delta => change(reordered(value, c, delta))} remove={() => change(value.filter((_, n) => n !== c))} />
  </fieldset>)}<Button type="button" disabled={value.length >= 100} onClick={() => change([...value, { title: '', description: null, indicators: [] }])} variant="outline">Add criterion</Button></div>
}
export function ScaleEditor({ value, change }: { value: PerformanceLevel[]; change: (value: PerformanceLevel[]) => void }) {
  return <section className="space-y-5"><h3 className="font-semibold">Performance interpretation (optional)</h3><p className="text-sm text-muted-foreground">Use inclusive ranges covering zero to the assessment maximum without gaps or overlaps. For decimal scores, a range ending at 4.00 is followed by one starting at 4.01. No default levels are assumed.</p>
    {value.map((level, index) => <fieldset key={level.id ?? index} className="rounded-lg border p-5 space-y-4"><legend className="font-medium">Performance level {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2">{(['lower','upper','code','descriptor'] as const).map(key => <label key={key} className={labelClass}><span className="font-medium">{({ lower: 'Lower score', upper: 'Upper score', code: 'Level or code (optional)', descriptor: 'Descriptor' })[key]}</span><input aria-label={`Level ${index + 1} ${key}`} className={field} required={key !== 'code'} maxLength={key === 'code' ? 32 : key === 'descriptor' ? 160 : 9} inputMode={key === 'lower' || key === 'upper' ? 'decimal' : 'text'} value={level[key] ?? ''} onChange={e => change(value.map((l, n) => n === index ? { ...l, [key]: e.target.value } : l))} /></label>)}</div><Controls label="level" index={index} count={value.length} move={delta => change(reordered(value, index, delta))} remove={() => change(value.filter((_, n) => n !== index))} /></fieldset>)}
    <Button type="button" disabled={value.length >= 100} onClick={() => change([...value, { code: null, descriptor: '', lower: '', upper: '' }])} variant="outline">Add performance level</Button>
  </section>
}
