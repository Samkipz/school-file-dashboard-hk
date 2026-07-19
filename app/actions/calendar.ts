'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { eq, gte, lte, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { logActivity, ActionType } from '@/lib/activity'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getEvents(year: number, month: number) {
  const userId = await getUserId()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        gte(events.eventDate, start),
        lte(events.eventDate, end),
      ),
    )
    .orderBy(events.eventDate)
}

export async function getUpcomingEvents(limit = 5) {
  const userId = await getUserId()
  const now = new Date()
  return db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.eventDate, now)))
    .orderBy(events.eventDate)
    .limit(limit)
}

export async function createEvent(data: {
  title: string
  description?: string
  eventDate: Date
  location?: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const id = randomUUID()
  const now = new Date()
  const [event] = await db
    .insert(events)
    .values({
      id,
      userId: session.user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      eventDate: data.eventDate,
      location: data.location?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  await logActivity({
    actionType: ActionType.EVENT_CREATE,
    description: `Created event "${data.title.trim()}"`,
    targetId: event.id,
    targetType: 'event',
  })
  return event
}

export async function updateEvent(
  id: string,
  data: {
    title?: string
    description?: string
    eventDate?: Date
    location?: string
  },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [event] = await db
    .update(events)
    .set({
      ...data,
      title: data.title?.trim() || undefined,
      description: data.description?.trim() || undefined,
      location: data.location?.trim() || undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, id), eq(events.userId, session.user.id)))
    .returning()
  await logActivity({
    actionType: ActionType.EVENT_UPDATE,
    description: `Updated event "${event.title}"`,
    targetId: event.id,
    targetType: 'event',
  })
  return event
}

export async function deleteEvent(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, session.user.id)))
  if (!event) throw new Error('Event not found')
  await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.userId, session.user.id)))
  await logActivity({
    actionType: ActionType.EVENT_DELETE,
    description: `Deleted event "${event.title}"`,
    targetId: event.id,
    targetType: 'event',
  })
  return { success: true }
}
