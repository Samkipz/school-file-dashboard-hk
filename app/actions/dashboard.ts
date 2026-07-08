'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { announcements, events, activityLogs } from '@/lib/db/schema'
import { desc, eq, gte } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getLatestActivities(limit = 10) {
  const userId = await getUserId()
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
}

export async function getLatestAnnouncements(limit = 5) {
  const userId = await getUserId()
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.userId, userId))
    .orderBy(desc(announcements.createdAt))
    .limit(limit)
}

export async function getUpcomingEvents(limit = 5) {
  const userId = await getUserId()
  const now = new Date()
  return db
    .select()
    .from(events)
    .where(gte(events.eventDate, now))
    .orderBy(events.eventDate)
    .limit(limit)
}

export async function getUserInfo() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user || null
}
