import Link from 'next/link'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { academicHref, currentPeriodLabel } from '@/lib/academic-navigation'
import { loadSchoolContext, loadTeaching } from '@/lib/academic-context'
import { DomainError } from '@/lib/domain/foundation'

export const workspaceLink = 'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function SchoolContextState({ loaded }: { loaded: Awaited<ReturnType<typeof loadSchoolContext>> }) {
  if (loaded.denied) return <div role="alert" className="rounded-xl border bg-card p-6"><h1 className="text-xl font-semibold">School context unavailable</h1><p className="mt-2 text-muted-foreground">You do not have access to this school context. Return Home or select an available school.</p><Link className={`${workspaceLink} mt-4 border`} href="/">Home</Link></div>
  return <section className="rounded-xl border bg-card p-6"><h1 className="text-2xl font-semibold">{loaded.schools.length ? 'Choose your school' : 'No active school membership'}</h1><p className="mt-2 text-muted-foreground">{loaded.schools.length ? 'Choose the school you want to work in.' : 'Contact your school administrator to arrange access.'}</p><div className="mt-6 flex flex-wrap gap-3">{loaded.schools.map(s => <Link key={s.id} className={`${workspaceLink} border`} href={academicHref('/', s.id)}>{s.name}<ArrowRight className="size-4" /></Link>)}</div></section>
}

export function AcademicPeriod({ context }: { context: NonNullable<Awaited<ReturnType<typeof loadSchoolContext>>['context']> }) {
  return <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Current academic year</dt><dd className="mt-1 font-medium">{currentPeriodLabel(context.years, 'year')}</dd></div><div><dt className="text-sm text-muted-foreground">Current term</dt><dd className="mt-1 font-medium">{currentPeriodLabel(context.terms, 'term')}</dd></div></dl>
}

export async function TeachingCards({ school, terms }: { school: string; terms: { code: string; academic_year_id: string }[] }) {
  const offerings = await loadTeaching(school).catch(error => {
    if (error instanceof DomainError) return null
    throw error
  })
  if (!offerings) return <p role="alert" className="rounded-xl border bg-card p-6">Teaching context is unavailable. Your access may have changed. Refresh or contact your administrator.</p>
  if (!offerings.length) return <div className="rounded-xl border border-dashed bg-card p-8"><h3 className="font-semibold">No current teaching assignments</h3><p className="mt-2 text-sm text-muted-foreground">Your administrator can assign you to a subject and class in the current academic year.</p></div>
  return <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{offerings.map(o => <li key={o.id}><Link href={academicHref('/academics', school, o.id)} className="group flex h-full flex-col rounded-xl border bg-card p-6 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
    <div className="mb-6 flex items-center justify-between"><BookOpen className="size-6 text-primary" /><ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" /></div>
    <p className="text-sm text-muted-foreground">{o.grade} · {o.class_name}</p><h3 className="mt-1 break-words text-xl font-semibold">{o.subject}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{o.year} · {currentPeriodLabel(terms.filter(t => t.academic_year_id === o.academic_year_id), 'term')}</p>
    <p className="mt-8 flex items-center gap-2 text-sm"><Users className="size-4" />{o.learnerCount} {o.learnerCount === 1 ? 'learner' : 'learners'}</p>
  </Link></li>)}</ul>
}
