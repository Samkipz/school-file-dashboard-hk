import Link from 'next/link'
import { AppLayout } from '@/components/app-layout'
import { SchoolContextState, workspaceLink } from '@/components/academic-workspace'
import { loadSchoolContext } from '@/lib/academic-context'
import { academicHref } from '@/lib/academic-navigation'

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams
  const loaded = await loadSchoolContext(school)
  return <AppLayout school={school}><div className="space-y-6 py-4 sm:py-6">
    {!loaded.context || !loaded.school ? <SchoolContextState loaded={loaded} /> : <>
      <header className="space-y-2"><h1 className="text-3xl font-bold">Private Files</h1><p className="text-muted-foreground">School files you are authorized to access.</p></header>
      {loaded.context.canManage || loaded.context.canTeach ? <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-semibold">Learner files</h2><p className="mt-2 text-muted-foreground">{loaded.context.canManage ? 'Manage existing learner portfolio files and history.' : 'Read files for learners in your current teaching rosters.'} Assessment evidence linking is not available yet.</p><Link href={academicHref('/portfolios', loaded.school.id)} className={`${workspaceLink} mt-4 border`}>Browse learner files</Link></section> : <p className="text-muted-foreground">No file access is available for your role.</p>}
      {loaded.context.canManage && <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-semibold">School media</h2><p className="mt-2 text-muted-foreground">Manage existing private school photos and videos.</p><Link href={academicHref('/media-files', loaded.school.id)} className={`${workspaceLink} mt-4 border`}>Browse school media</Link></section>}
    </>}
  </div></AppLayout>
}
