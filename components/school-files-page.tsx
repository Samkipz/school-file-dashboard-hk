import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { PortfoliosClient } from '@/components/portfolios-client'
import { MediaFilesClient } from '@/components/media-files-client'
import { foundation, schoolFiles } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { selectSchool } from '@/lib/academic-navigation'

export async function SchoolFilesPage({ searchParams, media = false }: { searchParams: Promise<{ school?: string }>; media?: boolean }) {
  const params = await searchParams
  const data = await (async () => {
    try {
      const schools = await foundation.listSchools()
      const school = selectSchool(schools, params.school)
      if (!school) return { schools, school: null }
      return { schools, school, portfolios: media ? null : await schoolFiles.listLearners(school.id), folders: media ? await schoolFiles.listFolders(school.id) : null }
    } catch (error) {
      if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
      if (error instanceof DomainError) return null
      throw error
    }
  })()

  return <AppLayout school={params.school}><div className="space-y-6 py-4 sm:py-6">
    <header className="space-y-2"><h1 className="text-4xl font-bold">{media ? 'Media Files' : 'Portfolios'}</h1><p className="text-muted-foreground">{media ? 'Browse and manage private school photos and videos' : 'Learner portfolios and historical files'}</p></header>
    {!data ? <p className="text-muted-foreground">This school context is unavailable for your role.</p> : <>
      <nav className="flex flex-wrap gap-3">{data.schools.map(s => <Link className="underline font-medium" key={s.id} href={`${media ? '/media-files' : '/portfolios'}?school=${s.id}`}>{s.name}</Link>)}</nav>
      {!data.school ? <p className="text-muted-foreground">No accessible school selected.</p> : <>
        <h2 className="text-2xl font-semibold">{data.school.name}</h2>
        {data.portfolios && <PortfoliosClient key={data.school.id} school={data.school.id} initialStudents={data.portfolios.learners} canManage={data.portfolios.canManage} />}
        {data.folders && <MediaFilesClient key={data.school.id} school={data.school.id} initialFolders={data.folders} />}
      </>}
    </>}
  </div></AppLayout>
}
