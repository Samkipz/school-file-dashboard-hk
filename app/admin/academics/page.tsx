import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { AcademicAdministration } from '@/components/academic-administration'
import { administration, foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { selectSchool } from '@/lib/academic-navigation'

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const params = await searchParams
  const loaded = await (async () => {
    try {
      const schools = await foundation.listSchools()
      const school = selectSchool(schools, params.school)
      return { schools, school, data: school ? await administration.read(school.id) : null }
    } catch (error) {
      if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
      if (error instanceof DomainError) return null
      throw error
    }
  })()
return <AppLayout school={params.school}><div className="space-y-6 py-4 sm:py-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">School administration</h1><p className="text-muted-foreground">Admissions, classes and teaching responsibilities.</p></header>
    {!loaded ? <p className="text-muted-foreground">School administrator access is required. <Link className="underline font-medium" href="/academics">View your teaching assignments</Link></p> : <>
      <nav aria-label="Schools" className="flex flex-wrap gap-3">{loaded.schools.map(s => <Link key={s.id} className="underline font-medium" aria-current={s.id === loaded.school?.id ? 'page' : undefined} href={`/admin/academics?school=${s.id}`}>{s.name}</Link>)}</nav>
      {loaded.school && loaded.data ? <AcademicAdministration key={loaded.school.id} school={loaded.school.id} data={loaded.data} /> : <p className="text-muted-foreground">No available school. Select an active school membership.</p>}
    </>}
  </div></AppLayout>
}
