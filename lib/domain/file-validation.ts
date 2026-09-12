import { DomainError } from './foundation.ts'
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const categories = ['general', 'work', 'certificate', 'photo', 'video'] as const
export function metadata(title: unknown, description: unknown, category: unknown) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 160 || /[\x00-\x1f\x7f]/.test(title) ||
      typeof description !== 'string' || description.length > 1000 || typeof category !== 'string' || !categories.some(c => c === category)) throw new DomainError('INVALID_INPUT')
  return { title: title.trim(), description: description.trim(), category }
}
export async function validateUpload(form: FormData, media: boolean) {
  if (!(form instanceof FormData)) throw new DomainError('INVALID_INPUT')
  const file = form.get('file')
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_SIZE) throw new DomainError('INVALID_INPUT')
  const originalName = file.name.split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-160)
  const ext = originalName.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4' }
  if (!ext || !types[ext] || types[ext] !== file.type || (media && ext === 'pdf')) throw new DomainError('INVALID_INPUT')
  const bytes = Buffer.from(await file.arrayBuffer())
  const valid = ext === 'pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' :
    ext === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    ext === 'jpg' || ext === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    ext === 'webp' ? bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' :
    bytes.subarray(4,8).toString() === 'ftyp' && ['isom','iso2','mp41','mp42','avc1','M4V '].includes(bytes.subarray(8,12).toString())
  if (!valid) throw new DomainError('INVALID_INPUT')
  return { ...metadata(form.get('title') || originalName, form.get('description') || '', form.get('category') || 'general'), originalName, mimeType: file.type, size: bytes.length, ext, bytes }
}

