import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { Card } from '@/components/ui/card'

export default async function CalendarPage() {
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
            <h1 className="text-4xl font-bold text-foreground">Calendar</h1>
            <p className="text-muted-foreground mt-2">View school events and important dates</p>
          </div>

          <Card className="p-12 text-center bg-card border-border">
            <p className="text-muted-foreground">No calendar events scheduled</p>
          </Card>
        </div>
      </main>
    </div>
  )
}
