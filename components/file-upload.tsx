'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X } from 'lucide-react'
import { uploadPortfolioFile } from '@/app/actions/portfolios'
import { uploadMediaFile } from '@/app/actions/media-files'
import type { FileTarget } from '@/lib/domain/files'
export function FileUpload({ school, target, onClose, onUploaded }: { school: string; target: FileTarget; onClose: () => void; onUploaded: () => Promise<void> }) {
  const [busy,setBusy] = React.useState(false), [error,setError] = React.useState('')
  const media = 'folderId' in target
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="upload-heading">
    <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between mb-5"><h2 id="upload-heading" className="text-2xl font-semibold">Upload {media ? 'media' : 'portfolio file'}</h2><Button aria-label="Close upload" variant="ghost" disabled={busy} onClick={onClose}><X /></Button></div>
      <p className="text-sm text-muted-foreground mb-4">{media ? 'JPEG, PNG, WebP or MP4' : 'PDF, JPEG, PNG, WebP or MP4'}. Maximum 10 MB per file. Files are private to authorized school users.</p>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); const form = new FormData(e.currentTarget); const entries = form.getAll('file'); setBusy(true);setError('')
        let completed = 0
        try {
          for (const file of entries) {
            const single = new FormData(); single.set('file',file); for (const key of ['title','description','category']) single.set(key,form.get(key) ?? '')
            if ('learnerId' in target) await uploadPortfolioFile(school,target.learnerId,single)
            else await uploadMediaFile(school,target.folderId,single)
            completed++
          }
          await onUploaded();onClose()
        } catch { if (completed) await onUploaded();setError(`${completed ? `${completed} file(s) uploaded. ` : ''}Upload failed. Check the type, size and your access before trying remaining files again.`) }
        finally {setBusy(false)}
      }}>
        <Label htmlFor="upload-file">File{media ? 's' : ''}</Label><Input id="upload-file" name="file" type="file" required multiple={media} disabled={busy} accept={media ? '.jpg,.jpeg,.png,.webp,.mp4' : '.pdf,.jpg,.jpeg,.png,.webp,.mp4'} />
        <Label htmlFor="upload-title">Title (optional; defaults to filename)</Label><Input id="upload-title" name="title" maxLength={160} disabled={busy}/>
        <Label htmlFor="upload-description">Description</Label><Input id="upload-description" name="description" maxLength={1000} disabled={busy}/>
        <Label htmlFor="upload-category">Category</Label><select id="upload-category" name="category" className="w-full border rounded-md bg-background p-2" disabled={busy}>{['general','work','certificate','photo','video'].map(c=><option key={c}>{c}</option>)}</select>
        {error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy} className="gap-2"><Upload className="w-4 h-4"/>{busy ? 'Uploading…' : 'Upload'}</Button>
      </form>
    </div>
  </div>
}
