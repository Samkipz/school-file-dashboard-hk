import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { files } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getR2Object, r2StreamToWeb } from '@/lib/r2'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.section, 'media')))

  if (!file) {
    return new Response('Not found', { status: 404 })
  }

  let object
  try {
    object = await getR2Object(file.bucketPath)
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const body = r2StreamToWeb(object.Body)
  const contentType = object.ContentType || file.mimeType

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
