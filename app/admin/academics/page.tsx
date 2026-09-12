import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { AcademicAdministration } from '@/components/academic-administration'
import { administration, foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const params = await searchParams
  const loaded = await (async () => {
    try {
      const schools = await foundation.listSchools()
      const school = schools.find(s => s.id === params.school) ?? (!params.school ? schools[0] : undefined)
      return { schools, school, data: school ? await administration.read(school.id) : null }
    } catch (error) {
      if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
      if (error instanceof DomainError) return null
      throw error
    }
  })()
  return <AppLayout><div className="p-4 md:p-8 space-y-6">
    <div><h1 className="text-3xl font-bold">School administration</h1><p className="text-muted-foreground mt-2">Admissions, classes and teaching responsibilities.</p></div>
    {!loaded ? <p>School administrator access is required. <Link className="underline" href="/academics">View your teaching assignments</Link></p> : <>
      <nav aria-label="Schools" className="flex flex-wrap gap-4">{loaded.schools.map(s => <Link key={s.id} className="underline" aria-current={s.id === loaded.school?.id ? 'page' : undefined} href={`/admin/academics?school=${s.id}`}>{s.name}</Link>)}</nav>
      {loaded.school && loaded.data ? <AcademicAdministration key={loaded.school.id} school={loaded.school.id} data={loaded.data} /> : <p>No available school. Select an active school membership.</p>}
    </>}
  </div></AppLayout>
}
