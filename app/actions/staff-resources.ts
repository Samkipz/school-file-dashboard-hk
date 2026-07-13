'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { folders, files } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getRootFolders() {
  const userId = await getUserId()
  return db.select().from(folders).where(eq(folders.userId, userId)).orderBy(folders.name)
}

export async function createFolder(name: string) {
  const userId = await getUserId()
  const id = randomUUID()
  const now = new Date()
  const [folder] = await db
    .insert(folders)
    .values({
      id,
      userId,
      name: name.trim(),
      parentFolderId: null,
      description: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return folder
}

export async function getFilesInFolder(folderId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.folderId, folderId)))
    .orderBy(desc(files.createdAt))
}

export async function uploadFile(formData: FormData, folderId: string) {
  const userId = await getUserId()
  const file = formData.get('file') as File | null
  const rawFileName = (formData.get('fileName') as string) || file?.name || 'untitled'
  const fileName = rawFileName.replace(/\.[^/.]+$/, '')

  if (!file) throw new Error('No file provided')

  const id = randomUUID()
  const ext = file.name.split('.').pop()
  const storedName = `${id}-${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
  const dir = join(process.cwd(), 'public', 'uploads', userId)
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, storedName)
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  const blobUrl = `/uploads/${userId}/${storedName}`

  const now = new Date()
  const [inserted] = await db
    .insert(files)
    .values({
      id,
      userId,
      folderId,
      fileName: rawFileName,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      blobUrl,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return inserted
}

export async function renameFolder(folderId: string, name: string) {
  const userId = await getUserId()
  const [folder] = await db
    .update(folders)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning()
  return folder
}

export async function deleteFolder(folderId: string) {
  const userId = await getUserId()
  const folderFiles = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.folderId, folderId)))

  const fs = await import('fs/promises')
  for (const file of folderFiles) {
    const path = join(process.cwd(), 'public', file.blobUrl.replace(/^\//, ''))
    try {
      await fs.unlink(path)
    } catch {}
  }

  await db.delete(files).where(and(eq(files.userId, userId), eq(files.folderId, folderId)))
  await db.delete(folders).where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
  return { success: true }
}

export async function deleteFile(id: string) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')

  const fs = await import('fs/promises')
  const path = join(process.cwd(), 'public', file.blobUrl.replace(/^\//, ''))
  try {
    await fs.unlink(path)
  } catch {}

  await db.delete(files).where(eq(files.id, id))
  return { success: true }
}
