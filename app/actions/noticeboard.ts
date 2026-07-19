'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { announcements } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { logActivity, ActionType } from '@/lib/activity'

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

export async function getLatestAnnouncements(limit = 50) {
  const user = await requireUser()
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.userId, user.id))
    .orderBy(desc(announcements.createdAt))
    .limit(limit)
}

export async function createAnnouncement(title: string, content: string, category = 'general') {
  const user = await requireUser()
  const id = randomUUID()
  const now = new Date()
  const [announcement] = await db
    .insert(announcements)
    .values({
      id,
      userId: user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  await logActivity({
    actionType: ActionType.ANNOUNCEMENT_CREATE,
    description: `Posted announcement "${title.trim()}"`,
    targetId: announcement.id,
    targetType: 'announcement',
  })
  return announcement
}

export async function updateAnnouncement(id: string, title: string, content: string, category: string) {
  const user = await requireUser()
  const [announcement] = await db
    .update(announcements)
    .set({ title: title.trim(), content: content.trim(), category, updatedAt: new Date() })
    .where(and(eq(announcements.id, id), eq(announcements.userId, user.id)))
    .returning()
  await logActivity({
    actionType: ActionType.ANNOUNCEMENT_UPDATE,
    description: `Updated announcement "${title.trim()}"`,
    targetId: announcement.id,
    targetType: 'announcement',
  })
  return announcement
}

export async function deleteAnnouncement(id: string) {
  const user = await requireUser()
  const [announcement] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.userId, user.id)))
  if (!announcement) throw new Error('Announcement not found')
  await db.delete(announcements).where(and(eq(announcements.id, id), eq(announcements.userId, user.id)))
  await logActivity({
    actionType: ActionType.ANNOUNCEMENT_DELETE,
    description: `Deleted announcement "${announcement.title}"`,
    targetId: id,
    targetType: 'announcement',
  })
  return { success: true }
}
