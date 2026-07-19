'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { folders, files } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { logActivity, ActionType } from '@/lib/activity'

const MEDIA_PREFIX = 'media'
const SECTION = 'media'

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

export async function getMediaFolders() {
  return db
    .select()
    .from(folders)
    .where(eq(folders.section, SECTION))
    .orderBy(folders.name)
}

export async function createMediaFolder(name: string, description?: string) {
  const user = await requireUser()
  const id = randomUUID()
  const now = new Date()
  const [folder] = await db
    .insert(folders)
    .values({
      id,
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      parentFolderId: null,
      section: SECTION,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  await logActivity({
    actionType: ActionType.MEDIA_FOLDER_CREATE,
    description: `Created media folder "${name.trim()}"`,
    targetId: folder.id,
    targetType: 'mediaFolder',
  })
  return folder
}

export async function updateMediaFolder(
  folderId: string,
  name: string,
  description?: string
) {
  await requireUser()
  const [folder] = await db
    .update(folders)
    .set({ name: name.trim(), description: description?.trim() || null, updatedAt: new Date() })
    .where(and(eq(folders.id, folderId), eq(folders.section, SECTION)))
    .returning()
  await logActivity({
    actionType: ActionType.MEDIA_FOLDER_UPDATE,
    description: `Renamed media folder to "${name.trim()}"`,
    targetId: folder.id,
    targetType: 'mediaFolder',
  })
  return folder
}

export async function deleteMediaFolder(folderId: string) {
  await requireUser()
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.section, SECTION)))
  const folderName = folder?.name || 'Unknown'

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
    actionType: ActionType.MEDIA_FOLDER_DELETE,
    description: `Deleted media folder "${folderName}"`,
    targetId: folderId,
    targetType: 'mediaFolder',
  })
  return { success: true }
}

export async function getMediaFiles(folderId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.section, SECTION)))
    .orderBy(desc(files.uploadedAt))
}

type UploadedFile = typeof files.$inferSelect

async function storeFile(
  file: File,
  folderId: string,
  uploadedBy: string,
  baseName?: string
): Promise<UploadedFile> {
  const rawFileName = baseName || file.name || 'untitled'
  const id = randomUUID()
  const ext = file.name.split('.').pop() || 'bin'
  const safeName = rawFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const storedFilename = `${id}-${safeName}.${ext}`
  const bucketPath = `${MEDIA_PREFIX}/${storedFilename}`
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
      uploadedBy,
      bucketPath,
      folderId,
      section: SECTION,
    })
    .returning()

  return inserted
}

export async function uploadMediaFile(
  formData: FormData,
  folderId: string,
  description?: string
) {
  const user = await requireUser()
  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')
  const baseName = (formData.get('fileName') as string) || undefined
  return storeFile(file, folderId, user.id, baseName)
}

export async function bulkUploadMediaForm(formData: FormData) {
  const user = await requireUser()
  const folderId = (formData.get('folderId') as string) || ''
  if (!folderId) throw new Error('No folder selected')
  const fileEntries = formData.getAll('files')
  if (fileEntries.length === 0) throw new Error('No files provided')

  const inserted: UploadedFile[] = []
  for (const entry of fileEntries) {
    if (entry instanceof File) {
      inserted.push(await storeFile(entry, folderId, user.id))
    }
  }

  if (inserted.length > 0) {
    await logActivity({
      actionType: ActionType.MEDIA_UPLOAD,
      description: `Uploaded ${inserted.length} media file${inserted.length > 1 ? 's' : ''}`,
      targetId: folderId,
      targetType: 'mediaFolder',
    })
  }

  return inserted
}

export async function deleteMediaFile(id: string) {
  await requireUser()
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
    actionType: ActionType.MEDIA_DELETE,
    description: `Deleted media file "${file.originalName}"`,
    targetId: id,
    targetType: 'mediaFile',
  })
  return { success: true }
}

export async function getMediaFileUrl(id: string) {
  await requireUser()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.section, SECTION)))
  if (!file) throw new Error('File not found')
  const { getR2PresignedUrl } = await import('@/lib/r2')
  return getR2PresignedUrl(file.bucketPath, 3600)
}

export async function getMediaFileMeta(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.section, SECTION)))
  if (!file) throw new Error('File not found')
  return { id: file.id, originalName: file.originalName, mimeType: file.mimeType }
}
