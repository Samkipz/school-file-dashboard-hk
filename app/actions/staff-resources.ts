'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { folders, files } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getRootFolders() {
  return db.select().from(folders).orderBy(folders.name)
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
      createdAt: now,
      updatedAt: now,
    })
    .returning()
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
  return folder
}

export async function deleteFolder(folderId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  
  const folderFiles = await db.select().from(files).where(eq(files.folderId, folderId))
  for (const file of folderFiles) {
    try {
      await deleteFromR2(file.bucketPath)
    } catch {}
  }

  await db.delete(files).where(eq(files.folderId, folderId))
  await db.delete(folders).where(eq(folders.id, folderId))
  return { success: true }
}

export async function getFilesInFolder(folderId: string) {
  return db
    .select()
    .from(files)
    .where(eq(files.folderId, folderId))
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
    })
    .returning()

  return inserted
}

export async function deleteFile(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [file] = await db.select().from(files).where(eq(files.id, id))
  if (!file) throw new Error('File not found')

  try {
    await deleteFromR2(file.bucketPath)
  } catch {}

  await db.delete(files).where(eq(files.id, id))
  return { success: true }
}

export async function getFileUrl(id: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [file] = await db.select().from(files).where(eq(files.id, id))
  if (!file) throw new Error('File not found')

  const { getR2PresignedUrl } = await import('@/lib/r2')
  return getR2PresignedUrl(file.bucketPath, 3600)
}
