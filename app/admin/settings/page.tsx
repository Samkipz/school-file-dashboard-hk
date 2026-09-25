import { AppLayout } from '@/components/app-layout'
import { AdminTransitionPage } from '@/components/admin-school-status'
import { loadSchoolContext } from '@/lib/academic-context'
import { SchoolContextState } from '@/components/academic-workspace'
import { academicHref } from '@/lib/academic-navigation'

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams
  const loaded = await loadSchoolContext(school)
  if (!loaded.context || !loaded.school) {
    return <AppLayout school={school}><div className="py-4 sm:py-6"><SchoolContextState loaded={loaded} /></div></AppLayout>
  }

  return <AppLayout school={loaded.school.id}><AdminTransitionPage
    school={loaded.school}
    title="Settings"
    description="School identity and school-level configuration remain part of the future admin settings workspace."
    actionLabel="Review readiness"
    actionHref={academicHref('/admin/setup', loaded.school.id)}
  /></AppLayout>
}
