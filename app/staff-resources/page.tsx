import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { StaffResourcesClient } from '@/components/staff-resources-client'
import { getRootFolders } from '@/app/actions/staff-resources'

export default async function StaffResourcesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const folders = await getRootFolders()

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Staff Resources</h1>
          <p className="text-muted-foreground mt-2">Manage shared school resources and documents</p>
        </div>

        <StaffResourcesClient initialFolders={folders} />
      </div>
    </AppLayout>
  )
}
