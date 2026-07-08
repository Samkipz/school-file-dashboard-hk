import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function NoticeboardPage() {
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
            <h1 className="text-4xl font-bold text-foreground">Noticeboard</h1>
            <p className="text-muted-foreground mt-2">View announcements and upcoming events</p>
          </div>

          <Button className="gap-2 mb-6">
            <Plus className="w-4 h-4" />
            New Announcement
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Announcements</h2>
              <Card className="p-8 text-center bg-card border-border">
                <p className="text-muted-foreground">No announcements yet</p>
              </Card>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Events</h2>
              <Card className="p-8 text-center bg-card border-border">
                <p className="text-muted-foreground">No events yet</p>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
