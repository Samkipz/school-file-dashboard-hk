import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderPlus, Upload } from 'lucide-react'

export default async function StaffResourcesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Staff Resources</h1>
            <p className="text-muted-foreground mt-2">Manage shared school resources and documents</p>
          </div>

          <div className="mb-6 flex gap-3">
            <Button className="gap-2">
              <FolderPlus className="w-4 h-4" />
              New Folder
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
          </div>

          <Card className="p-12 text-center bg-card border-border">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">No folders yet</p>
              <p className="text-sm">Create a new folder to get started</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
