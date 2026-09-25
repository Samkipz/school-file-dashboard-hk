import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { SchoolContextState } from '@/components/academic-workspace'
import { SchoolSetupWorkspace } from '@/components/admin-school-status'
import { loadSchoolContext } from '@/lib/academic-context'
import { administration } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'

export default async function AdminSetupPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams
  const loaded = await loadSchoolContext(school)

  if (!loaded.context || !loaded.school) {
    return <AppLayout school={school}><div className="py-4 sm:py-6"><SchoolContextState loaded={loaded} /></div></AppLayout>
  }

  try {
    const data = await administration.read(loaded.school.id)
    return <AppLayout school={loaded.school.id}><SchoolSetupWorkspace school={loaded.school} data={data} /></AppLayout>
  } catch (error) {
    if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
    if (error instanceof DomainError) {
      return <AppLayout school={loaded.school.id}><div className="py-4 sm:py-6"><p role="alert" className="rounded-xl border bg-card p-6 text-muted-foreground">School administrator access is required to view this workspace.</p></div></AppLayout>
    }
    throw error
  }
}
