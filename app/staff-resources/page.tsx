import { DeferredFeature } from '@/components/deferred-feature'
import { legacyUnavailable } from '@/lib/legacy-boundary'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { StaffResourcesClient } from '@/components/staff-resources-client'
import { getRootFolders } from '@/app/actions/staff-resources'

export default async function StaffResourcesPage() {
  if (legacyUnavailable()) return <DeferredFeature />

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const folders = await getRootFolders()

  return (
    <AppLayout>
      <div className="space-y-6 py-4 sm:py-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Staff Resources</h1>
          <p className="text-muted-foreground">Manage shared school resources and documents</p>
        </header>
        <StaffResourcesClient initialFolders={folders} />
      </div>
    </AppLayout>
  )
}
