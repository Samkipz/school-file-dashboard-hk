'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { folders, files } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { logActivity, ActionType } from '@/lib/activity'

const SECTION = 'staff'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getRootFolders() {
  return db.select().from(folders).where(eq(folders.section, SECTION)).orderBy(folders.name)
}

export async function createFolder(name: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const id = randomUUID()
  const now = new Date()
  const [folder] = await db
    .insert(folders)
    .values({
      id,
      userId: session.user.id,
      name: name.trim(),
      parentFolderId: null,
      description: null,
      section: SECTION,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  await logActivity({
    actionType: ActionType.STAFF_FOLDER_CREATE,
    description: `Created staff folder "${name.trim()}"`,
    targetId: folder.id,
    targetType: 'staffFolder',
  })
  return folder
}

export async function renameFolder(folderId: string, name: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [folder] = await db
    .update(folders)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(folders.id, folderId))
    .returning()
  await logActivity({
    actionType: ActionType.STAFF_FOLDER_RENAME,
    description: `Renamed staff folder to "${name.trim()}"`,
    targetId: folder.id,
    targetType: 'staffFolder',
  })
  return folder
}

export async function deleteFolder(folderId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.section, SECTION)))
  if (!folder) throw new Error('Folder not found')

  const folderFiles = await db
    .select()
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.section, SECTION)))
  for (const file of folderFiles) {
    try {
      await deleteFromR2(file.bucketPath)
    } catch {}
  }

  await db
    .delete(files)
    .where(and(eq(files.folderId, folderId), eq(files.section, SECTION)))
  await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.section, SECTION)))
  await logActivity({
    actionType: ActionType.STAFF_FOLDER_DELETE,
    description: `Deleted staff folder "${folder.name}"`,
    targetId: folderId,
    targetType: 'staffFolder',
  })
  return { success: true }
}

export async function getFilesInFolder(folderId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.section, SECTION)))
    .orderBy(desc(files.uploadedAt))
}

export async function uploadFile(formData: FormData, folderId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const file = formData.get('file') as File | null
  const rawFileName = (formData.get('fileName') as string) || file?.name || 'untitled'
  const fileName = rawFileName.replace(/\.[^/.]+$/, '')

  if (!file) throw new Error('No file provided')

  const id = randomUUID()
  const ext = file.name.split('.').pop()
  const storedFilename = `${id}-${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
  const bucketPath = `uploads/${storedFilename}`
  const bytes = Buffer.from(await file.arrayBuffer())

  await uploadToR2(bucketPath, bytes, file.type || 'application/octet-stream')

  const [inserted] = await db
    .insert(files)
    .values({
      id,
      filename: storedFilename,
      originalName: rawFileName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: session.user.id,
      bucketPath,
      folderId,
      section: SECTION,
    })
    .returning()

  await logActivity({
    actionType: ActionType.STAFF_FILE_UPLOAD,
    description: `Uploaded staff file "${rawFileName}"`,
    targetId: inserted.id,
    targetType: 'staffFile',
  })

  return inserted
}

export async function deleteFile(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.section, SECTION)))
  if (!file) throw new Error('File not found')

  try {
    await deleteFromR2(file.bucketPath)
  } catch {}

  await db.delete(files).where(and(eq(files.id, id), eq(files.section, SECTION)))
  await logActivity({
    actionType: ActionType.STAFF_FILE_DELETE,
    description: `Deleted staff file "${file.originalName}"`,
    targetId: id,
    targetType: 'staffFile',
  })
  return { success: true }
}

export async function getFileUrl(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.section, SECTION)))
  if (!file) throw new Error('File not found')

  const { getR2PresignedUrl } = await import('@/lib/r2')
  return getR2PresignedUrl(file.bucketPath, 3600)
}
