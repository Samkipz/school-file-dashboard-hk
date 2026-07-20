import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { ActivityFeed } from '@/components/activity-feed'
import { EventsSection } from '@/components/events-section'
import { getLatestActivities, getUpcomingEvents, getUserInfo } from '@/app/actions/dashboard'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const [activities, events, user] = await Promise.all([
    getLatestActivities(10),
    getUpcomingEvents(5),
    getUserInfo(),
  ])

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome back, <span className="text-primary">{user?.name || 'Guest'}</span>
          </h1>
          <p className="text-muted-foreground mt-2">Here&apos;s what&apos;s happening in your school</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityFeed activities={activities} user={user} />
          <EventsSection events={events} />
        </div>
      </div>
    </AppLayout>
  )
}
