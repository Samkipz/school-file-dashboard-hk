import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { CalendarClient } from '@/components/calendar-client'
import { getEvents } from '@/app/actions/calendar'

export default async function CalendarPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const now = new Date()
  const initialEvents = await getEvents(now.getFullYear(), now.getMonth())

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-2">View and manage your school events</p>
        </div>

        <CalendarClient initialEvents={initialEvents as any} />
      </div>
    </AppLayout>
  )
}
