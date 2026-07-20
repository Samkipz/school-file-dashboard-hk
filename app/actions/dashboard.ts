'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'
import { desc, eq, gte } from 'drizzle-orm'
import { headers } from 'next/headers'
import { getEvents } from './calendar'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getUpcomingEvents(limit = 5) {
  const userId = await getUserId()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const allEvents = await getEvents(year, month)
  return allEvents
    .filter((e) => new Date(e.eventDate) >= now)
    .slice(0, limit)
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

export async function getUserInfo() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user || null
}
