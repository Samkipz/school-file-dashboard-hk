import Link from 'next/link'
import { AlertTriangle, ArrowRight, BookOpen, BriefcaseBusiness, CheckCircle2, CircleDashed, FileText, GraduationCap, Settings, Users } from 'lucide-react'
import { academicHref, currentPeriodLabel, type School } from '@/lib/academic-navigation'
import type { AdminData } from '@/lib/domain/administration'

type SetupStatus = 'Ready' | 'Needs attention' | 'Not started' | 'Blocked'

type SetupItem = {
  key: string
  label: string
  summary: string
  status: SetupStatus
  problem?: string
  href: string
  action: string
}

function statusClasses(status: SetupStatus) {
  switch (status) {
    case 'Ready':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    case 'Needs attention':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
    case 'Blocked':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
  }
}

function derivedSetupItems(data: AdminData, school: School): SetupItem[] {
  const activeYears = data.academic_years.filter(year => year.status === 'active')
  const activeStaff = data.staff_profiles.filter(staff => staff.status === 'active')
  const activeLearners = data.learners.filter(learner => learner.status === 'active')
  const activeSubjects = data.school_subjects.filter(subject => subject.enabled)
  const offerings = data.subject_offerings.filter(offering => offering.status === 'active')
  const activeAssignments = data.teacher_assignments.filter(assignment => assignment.status === 'active')

  return [
    {
      key: 'school-profile',
      label: 'School profile',
      summary: 'Confirm the current school context and operating profile.',
      status: 'Ready',
      href: academicHref('/admin/settings', school.id),
      action: 'Review school profile',
    },
    {
      key: 'academic-calendar',
      label: 'Academic calendar',
      summary: 'Defines the academic year and terms used throughout the school.',
      status: data.academic_years.length ? (activeYears.length ? 'Ready' : 'Needs attention') : 'Not started',
      problem: data.academic_years.length ? (activeYears.length ? undefined : 'No active academic year is available for the current school context.') : 'No academic year has been configured yet.',
      href: academicHref('/admin/academics', school.id),
      action: 'Manage calendar',
    },
    {
      key: 'classes',
      label: 'Classes',
      summary: 'Set up the classes learners belong to during the active academic year.',
      status: data.class_groups.length ? 'Ready' : 'Not started',
      problem: data.class_groups.length ? undefined : 'Classes have not been configured for this school yet.',
      href: academicHref('/admin/academics', school.id),
      action: 'Manage classes',
    },
    {
      key: 'subjects',
      label: 'Subjects',
      summary: 'Configure subjects and the offerings available to each class and grade.',
      status: activeSubjects.length ? (offerings.length ? 'Ready' : 'Needs attention') : 'Not started',
      problem: activeSubjects.length ? (offerings.length ? undefined : 'Subjects are enabled but no active offerings have been created for teaching.') : 'Subject setup has not started for this school.',
      href: academicHref('/admin/academics', school.id),
      action: 'Manage subjects',
    },
    {
      key: 'staff',
      label: 'Staff',
      summary: 'Keep staff records and school roles aligned with the teaching model.',
      status: activeStaff.length ? 'Ready' : 'Not started',
      problem: activeStaff.length ? undefined : 'No active staff records are available in the current school.',
      href: academicHref('/admin/staff', school.id),
      action: 'Manage staff',
    },
    {
      key: 'teaching-allocations',
      label: 'Teaching allocations',
      summary: 'Assign teachers to the subjects and classes they teach.',
      status: activeSubjects.length ? (activeAssignments.length ? 'Ready' : 'Needs attention') : 'Blocked',
      problem: activeSubjects.length ? (activeAssignments.length ? undefined : 'No active teacher assignments have been created yet.') : 'Complete subject setup first before assigning teachers.',
      href: academicHref('/admin/academics', school.id),
      action: 'Manage teaching',
    },
    {
      key: 'learners',
      label: 'Learners',
      summary: 'Record learner admissions, enrolments and placement in the active academic structure.',
      status: activeLearners.length ? 'Ready' : 'Not started',
      problem: activeLearners.length ? undefined : 'No active learners are currently enrolled in this school.',
      href: academicHref('/admin/learners', school.id),
      action: 'Manage learners',
    },
  ]
}

export function SchoolAdminDashboard({ school, data }: { school: School; data: AdminData }) {
  const items = derivedSetupItems(data, school)
  const needsAttention = items.filter(item => item.status !== 'Ready' && item.status !== 'Not started')
  const activeIssues = items.filter(item => item.status === 'Needs attention' || item.status === 'Blocked')
  const overviewFacts = [
    { label: 'Learners', value: data.learners.length },
    { label: 'Classes', value: data.class_groups.length },
    { label: 'Subjects', value: data.school_subjects.length },
    { label: 'Staff', value: data.staff_profiles.length },
  ]

  return (
    <div className="space-y-6 py-4 sm:py-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">School Admin dashboard</p>
        <h1 className="text-3xl font-bold sm:text-4xl">{school.name}</h1>
        <p className="text-muted-foreground">{currentPeriodLabel(data.academic_years, 'year')} · {currentPeriodLabel(data.terms, 'term')}</p>
      </header>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Needs your attention</p>
            <h2 className="mt-2 text-2xl font-semibold">{activeIssues.length ? 'Some setup needs attention' : 'Everything looks in good order'}</h2>
          </div>
          <Link href={academicHref('/admin/setup', school.id)} className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Review setup
          </Link>
        </div>

        {activeIssues.length ? (
          <div className="mt-5 space-y-3">
            {activeIssues.map(item => (
              <div key={item.key} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.problem ?? item.summary}</p>
                  </div>
                  <Link href={item.href} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {item.action}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">The school is configured and ready to operate. Use Academics, Staff, Learners or Settings when you need to make changes.</p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h3 className="text-lg font-semibold">School overview</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overviewFacts.map(fact => (
            <div key={fact.label} className="rounded-lg border bg-muted/40 p-4">
              <dt className="text-sm text-muted-foreground">{fact.label}</dt>
              <dd className="mt-2 text-xl font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

export function SchoolSetupWorkspace({ school, data }: { school: School; data: AdminData }) {
  const items = derivedSetupItems(data, school)
  const actionable = items.filter(item => item.status === 'Needs attention' || item.status === 'Blocked')
  const readyLabels = items.filter(item => item.status === 'Ready').map(item => item.label)

  return (
    <div className="space-y-6 py-4 sm:py-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">School setup</p>
        <h1 className="text-3xl font-bold">{actionable.length ? 'School setup needs attention' : 'School setup is ready'}</h1>
        <p className="text-muted-foreground">{actionable.length ? 'A few areas need attention before the school is fully configured.' : 'Your school is configured and ready to use.'}</p>
      </header>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {readyLabels.map(label => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {label}
              </span>
            ))}
          </div>

          {actionable.length ? (
            <div className="space-y-3">{actionable.map(item => (
              <div key={item.key} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.problem ?? item.summary}</p>
                  </div>
                  <Link href={item.href} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {item.action}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Need to change something? Use Academics, Staff, Learners or Settings to update the live school configuration.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function AcademicsOverviewWorkspace({ school, data }: { school: School; data: AdminData }) {
  const yearLabel = currentPeriodLabel(data.academic_years, 'year', data.today)
  const termLabel = currentPeriodLabel(data.terms, 'term', data.today)

  return (
    <div className="space-y-6 py-4 sm:py-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Academics</p>
        <h1 className="text-3xl font-bold">{yearLabel} · {termLabel}</h1>
        <p className="text-muted-foreground">Academic management workspace</p>
      </header>
    </div>
  )
}

export function AdminTransitionPage({ school, title, description, actionLabel, actionHref }: { school: School; title: string; description: string; actionLabel: string; actionHref: string }) {
  return (
    <div className="space-y-6 py-4 sm:py-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">School Administration</p>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
          <div>
            <p className="font-medium">This area is still being integrated into the new School Admin experience.</p>
            <p className="mt-2 text-sm text-muted-foreground">The current working school administration area remains the authoritative source for the underlying data and workflow.</p>
          </div>
        </div>
        <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
          {actionLabel}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
