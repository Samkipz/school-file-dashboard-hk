import { AppShell } from '@/components/app-shell'
import { loadSchoolContext } from '@/lib/academic-context'
import { academicNavigation } from '@/lib/academic-navigation'

export async function AppLayout({ children, school }: { children: React.ReactNode; school?: string }) {
  const loaded = await loadSchoolContext(school)
  return <AppShell schools={loaded.schools} school={loaded.school} navigation={academicNavigation(loaded.context, loaded.school?.id)}>{children}</AppShell>
}
