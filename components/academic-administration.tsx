'use client'

import { useActionState, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { administer } from '@/app/actions/administration'
import { AcademicRollover } from '@/components/academic-rollover'
import { currentPeriodLabel, termPresentationState } from '@/lib/academic-navigation'
import type { AdminData, AdminRow } from '@/lib/domain/administration'
import { classCoverage, currentClassRoster, groupClassesByGrade } from '@/lib/domain/class-administration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Option = { value: string; label: string }
type Field = { name: string; label: string; type?: string; options?: Option[]; value?: string; optional?: boolean }
const choices = (...values: string[]): Option[] => values.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
const value = (row: AdminRow | undefined, key: string) => String(row?.[key] ?? '')
const options = (rows: AdminRow[], label: (r: AdminRow) => string): Option[] => rows.map(r => ({ value: r.id, label: label(r) }))
const field = (name: string, label: string, opts?: Option[]): Field => ({ name, label, options: opts })
const date = (name: string, label: string, initial?: string, optional = false): Field => ({ name, label, type: 'date', value: initial, optional })

function WorkflowForm({ school, operation, title, fields, hidden = {}, hint }: { school: string; operation: string; title: string; fields: Field[]; hidden?: Record<string, string>; hint?: string }) {
  const [state, action, pending] = useActionState(administer.bind(null, school, operation), { ok: false, message: '' })
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, f.value ?? ''])))
  const id = useId()
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{hint && <p className="text-muted-foreground">{hint}</p>}</CardHeader><CardContent>
    <form action={action} className="space-y-4">
      {Object.entries(hidden).map(([name, v]) => <input key={name} name={name} value={v} type="hidden" />)}
      <fieldset disabled={pending} className="space-y-4">
        {fields.map(f => <div key={f.name} className="space-y-1"><label className="text-sm font-medium" htmlFor={`${id}-${f.name}`}>{f.label}{f.optional ? ' (optional)' : ''}</label>
          {f.options ? <select id={`${id}-${f.name}`} name={f.name} required={!f.optional} value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })} className="border rounded-md w-full h-10 px-3 bg-background"><option value="">Select {f.label.toLowerCase()}</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <Input id={`${id}-${f.name}`} name={f.name} type={f.type ?? 'text'} required={!f.optional} value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })} maxLength={160} min={f.type === 'number' ? 1 : undefined} />}
        </div>)}
        <Button type="submit">{pending ? 'Saving…' : title}</Button>
      </fieldset>
      {state.message && <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-sm text-green-700 dark:text-green-400' : 'text-sm text-destructive'}>{state.message}{state.ok && operation === 'transfer' ? ' Review subjects for the new class below.' : ''}</p>}
    </form>
  </CardContent></Card>
}
function History({ title, rows }: { title: string; rows: { id: string; title: string; detail: string }[] }) {
  return <section className="space-y-2"><h3 className="font-semibold">{title}</h3>{rows.length ? <ul className="divide-y rounded-md border">{rows.map(r => <li key={r.id} className="p-3"><p className="font-medium">{r.title}</p><p className="text-sm text-muted-foreground">{r.detail}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No records yet.</p>}</section>
}
export function AcademicAdministration({ school, data: d }: { school: string; data: AdminData }) {
  const sections = ['Calendar', 'Classes', 'Subjects', 'Teaching', 'Assessment', 'Year-End']
  const sectionMeta: Record<string, { title: string; description: string }> = {
    Calendar: { title: 'Calendar', description: 'Manage academic years and school terms.' },
    Classes: { title: 'Classes', description: 'Manage class groups and academic placement.' },
    Subjects: { title: 'Subjects', description: 'Manage school subjects and offerings.' },
    Teaching: { title: 'Teaching', description: 'Review staff assignments and teaching coverage.' },
    Assessment: { title: 'Assessment', description: 'Open assessment setup and planning tools.' },
    'Year-End': { title: 'Year-End', description: 'Run rollover and end-of-year processes.' },
  }
  const [section, setSection] = useState('Calendar')
  const [learnerId, setLearnerId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [yearId, setYearId] = useState(d.academic_years.find(y => y.status === 'active')?.id ?? '')
  const [classId, setClassId] = useState('')
  const [enrolmentId, setEnrolmentId] = useState('')
  const [placementId, setPlacementId] = useState('')
  const [yearCreateOpen, setYearCreateOpen] = useState(false)
  const [yearEditId, setYearEditId] = useState<string | null>(null)
  const [termEditId, setTermEditId] = useState<string | null>(null)
  const [termCreateOpen, setTermCreateOpen] = useState(false)
  const [termCreateYearId, setTermCreateYearId] = useState(d.academic_years.find(y => y.status === 'active')?.id ?? d.academic_years[0]?.id ?? '')
  const [classCreateOpen, setClassCreateOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [classEditOpen, setClassEditOpen] = useState(false)
  const find = (rows: AdminRow[], id: unknown) => rows.find(r => r.id === id)
  const yearName = (id: unknown) => value(find(d.academic_years, id), 'code')
  const className = (id: unknown) => value(find(d.class_groups, id), 'label')
  const gradeName = (id: unknown) => value(find(d.grades, id), 'label')
  const offeringName = (id: unknown) => { const o = find(d.subject_offerings, id); return `${className(o?.class_group_id)} · ${value(find(d.school_subjects, o?.school_subject_id), 'display_name')} · ${yearName(o?.academic_year_id)}` }
  const period = (r: AdminRow) => `${r.starts_on} – ${r.ends_on ?? 'year end'}`
  const current = (r: AdminRow) => String(r.starts_on) <= d.today && (!r.ends_on || String(r.ends_on) >= d.today) && (!r.status || r.status === 'active')
  const years = options(d.academic_years.filter(y => y.status !== 'closed'), r => value(r, 'code'))
  const grades = options(d.grades, r => `${r.curriculum_code} · ${r.label}`)
  const classes = d.class_groups.filter(c => (!yearId || c.academic_year_id === yearId))
  const activeClasses = classes.filter(c => c.status === 'active')
  const classOptions = options(activeClasses, r => `${r.label} · ${yearName(r.academic_year_id)}`)
  const offerings = d.subject_offerings.filter(o => (!yearId || o.academic_year_id === yearId) && (!classId || o.class_group_id === classId))
  const staff = options(d.staff_profiles.filter(s => s.status === 'active'), r => `${r.display_name} (${r.staff_code})`)
  const learner = find(d.learners, learnerId)
  const admissions = d.learner_admissions.filter(a => a.learner_id === learnerId)
  const enrolments = d.learner_enrolments.filter(e => e.learner_id === learnerId)
  const enrolment = find(enrolments, enrolmentId)
  const placements = d.class_placements.filter(p => enrolments.some(e => e.id === p.enrolment_id))
  const placement = find(placements, placementId)
  const subjectEnrolments = d.learner_subject_enrolments.filter(s => enrolments.some(e => e.id === s.enrolment_id))
  const f = (operation: string, title: string, fields: Field[], hidden: Record<string, string> = {}, hint?: string) => <WorkflowForm school={school} operation={operation} title={title} fields={fields} hidden={hidden} hint={hint} />
  const picker = (label: string, selected: string, change: (s: string) => void, opts: Option[]) => <label className="block space-y-1"><span className="text-sm font-medium">{label}</span><select className="block w-full border rounded-md h-10 px-3 bg-background" value={selected} onChange={e => change(e.target.value)}><option value="">Select {label.toLowerCase()}</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  const currentYear = useMemo(() => d.academic_years.find(y => y.status === 'active' && String(y.starts_on) <= d.today && (!y.ends_on || String(y.ends_on) >= d.today)) ?? d.academic_years.find(y => y.status === 'active') ?? d.academic_years[0], [d.academic_years, d.today])
  const currentTerm = useMemo(() => {
    if (!currentYear) return undefined
    const yearTerms = d.terms.filter(t => t.academic_year_id === currentYear.id)
    return yearTerms.find(t => String(t.starts_on) <= d.today && (!t.ends_on || String(t.ends_on) >= d.today)) ?? undefined
  }, [currentYear, d.terms, d.today])
  const otherYears = d.academic_years.filter(y => y.id !== currentYear?.id)
  const renderYearEditor = (year: AdminRow, compact = false) => {
    const fields = [{ ...field('code', 'Code'), value: value(year, 'code') }, date('starts_on', 'Start date', value(year, 'starts_on')), date('ends_on', 'End date', value(year, 'ends_on')), { ...field('status', 'Status', choices('draft', 'active', 'closed')), value: value(year, 'status') }]
    return <div className="space-y-4">
      {f('saveYear', compact ? 'Edit year' : 'Save academic year', fields, { id: year.id }, 'Date changes must still contain all existing terms, enrolments and assignments.')}
    </div>
  }
  const renderTermEditor = (term: AdminRow, compact = false) => {
    const fields = [{ ...field('code', 'Code'), value: value(term, 'code') }, { ...field('ordinal', 'Ordinal'), type: 'number', value: value(term, 'ordinal') }, date('starts_on', 'Start date', value(term, 'starts_on')), date('ends_on', 'End date', value(term, 'ends_on'))]
    return <div className="space-y-4">{f('saveTerm', compact ? 'Edit term' : 'Save term', fields, { id: String(term.id), academic_year_id: String(term.academic_year_id) }, 'Terms are date-based and cannot include a current-term selector.')}</div>
  }
  const renderCreateTerm = (year: AdminRow) => <div className="space-y-4">{f('saveTerm', 'Add term', [field('academic_year_id', 'Academic year', years), field('code', 'Code'), { ...field('ordinal', 'Ordinal'), type: 'number' }, date('starts_on', 'Start date'), date('ends_on', 'End date')], { academic_year_id: year.id }, 'Add a valid term within the selected academic year.')}</div>
  return <div className="space-y-6">
    <header className="space-y-3">
      <p className="text-sm font-medium text-primary">Academics</p>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold leading-tight">{sectionMeta[section]?.title ?? 'Calendar'}</h1>
        <p className="text-muted-foreground">{sectionMeta[section]?.description ?? 'Manage academic years and school terms.'}</p>
      </div>
      <div className="inline-flex rounded-full border bg-card px-3 py-2 text-sm font-medium"><span className="text-muted-foreground">Current context:</span> <span className="ml-2">{currentPeriodLabel(d.academic_years, 'year', d.today)} · {currentPeriodLabel(d.terms, 'term', d.today)}</span></div>
    </header>

    <nav aria-label="Academic administration sections" className="flex flex-wrap gap-2 border-b border-border pb-2">
      {sections.map(s => <button key={s} type="button" onClick={() => setSection(s)} aria-pressed={section === s} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${section === s ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{s}</button>)}
    </nav>
    {section !== 'Year-End' && section !== 'Assessment' && <div className="max-w-md">{picker('Academic year filter', yearId, v => { setYearId(v); setClassId(''); setSelectedClassId(null); setClassEditOpen(false) }, options(d.academic_years, r => value(r, 'code')))}</div>}
    {section === 'Year-End' && <AcademicRollover school={school} data={d} />}
    {section === 'Calendar' && <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Overview-first school calendar</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setYearCreateOpen(v => !v)}>{yearCreateOpen ? 'Close' : '+ Add academic year'}</Button>
          {currentYear && <Button onClick={() => { setTermCreateYearId(currentYear.id); setTermCreateOpen(v => !v) }}>{termCreateOpen ? 'Close' : '+ Add term'}</Button>}
        </div>
      </div>
      {yearCreateOpen && <div className="max-w-2xl">{f('saveYear', 'Create academic year', [field('code', 'Year code'), date('starts_on', 'Start date'), date('ends_on', 'End date'), { ...field('status', 'Status', choices('draft', 'active', 'closed')), value: 'draft' }])}</div>}
      {currentYear && termCreateOpen && <div className="max-w-2xl">{renderCreateTerm(currentYear)}</div>}
      {currentYear && <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Current academic year</p>
            <h2 className="text-2xl font-semibold">{String(currentYear.code)}</h2>
            <p className="text-sm text-muted-foreground">{period(currentYear)} · {String(currentYear.status)}</p>
          </div>
          <Button variant="outline" onClick={() => setYearEditId(yearEditId === currentYear.id ? null : currentYear.id)}>{yearEditId === currentYear.id ? 'Close' : 'Edit year'}</Button>
        </div>
        {yearEditId === currentYear.id && <div className="mt-5">{renderYearEditor(currentYear, true)}</div>}
      </section>}

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Terms</p>
            <h3 className="text-xl font-semibold">{currentYear ? String(currentYear.code) : 'Academic year terms'}</h3>
          </div>
          {currentYear && <Button variant="outline" onClick={() => { setTermCreateYearId(currentYear.id); setTermCreateOpen(v => !v) }}>{termCreateOpen ? 'Close' : '+ Add term'}</Button>}
        </div>
        {currentYear && <div className="mt-5 space-y-3">
          {d.terms.filter(t => t.academic_year_id === currentYear.id).sort((a, b) => Number(a.ordinal) - Number(b.ordinal)).map(term => {
            const state = termPresentationState(term, d.today)
            const isCurrent = state === 'current'
            const badgeClass = state === 'current' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : state === 'past' ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            return <div key={term.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{String(term.code)}</p>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{isCurrent ? 'Current' : state[0].toUpperCase() + state.slice(1)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{String(term.starts_on)} – {String(term.ends_on)} · Ordinal {String(term.ordinal)}</p>
                </div>
                <Button variant="outline" onClick={() => setTermEditId(termEditId === term.id ? null : term.id)}>{termEditId === term.id ? 'Close' : 'Edit'}</Button>
              </div>
              {termEditId === term.id && <div className="mt-4">{renderTermEditor(term, true)}</div>}
            </div>
          })}
        </div>}
      </section>

      {otherYears.length > 0 && <section className="rounded-xl border bg-card p-5 sm:p-6">
        <p className="text-sm font-medium text-primary">Other academic years</p>
        <div className="mt-4 space-y-3">
          {otherYears.map(y => <div key={y.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{String(y.code)}</p>
              <p className="text-sm text-muted-foreground">{String(y.status)} · {period(y)}</p>
            </div>
            <Button variant="outline" onClick={() => setYearId(y.id)} className="w-full sm:w-auto">View</Button>
          </div>)}
        </div>
      </section>}
    </div>}
    {section === 'Classes' && <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Classes in {yearName(yearId) || 'the selected academic year'}</p><p className="text-sm text-muted-foreground">Organize learner groups by grade and inspect their current rosters.</p></div>
        <Button onClick={() => setClassCreateOpen(open => !open)}>{classCreateOpen ? 'Close' : '+ Create class'}</Button>
      </div>
      {classCreateOpen && <div className="max-w-xl rounded-lg border bg-card p-5">
        <div className="mb-4 space-y-1"><h2 className="text-lg font-semibold">Create class</h2><p className="text-sm text-muted-foreground">Academic year: <span className="font-medium text-foreground">{yearName(yearId) || 'None selected'}</span></p></div>
        {yearId && grades.length ? f('saveClass', 'Create class', [field('grade_id', 'Grade', grades), field('code', 'Class code'), field('label', 'Class name')], { academic_year_id: yearId, status: 'active' }) : <p className="text-sm text-muted-foreground">{grades.length ? 'Select an academic year before creating a class.' : 'No active Grade catalogue entries are available, so a class cannot be created yet.'}</p>}
      </div>}
      {!classes.length ? <div className="rounded-lg border border-dashed p-6"><p className="font-medium">No classes have been created for {yearName(yearId) || 'the selected academic year'}.</p><p className="mt-1 text-sm text-muted-foreground">{grades.length ? 'Create the first class for this academic year.' : 'No active Grade catalogue entries are currently available. Class creation requires a configured Grade.'}</p></div> : <div className="space-y-6">
        {[...groupClassesByGrade(classes)].map(([gradeId, gradeClasses]) => { const grade = find(d.grades, gradeId); const learners = gradeClasses.reduce((total, classGroup) => total + currentClassRoster(d, classGroup.id).length, 0); return <section key={gradeId} aria-labelledby={`grade-${gradeId}`} className="space-y-3">
          <div><h2 id={`grade-${gradeId}`} className="font-semibold">{value(grade, 'label')}</h2><p className="text-sm text-muted-foreground">{gradeClasses.length} {gradeClasses.length === 1 ? 'class' : 'classes'} · {learners} current {learners === 1 ? 'learner' : 'learners'}</p></div>
          <div className="divide-y rounded-lg border bg-card">{gradeClasses.map(c => { const roster = currentClassRoster(d, c.id); const coverage = classCoverage(d, c.id); const selected = selectedClassId === c.id; return <div key={c.id} className={`p-4 ${c.status === 'closed' ? 'bg-muted/30 text-muted-foreground' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium break-words">{String(c.label)}</p><p className="text-sm text-muted-foreground">{String(c.code)} · {roster.length} current {roster.length === 1 ? 'learner' : 'learners'} · {String(c.status)}</p></div><Button variant="outline" onClick={() => { setSelectedClassId(selected ? null : c.id); setClassEditOpen(false) }}>{selected ? 'Close' : 'View'}</Button></div>
            <p className="mt-2 text-xs text-muted-foreground">{coverage.offerings} subject {coverage.offerings === 1 ? 'offering' : 'offerings'} · {coverage.activeAssignments} active teaching {coverage.activeAssignments === 1 ? 'assignment' : 'assignments'}</p>
            {selected && <div className="mt-5 space-y-6 border-t pt-5"><header className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{String(c.label)}</h3><span className="rounded-full border px-2.5 py-1 text-xs font-medium">{String(c.status)}</span></div><p className="text-sm text-muted-foreground">{value(grade, 'label')} · {yearName(c.academic_year_id)} · {String(c.code)}</p></header>
              <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Current learners</p><p className="text-lg font-semibold">{roster.length}</p></div><div><p className="text-sm text-muted-foreground">Subject offerings</p><p className="text-lg font-semibold">{coverage.offerings}</p></div><div><p className="text-sm text-muted-foreground">Active teaching assignments</p><p className="text-lg font-semibold">{coverage.activeAssignments}</p></div></div>
              <div className="flex flex-wrap gap-3 text-sm"><button type="button" className="font-medium text-primary underline" onClick={() => { setClassId(c.id); setSection('Subjects') }}>Review subject offerings</button><button type="button" className="font-medium text-primary underline" onClick={() => { setClassId(c.id); setSection('Teaching') }}>Review teaching coverage</button></div>
              <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Current learner roster</h4><Button variant="outline" onClick={() => setClassEditOpen(open => !open)}>{classEditOpen ? 'Close settings' : 'Class settings'}</Button></div>{roster.length ? <ul className="divide-y rounded-lg border">{roster.map(learner => <li key={learner.id} className="px-3 py-2 text-sm">{String(learner.display_name)}</li>)}</ul> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No learners are currently placed in this class.</p>}</section>
              {!coverage.offerings && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No subject offerings are configured for this class. <button type="button" className="font-medium text-primary underline" onClick={() => setSection('Subjects')}>Open Subjects</button> to review setup.</p>}
              {classEditOpen && <div className="max-w-xl">{f('saveClass', 'Save class settings', [{ ...field('code', 'Class code'), value: value(c, 'code') }, { ...field('label', 'Class name'), value: value(c, 'label') }, { ...field('status', 'Status', choices('active', 'closed')), value: value(c, 'status') }], { id: c.id }, 'Academic year and Grade are fixed for this class history.')}</div>}
            </div>}
          </div> })}</div>
        </section> })}
      </div>}
    </div>}
    {section === 'Subjects' && <div className="space-y-6"><div className="grid md:grid-cols-2 gap-4">
      {f('saveSubject', 'Enable school subject', [field('subject_id', 'Catalogue subject', options(d.subject_catalogue.filter(s => s.status === 'active' && !d.school_subjects.some(ss => ss.subject_id === s.id)), s => `${s.curriculum_code} · ${s.name}`)), field('local_code', 'School subject code'), field('display_name', 'School subject name')], { enabled: 'true' })}
      <div className="space-y-3">{picker('Offering class', classId, setClassId, classOptions)}{classId && f('createOffering', 'Create subject offering', [field('school_subject_id', 'Enabled subject', options(d.school_subjects.filter(s => s.enabled && d.subject_grades.some(sg => sg.subject_id === s.subject_id && sg.grade_id === find(d.class_groups, classId)?.grade_id)), s => value(s, 'display_name')))], { class_group_id: classId })}</div>
    </div><div className="grid md:grid-cols-2 gap-4">{d.school_subjects.map(s => <details key={s.id} className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">{String(s.display_name)} · {s.enabled ? 'Enabled' : 'Disabled'}</summary><div className="mt-4">{f('saveSubject', 'Save school subject', [{ ...field('local_code', 'School subject code'), value: value(s, 'local_code') }, { ...field('display_name', 'School subject name'), value: value(s, 'display_name') }, { ...field('enabled', 'Availability', [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]), value: String(s.enabled) }], { id: s.id })}</div></details>)}</div>
      <History title="Subject offerings" rows={offerings.map(o => ({ id: o.id, title: offeringName(o.id), detail: String(o.status) }))} />
      <div className="max-w-xl">{f('closeOffering', 'Close offering', [field('id', 'Offering', options(offerings.filter(o => o.status === 'active'), o => offeringName(o.id)))], {}, 'Closing removes the offering from current teaching access and retains its history.')}</div>
    </div>}
    {section === 'Teaching' && <div className="space-y-6">
      <History title="School staff" rows={d.staff_profiles.map(s => ({ id: s.id, title: String(s.display_name), detail: `${s.staff_code} · ${s.status}` }))} />
      <div className="max-w-md">{picker('Class filter', classId, setClassId, classOptions)}</div>
      <div className="grid md:grid-cols-2 gap-4">{f('assign', 'Assign teacher', [field('staff_id', 'Teacher', staff), field('offering_id', 'Subject offering', options(offerings.filter(o => o.status === 'active'), o => offeringName(o.id))), date('starts_on', 'First teaching day', d.today), date('ends_on', 'Last teaching day', undefined, true)], {}, 'Staff must have an active Teacher role. Dates are inclusive; an empty end lasts through the academic year.')}</div>
      <History title={`Current teacher assignments · ${d.today}`} rows={d.teacher_assignments.filter(a => current(a) && offerings.some(o => o.id === a.offering_id)).map(a => ({ id: a.id, title: `${value(find(d.staff_profiles, a.staff_id), 'display_name')} · ${offeringName(a.offering_id)}`, detail: period(a) }))} />
      <h3 className="font-semibold">Assignment history and changes</h3>{d.teacher_assignments.filter(a => offerings.some(o => o.id === a.offering_id)).map(a => <details key={`${a.id}-${a.row_version}`} className="border rounded-lg p-4"><summary className="cursor-pointer">{value(find(d.staff_profiles, a.staff_id), 'display_name')} · {offeringName(a.offering_id)} · {period(a)} · {a.status === 'active' && a.ends_on && String(a.ends_on) < d.today ? 'ended' : String(a.status)}</summary>{a.status === 'active' && <div className="grid md:grid-cols-2 gap-4 mt-4">
        {f('endAssignment', 'End assignment', [date('ends_on', 'Last teaching day', d.today)], { assignment_id: a.id }, 'Access continues through this date. Historical assignments remain recorded.')}
        {f('replaceAssignment', 'Replace teacher', [field('staff_id', 'Replacement teacher', staff.filter(s => s.value !== a.staff_id)), date('starts_on', 'Replacement first day', d.today), date('ends_on', 'Replacement last day', undefined, true)], { assignment_id: a.id }, 'The previous teacher finishes the day before the replacement starts. Choose a transfer date after any scheduled subject start dates.')}
      </div>}</details>)}
      <Link href={`/academics?school=${school}`} className="underline">View offering rosters</Link>
    </div>}
    {section === 'Assessment' && <div className="space-y-6"><p className="text-muted-foreground">School-wide assessment planning remains available through the existing assessment workspace.</p><Link href={`/admin/assessments?school=${school}`} className="underline">Open assessment setup</Link></div>}
  </div>
}
