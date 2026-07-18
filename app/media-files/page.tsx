import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { MediaFilesClient } from '@/components/media-files-client'
import { getMediaFolders } from '@/app/actions/media-files'

export default async function MediaFilesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const folders = await getMediaFolders()

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Media Files</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage school photos and videos
          </p>
        </div>

        <MediaFilesClient initialFolders={folders} />
      </div>
    </AppLayout>
  )
}
