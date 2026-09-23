import Link from 'next/link'
import { AppLayout } from '@/components/app-layout'
import { AcademicPeriod, SchoolContextState, TeachingCards, workspaceLink } from '@/components/academic-workspace'
import { loadSchoolContext } from '@/lib/academic-context'
import { academicHref } from '@/lib/academic-navigation'

export default async function HomePage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams
  const loaded = await loadSchoolContext(school)
  const context = loaded.context
  return <AppLayout school={school}><div className="space-y-6 py-4 sm:py-6">
    {!context || !loaded.school ? <SchoolContextState loaded={loaded} /> : <>
      <header><p className="mb-2 text-sm font-medium text-primary">{context.canManage ? 'School administration' : 'Your teaching day'}</p><h1 className="text-3xl font-bold sm:text-4xl">{context.canManage ? 'School overview' : 'Welcome to SchoolHub'}</h1><p className="mt-3 text-muted-foreground">{context.canManage ? 'Manage academic setup, learners and teaching responsibilities.' : 'Your subjects, classes and learners, together in one place.'}</p></header>
      <AcademicPeriod context={context} />
      {context.canManage && <section className="grid gap-4 sm:grid-cols-2"><Link className="rounded-xl border bg-card p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" href={academicHref('/admin/academics', loaded.school.id)}><h2 className="text-xl font-semibold">School Administration</h2><p className="mt-2 text-sm text-muted-foreground">Learners, academic years, classes, subjects and teacher assignments.</p></Link><Link className="rounded-xl border bg-card p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" href={academicHref('/admin/assessments', loaded.school.id)}><h2 className="text-xl font-semibold">Assessment Setup</h2><p className="mt-2 text-sm text-muted-foreground">Configure assessment types and plan draft assessments.</p></Link></section>}
      {context.canTeach && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">My Teaching</h2><Link className={`${workspaceLink} border`} href={academicHref('/academics', loaded.school.id)}>Open My Teaching</Link></div><TeachingCards school={loaded.school.id} terms={context.terms} /></section>}
      {!context.canTeach && !context.canManage && <p className="rounded-xl border p-6">No teaching or administration workspace is available for your current role. Contact your school administrator.</p>}
    </>}
  </div></AppLayout>
}
