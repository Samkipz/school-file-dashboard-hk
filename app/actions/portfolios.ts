'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { students, portfolioFiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export async function getStudents() {
  const session = await requireSession()
  return db
    .select()
    .from(students)
    .orderBy(students.className, students.name)
}

export async function createStudent(name: string, className: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const id = randomUUID()
  const now = new Date()
  const [student] = await db
    .insert(students)
    .values({
      id,
      userId: session.user.id,
      name: name.trim(),
      className: className.trim(),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return student
}

export async function updateStudent(id: string, name: string, className: string) {
  const session = await requireSession()
  const [student] = await db
    .update(students)
    .set({ name: name.trim(), className: className.trim(), updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()
  return student
}

export async function deleteStudent(id: string) {
  const session = await requireSession()

  const studentFiles = await db
    .select()
    .from(portfolioFiles)
    .where(eq(portfolioFiles.studentId, id))
  for (const file of studentFiles) {
    try {
      await deleteFromR2(file.bucketPath)
    } catch {}
  }

  await db.delete(portfolioFiles).where(eq(portfolioFiles.studentId, id))
  await db.delete(students).where(eq(students.id, id))
  return { success: true }
}

export async function getPortfolioFiles(studentId: string) {
  const session = await requireSession()
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
  if (!student) throw new Error('Student not found')

  return db
    .select()
    .from(portfolioFiles)
    .where(eq(portfolioFiles.studentId, studentId))
    .orderBy(desc(portfolioFiles.uploadedAt))
}

export async function uploadPortfolioFile(formData: FormData, studentId: string) {
  const session = await requireSession()

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
  if (!student) throw new Error('Student not found')

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
    .insert(portfolioFiles)
    .values({
      id,
      filename: storedFilename,
      originalName: rawFileName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: session.user.id,
      bucketPath,
      studentId,
    })
    .returning()

  return inserted
}

export async function deletePortfolioFile(id: string) {
  const session = await requireSession()
  const [file] = await db.select().from(portfolioFiles).where(eq(portfolioFiles.id, id))
  if (!file) throw new Error('File not found')

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, file.studentId))
  if (!student) throw new Error('Student not found')

  try {
    await deleteFromR2(file.bucketPath)
  } catch {}

  await db.delete(portfolioFiles).where(eq(portfolioFiles.id, id))
  return { success: true }
}

export async function getPortfolioFileUrl(id: string) {
  const session = await requireSession()
  const [file] = await db.select().from(portfolioFiles).where(eq(portfolioFiles.id, id))
  if (!file) throw new Error('File not found')

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, file.studentId))
  if (!student) throw new Error('Student not found')

  const { getR2PresignedUrl } = await import('@/lib/r2')
  return getR2PresignedUrl(file.bucketPath, 3600)
}
