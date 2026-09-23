import { learnerAssessments, schoolFiles } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' }
  try {
    const query = new URL(request.url).searchParams, school = query.get('school') ?? ''
    const data = await learnerAssessments.get(school, query.get('assessment') ?? '', query.get('learner') ?? '')
    const id = (await params).id
    const association = data.evidence.find(e => e.id === id && e.available)
    if (!association) throw new DomainError('NOT_FOUND')
    const file = await schoolFiles.download(school, association.asset_id)
    return new Response(new Uint8Array(file.bytes), { headers: { ...headers, 'Content-Type': file.mimeType, 'Content-Disposition': `attachment; filename="${file.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"` } })
  } catch (error) {
    const status = error instanceof DomainError ? ({ UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_INPUT: 400, CONFLICT: 409 })[error.code] : 503
    return new Response('Evidence unavailable', { status, headers })
  }
}
