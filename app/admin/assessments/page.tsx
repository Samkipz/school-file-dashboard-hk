import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { AssessmentPlanning } from '@/components/assessment-planning'
import { assessments, foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { selectSchool } from '@/lib/academic-navigation'

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ school?: string; draft?: string }> }) {
  const params = await searchParams
  const loaded = await (async () => {
    try {
      const schools = await foundation.listSchools()
      const school = selectSchool(schools, params.school)
      const data = school ? await assessments.read(school.id) : null
      const selected = params.draft && school ? await assessments.get(school.id, params.draft) : undefined
      return { schools, school, data, selected }
    } catch (error) {
      if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
      if (error instanceof DomainError) return null
      throw error
    }
  })()
  return <AppLayout school={params.school}><div className="space-y-6 py-4 sm:py-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">Assessment planning</h1><p className="text-muted-foreground">School-wide assessment planning and review. Dates are optional and must fit the offering academic year. Open definitions are locked.</p></header>
    {!loaded ? <div role="alert" className="rounded-xl border bg-destructive/10 p-6"><p>School administrator access is required, or this draft is unavailable.</p></div> : <>
      <nav aria-label="Schools" className="flex flex-wrap gap-3">{loaded.schools.map(s => <Link className="underline font-medium" key={s.id} href={`/admin/assessments?school=${s.id}`} aria-current={s.id === loaded.school?.id ? 'page' : undefined}>{s.name}</Link>)}</nav>
      {loaded.school && loaded.data ? <AssessmentPlanning key={`${loaded.school.id}:${loaded.selected?.id ?? 'new'}:${loaded.selected?.row_version ?? ''}`} school={loaded.school.id} data={loaded.data} selected={loaded.selected} /> : <p className="text-muted-foreground">No available school. Select an active school membership.</p>}
    </>}
  </div></AppLayout>
}
