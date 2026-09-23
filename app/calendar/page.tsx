import { DeferredFeature } from '@/components/deferred-feature'
import { legacyUnavailable } from '@/lib/legacy-boundary'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { CalendarClient } from '@/components/calendar-client'
import { getEvents } from '@/app/actions/calendar'

export default async function CalendarPage() {
  if (legacyUnavailable()) return <DeferredFeature />

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const now = new Date()
  const initialEvents = await getEvents(now.getFullYear(), now.getMonth())

return (
    <AppLayout>
      <div className="space-y-6 py-4 sm:py-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">View and manage your school events</p>
        </header>
        <CalendarClient initialEvents={initialEvents} />
      </div>
    </AppLayout>
  )
}
