import { schoolFiles } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' }
  try {
    const url = new URL(request.url)
    const file = await schoolFiles.download(url.searchParams.get('school') ?? '', (await params).id)
    const inline = url.searchParams.get('view') === '1' && /^(image\/(png|jpeg|webp)|video\/mp4)$/.test(file.mimeType)
    return new Response(new Uint8Array(file.bytes), { headers: { ...headers, 'Content-Type': file.mimeType, 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${file.name.replace(/[^a-zA-Z0-9._ -]/g,'_')}"` } })
  } catch (error) {
    const status = error instanceof DomainError ? ({ UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_INPUT: 400, CONFLICT: 409 })[error.code] : 503
    if (!(error instanceof DomainError)) console.error('Private file download failed')
    return new Response('File unavailable', { status, headers })
  }
}
