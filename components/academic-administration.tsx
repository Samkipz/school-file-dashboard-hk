'use client'

import { useActionState, useId, useState } from 'react'
import Link from 'next/link'
import { administer } from '@/app/actions/administration'
import { AcademicRollover } from '@/components/academic-rollover'
import type { AdminData, AdminRow } from '@/lib/domain/administration'
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
  const [section, setSection] = useState('Learners')
  const [learnerId, setLearnerId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [yearId, setYearId] = useState(d.academic_years.find(y => y.status === 'active')?.id ?? '')
  const [classId, setClassId] = useState('')
  const [enrolmentId, setEnrolmentId] = useState('')
  const [placementId, setPlacementId] = useState('')
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
  return <div className="space-y-6">
    <nav aria-label="Administration sections" className="flex flex-wrap gap-2">{['Learners', 'Classes', 'Academic Years & Terms', 'Subjects', 'Teacher Assignments', 'Academic Year Rollover'].map(s => <Button key={s} variant={section === s ? 'default' : 'outline'} onClick={() => setSection(s)} aria-pressed={section === s}>{s}</Button>)}</nav>
    {section !== 'Learners' && section !== 'Academic Years & Terms' && section !== 'Academic Year Rollover' && <div className="max-w-md">{picker('Academic year filter', yearId, v => { setYearId(v); setClassId('') }, options(d.academic_years, r => value(r, 'code')))}</div>}
    {section === 'Academic Year Rollover' && <AcademicRollover school={school} data={d} />}
    {section === 'Learners' && <div className="grid lg:grid-cols-[minmax(240px,1fr)_3fr] gap-6">
      <div className="space-y-4"><label className="block space-y-1"><span>Find a learner</span><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or admission number" /></label>
        {picker('Learner status', statusFilter, setStatusFilter, [{ value: 'active', label: 'Active' }, { value: 'left', label: 'Withdrawn' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All statuses / history' }])}
        <ul className="max-h-96 overflow-auto space-y-1">{d.learners.filter(l => statusFilter === 'all' || l.status === statusFilter).filter(l => `${l.display_name} ${d.learner_admissions.filter(a => a.learner_id === l.id).map(a => a.admission_number).join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(l => <li key={l.id}><Button className="w-full justify-start" variant={learnerId === l.id ? 'secondary' : 'ghost'} onClick={() => { setLearnerId(l.id); setEnrolmentId(''); setPlacementId('') }}>{String(l.display_name)}</Button><span className="text-xs text-muted-foreground">{l.status === 'left' ? 'Withdrawn' : String(l.status)}</span></li>)}</ul>
        {f('addLearner', 'Add learner', [field('display_name', 'Full name')], {}, 'Create the learner record, then select them to admit and enrol.')}
      </div>
      <div className="space-y-6" key={learnerId}>{!learner ? <p>Select a learner to manage admission, enrolment, class placement and subjects.</p> : <>
        <h2 className="text-2xl font-semibold">{String(learner.display_name)}</h2>
        <p>Learner status: <strong>{learner.status === 'left' ? 'Withdrawn' : String(learner.status)}</strong></p>
        <div className="grid md:grid-cols-2 gap-4">
          {learner.status === 'active' && admissions.some(a => a.status === 'active') && <>
            {f('withdrawLearner', 'Withdraw learner', [date('effective_on', 'Last day (on or before today)', d.today), field('reason', 'Withdrawal reason')], { learner_id: learnerId }, 'Closes admission, current enrolments, placements and subjects through this inclusive last day. Resolve future scheduled records first.')}
            {f('completeLearner', 'Complete / graduate learner', [date('effective_on', 'Last day (on or before today)', d.today), field('reason', 'Completion reason')], { learner_id: learnerId }, 'Closes current academic records. Further enrolment requires explicit re-admission.')}
          </>}
          {['left', 'completed'].includes(String(learner.status)) && f('readmitLearner', 'Re-admit / reactivate learner', [date('effective_on', 'New admission date', d.today), field('admission_number', 'New unique admission number'), field('reason', 'Re-admission reason')], { learner_id: learnerId }, 'Must be after all prior admission end dates and on or before today. Creates a new admission; prior records stay closed. Only one enrolment per learner per academic year is allowed.')}
        </div>
        <History title="Lifecycle status history" rows={d.lifecycle_history.filter(h => h.learner_id === learnerId).map(h => ({ id: h.id, title: `${h.from_status === 'left' ? 'withdrawn' : h.from_status} → ${h.to_status === 'left' ? 'withdrawn' : h.to_status}`, detail: `Effective ${h.effective_on} · ${h.reason} · Recorded ${h.occurred_at}` }))} />
        <History title={`Current academic placement · ${d.today}`} rows={placements.filter(p => learner.status === 'active' && current(p) && enrolments.some(e => e.id === p.enrolment_id && current(e))).map(p => ({ id: p.id, title: `${className(p.class_group_id)} · ${yearName(p.academic_year_id)}`, detail: period(p) }))} />
        <div className="grid md:grid-cols-2 gap-4">
          {learner.status === 'active' && !admissions.some(a => a.status === 'active') && f('admit', 'Admit learner', [field('admission_number', 'Admission number'), date('admitted_on', 'Admission date', d.today)], { learner_id: learnerId })}
          {learner.status === 'active' && admissions.some(a => a.status === 'active') && f('enrol', 'Enrol for academic year', [field('admission_id', 'Admission', options(admissions.filter(a => a.status === 'active'), a => value(a, 'admission_number'))), field('academic_year_id', 'Academic year', years), field('grade_id', 'Grade', grades), date('starts_on', 'Enrolment start', d.today), date('ends_on', 'Enrolment end', undefined, true)], {}, 'Leave the end date empty to use the academic year end.')}
        </div>
        {picker('Enrolment to manage', enrolmentId, v => { setEnrolmentId(v); setPlacementId('') }, options(enrolments.filter(e => learner.status === 'active' && e.status === 'active'), e => `${yearName(e.academic_year_id)} · ${gradeName(e.grade_id)}`))}
        {learner.status === 'active' && enrolment?.status === 'active' && <div className="space-y-4" key={enrolment.id}>
          {f('place', 'Place in class', [field('class_group_id', 'Class', options(d.class_groups.filter(c => c.status === 'active' && c.academic_year_id === enrolment.academic_year_id && c.grade_id === enrolment.grade_id), c => value(c, 'label'))), date('starts_on', 'Placement start', d.today), date('ends_on', 'Placement end', undefined, true)], { enrolment_id: enrolment.id }, 'Use Transfer class below when a placement already covers the intended date.')}
          {picker('Placement to manage', placementId, setPlacementId, options(placements.filter(p => p.enrolment_id === enrolment.id), p => `${className(p.class_group_id)} · ${period(p)}`))}
          {placement && <div key={placement.id} className="grid md:grid-cols-2 gap-4">
            {f('transfer', 'Transfer class', [field('class_group_id', 'Destination class', options(d.class_groups.filter(c => c.status === 'active' && c.id !== placement.class_group_id && c.academic_year_id === placement.academic_year_id && c.grade_id === placement.grade_id), c => value(c, 'label'))), date('starts_on', 'First day in new class', d.today)], { enrolment_id: enrolment.id, placement_id: placement.id }, 'The old placement and its subjects end the previous day. Enrol subjects for the new placement after transfer. Choose a transfer date after any scheduled subject start dates.')}
            {f('enrolSubject', 'Enrol in subject', [field('offering_id', 'Subject offering', options(d.subject_offerings.filter(o => o.status === 'active' && o.class_group_id === placement.class_group_id), o => offeringName(o.id))), date('starts_on', 'Subject start', d.today), date('ends_on', 'Subject end', undefined, true)], { placement_id: placement.id })}
          </div>}
        </div>}
        <History title="Admission history" rows={admissions.map(a => ({ id: a.id, title: String(a.admission_number), detail: `${a.admitted_on} – ${a.left_on ?? 'present'} · ${a.status}` }))} />
        <History title="Yearly enrolment history" rows={enrolments.map(e => ({ id: e.id, title: `${yearName(e.academic_year_id)} · ${gradeName(e.grade_id)}`, detail: `${period(e)} · ${e.status}` }))} />
        <History title="Class placement history" rows={placements.map(p => ({ id: p.id, title: `${className(p.class_group_id)} · ${yearName(p.academic_year_id)}`, detail: period(p) }))} />
        <History title="Subject enrolment history" rows={subjectEnrolments.map(s => ({ id: s.id, title: offeringName(s.offering_id), detail: `${period(s)} · ${s.status}` }))} />
      </>}</div>
    </div>}
    {section === 'Classes' && <div className="space-y-6">
      <div className="max-w-xl">{f('saveClass', 'Create class', [field('academic_year_id', 'Academic year', years), field('grade_id', 'Grade', grades), field('code', 'Class code'), field('label', 'Class name'), { ...field('status', 'Status', choices('active', 'closed')), value: 'active' }])}</div>
      <div className="grid md:grid-cols-2 gap-4">{classes.map(c => <details key={c.id} className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">{String(c.label)} · {yearName(c.academic_year_id)} · {String(c.status)}</summary><div className="mt-4 space-y-4"><p>{d.class_placements.filter(p => p.class_group_id === c.id && current(p) && d.learner_enrolments.some(e => e.id === p.enrolment_id && current(e) && d.learners.some(l => l.id === e.learner_id && l.status === 'active'))).length} current placements</p>
        {f('saveClass', 'Save class', [{ ...field('code', 'Class code'), value: value(c, 'code') }, { ...field('label', 'Class name'), value: value(c, 'label') }, { ...field('status', 'Status', choices('active', 'closed')), value: value(c, 'status') }], { id: c.id })}
      </div></details>)}</div>
    </div>}
    {section === 'Academic Years & Terms' && <div className="space-y-6"><div className="grid md:grid-cols-2 gap-4">
      {f('saveYear', 'Create academic year', [field('code', 'Year name / code'), date('starts_on', 'Start date'), date('ends_on', 'End date'), { ...field('status', 'Status', choices('draft', 'active', 'closed')), value: 'draft' }])}
      {f('saveTerm', 'Create term', [field('academic_year_id', 'Academic year', years), field('code', 'Term name / code'), { ...field('ordinal', 'Term number'), type: 'number' }, date('starts_on', 'Start date'), date('ends_on', 'End date')])}
    </div>{d.academic_years.map(y => <details key={y.id} className="border rounded-lg p-4"><summary className="font-medium cursor-pointer">{String(y.code)} · {period(y)} · {String(y.status)}</summary><div className="grid md:grid-cols-2 gap-4 mt-4">
      {f('saveYear', 'Save academic year', [{ ...field('code', 'Year name / code'), value: value(y, 'code') }, date('starts_on', 'Start date', value(y, 'starts_on')), date('ends_on', 'End date', value(y, 'ends_on')), { ...field('status', 'Status', choices('draft', 'active', 'closed')), value: value(y, 'status') }], { id: y.id }, 'Date changes must still contain all existing terms, enrolments and assignments.')}
      {d.terms.filter(t => t.academic_year_id === y.id).sort((a, b) => Number(a.ordinal) - Number(b.ordinal)).map(t => <div key={t.id}>{f('saveTerm', `Save ${t.code}`, [{ ...field('code', 'Term name / code'), value: value(t, 'code') }, { ...field('ordinal', 'Term number'), type: 'number', value: value(t, 'ordinal') }, date('starts_on', 'Start date', value(t, 'starts_on')), date('ends_on', 'End date', value(t, 'ends_on'))], { id: t.id, academic_year_id: y.id })}</div>)}
    </div></details>)}</div>}
    {section === 'Subjects' && <div className="space-y-6"><div className="grid md:grid-cols-2 gap-4">
      {f('saveSubject', 'Enable school subject', [field('subject_id', 'Catalogue subject', options(d.subject_catalogue.filter(s => s.status === 'active' && !d.school_subjects.some(ss => ss.subject_id === s.id)), s => `${s.curriculum_code} · ${s.name}`)), field('local_code', 'School subject code'), field('display_name', 'School subject name')], { enabled: 'true' })}
      <div className="space-y-3">{picker('Offering class', classId, setClassId, classOptions)}{classId && f('createOffering', 'Create subject offering', [field('school_subject_id', 'Enabled subject', options(d.school_subjects.filter(s => s.enabled && d.subject_grades.some(sg => sg.subject_id === s.subject_id && sg.grade_id === find(d.class_groups, classId)?.grade_id)), s => value(s, 'display_name')))], { class_group_id: classId })}</div>
    </div><div className="grid md:grid-cols-2 gap-4">{d.school_subjects.map(s => <details key={s.id} className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">{String(s.display_name)} · {s.enabled ? 'Enabled' : 'Disabled'}</summary><div className="mt-4">{f('saveSubject', 'Save school subject', [{ ...field('local_code', 'School subject code'), value: value(s, 'local_code') }, { ...field('display_name', 'School subject name'), value: value(s, 'display_name') }, { ...field('enabled', 'Availability', [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]), value: String(s.enabled) }], { id: s.id })}</div></details>)}</div>
      <History title="Subject offerings" rows={offerings.map(o => ({ id: o.id, title: offeringName(o.id), detail: String(o.status) }))} />
      <div className="max-w-xl">{f('closeOffering', 'Close offering', [field('id', 'Offering', options(offerings.filter(o => o.status === 'active'), o => offeringName(o.id)))], {}, 'Closing removes the offering from current teaching access and retains its history.')}</div>
    </div>}
    {section === 'Teacher Assignments' && <div className="space-y-6">
      <History title="School staff" rows={d.staff_profiles.map(s => ({ id: s.id, title: String(s.display_name), detail: `${s.staff_code} · ${s.status}` }))} />
      <div className="max-w-md">{picker('Class filter', classId, setClassId, classOptions)}</div>
      <div className="grid md:grid-cols-2 gap-4">{f('assign', 'Assign teacher', [field('staff_id', 'Teacher', staff), field('offering_id', 'Subject offering', options(offerings.filter(o => o.status === 'active'), o => offeringName(o.id))), date('starts_on', 'First teaching day', d.today), date('ends_on', 'Last teaching day', undefined, true)], {}, 'Staff must have an active Teacher role. Dates are inclusive; an empty end lasts through the academic year.')}</div>
      <History title={`Current teacher assignments · ${d.today}`} rows={d.teacher_assignments.filter(a => current(a) && offerings.some(o => o.id === a.offering_id)).map(a => ({ id: a.id, title: `${value(find(d.staff_profiles, a.staff_id), 'display_name')} · ${offeringName(a.offering_id)}`, detail: period(a) }))} />
      <h3 className="font-semibold">Assignment history and changes</h3>{d.teacher_assignments.filter(a => offerings.some(o => o.id === a.offering_id)).map(a => <details key={`${a.id}-${a.row_version}`} className="border rounded-lg p-4"><summary className="cursor-pointer">{value(find(d.staff_profiles, a.staff_id), 'display_name')} · {offeringName(a.offering_id)} · {period(a)} · {a.status === 'active' && a.ends_on && String(a.ends_on) < d.today ? 'ended' : String(a.status)}</summary>{a.status === 'active' && <div className="grid md:grid-cols-2 gap-4 mt-4">
        {f('endAssignment', 'End assignment', [date('ends_on', 'Last teaching day', d.today)], { assignment_id: a.id }, 'Access continues through this date. Historical assignments remain recorded.')}
        {f('replaceAssignment', 'Replace teacher', [field('staff_id', 'Replacement teacher', staff.filter(s => s.value !== a.staff_id)), date('starts_on', 'Replacement first day', d.today), date('ends_on', 'Replacement last day', undefined, true)], { assignment_id: a.id }, 'The previous teacher finishes the day before the replacement starts.')}
      </div>}</details>)}
      <Link href={`/academics?school=${school}`} className="underline">View offering rosters</Link>
    </div>}
  </div>
}
