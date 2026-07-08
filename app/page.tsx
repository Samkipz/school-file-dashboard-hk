import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { ActivityFeed } from '@/components/activity-feed'
import { AnnouncementsSection } from '@/components/announcements-section'
import { EventsSection } from '@/components/events-section'
import { getLatestActivities, getLatestAnnouncements, getUpcomingEvents, getUserInfo } from '@/app/actions/dashboard'

export default async function DashboardPage() {
  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  // Fetch dashboard data
  const [activities, announcements, events, user] = await Promise.all([
    getLatestActivities(10),
    getLatestAnnouncements(5),
    getUpcomingEvents(5),
    getUserInfo(),
  ])

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <SidebarNav />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">
              Welcome back, <span className="text-primary">{user?.name || 'Guest'}</span>
            </h1>
            <p className="text-muted-foreground mt-2">Here&apos;s what&apos;s happening in your school</p>
          </div>

          {/* 3-Column Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Latest Activity */}
            <div className="lg:col-span-1">
              <ActivityFeed activities={activities} user={user} />
            </div>

            {/* Center Column: Latest Announcements */}
            <div className="lg:col-span-1">
              <AnnouncementsSection announcements={announcements} />
            </div>

            {/* Right Column: Upcoming Events */}
            <div className="lg:col-span-1">
              <EventsSection events={events} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
