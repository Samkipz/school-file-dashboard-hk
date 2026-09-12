import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'

async function loadAcademics(searchParams: Promise<{ school?: string; offering?: string }>) {
  try {
    const schools = await foundation.listSchools()
    const params = await searchParams
    const school = schools.find(s => s.id === params.school) ?? (!params.school ? schools[0] : undefined)
    const data = school ? await foundation.getFoundation(school.id) : null
    const roster = school && params.offering ? await foundation.getOfferingRoster(school.id, params.offering) : null
    return { schools, school, data, roster }
  } catch (error) {
    if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
    if (error instanceof DomainError) return null
    throw error
  }
}

export default async function AcademicsPage({ searchParams }: { searchParams: Promise<{ school?: string; offering?: string }> }) {
  const loaded = await loadAcademics(searchParams)
  if (!loaded) return <AppLayout><p className="p-6">This academic context is unavailable.</p></AppLayout>
  const { schools, school, data, roster } = loaded
  return <AppLayout><div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Academics</h1>
      {!school && <p>No active school membership. Contact your school administrator.</p>}
      <nav className="flex gap-4">{schools.map(s => <Link key={s.id} href={`/academics?school=${s.id}`} className="underline">{s.name}</Link>)}</nav>
      {school && <h2 className="text-xl font-semibold">{school.name}</h2>}
      {data && <><p>{data.canManage ? <Link className="underline" href={`/admin/academics?school=${school!.id}`}>Manage school academics</Link> : 'Your current teaching assignments'}</p>
        <ul className="space-y-3">{data.offerings.map(o => <li key={o.id}><Link className="underline" href={`/academics?school=${school!.id}&offering=${o.id}`}>{o.year} · {o.class_name} · {o.subject}</Link></li>)}</ul>
        {!data.offerings.length && <p>No accessible subject offerings.</p>}</>}
      {roster && <section><h2 className="text-xl font-semibold mb-3">Current learners</h2><ul>{roster.map(l => <li key={l.id}>{l.display_name}</li>)}</ul>{!roster.length && <p>No current enrolments.</p>}</section>}
    </div></AppLayout>
}
