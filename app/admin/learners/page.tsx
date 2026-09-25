import { AppLayout } from '@/components/app-layout'
import { AdminTransitionPage } from '@/components/admin-school-status'
import { loadSchoolContext } from '@/lib/academic-context'
import { SchoolContextState } from '@/components/academic-workspace'
import { academicHref } from '@/lib/academic-navigation'

export default async function AdminLearnersPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams
  const loaded = await loadSchoolContext(school)
  if (!loaded.context || !loaded.school) {
    return <AppLayout school={school}><div className="py-4 sm:py-6"><SchoolContextState loaded={loaded} /></div></AppLayout>
  }

  return <AppLayout school={loaded.school.id}><AdminTransitionPage
    school={loaded.school}
    title="Learners"
    description="Learner lifecycle, placement and subject enrolment remain in the established working administration area."
    actionLabel="Open learner administration"
    actionHref={academicHref('/admin/academics', loaded.school.id)}
  /></AppLayout>
}
