import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

export const ActionType = {
  STUDENT_CREATE: 'student_create',
  STUDENT_UPDATE: 'student_update',
  STUDENT_DELETE: 'student_delete',
  PORTFOLIO_FILE_UPLOAD: 'portfolio_file_upload',
  PORTFOLIO_FILE_DELETE: 'portfolio_file_delete',
  MEDIA_FOLDER_CREATE: 'media_folder_create',
  MEDIA_FOLDER_UPDATE: 'media_folder_update',
  MEDIA_FOLDER_DELETE: 'media_folder_delete',
  MEDIA_UPLOAD: 'media_upload',
  MEDIA_DELETE: 'media_delete',
  STAFF_FOLDER_CREATE: 'staff_folder_create',
  STAFF_FOLDER_RENAME: 'staff_folder_rename',
  STAFF_FOLDER_DELETE: 'staff_folder_delete',
  STAFF_FILE_UPLOAD: 'staff_file_upload',
  STAFF_FILE_DELETE: 'staff_file_delete',
  EVENT_CREATE: 'event_create',
  EVENT_UPDATE: 'event_update',
  EVENT_DELETE: 'event_delete',
  ANNOUNCEMENT_CREATE: 'announcement_create',
  ANNOUNCEMENT_UPDATE: 'announcement_update',
  ANNOUNCEMENT_DELETE: 'announcement_delete',
} as const

export type ActionType = typeof ActionType[keyof typeof ActionType]

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function logActivity(params: {
  actionType: ActionType
  description: string
  targetId?: string
  targetType?: string
}) {
  const userId = await getUserId()
  await db.insert(activityLogs).values({
    id: randomUUID(),
    userId,
    actionType: params.actionType,
    description: params.description,
    targetId: params.targetId || null,
    targetType: params.targetType || null,
  })
}
