'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, FileImage, Loader2 } from 'lucide-react'
import { bulkUploadMedia } from '@/app/actions/media-files'

type Folder = { id: string; name: string; description: string | null }

function isMedia(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export function MediaFilesUpload({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onUploaded,
}: {
  isOpen: boolean
  onClose: () => void
  folders: Folder[]
  currentFolderId: string | null
  onUploaded: () => void
}) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>('')
  const [description, setDescription] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFiles([])
      setSelectedFolderId(currentFolderId || '')
      setDescription('')
      setProgress(null)
      setError(null)
    }
  }, [isOpen, currentFolderId])

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    setSelectedFiles(picked)
    setError(null)
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const targetFolderId = selectedFolderId || currentFolderId
    if (!targetFolderId) {
      setError('Please select a folder')
      return
    }
    if (selectedFiles.length === 0) {
      setError('Please choose at least one file')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setProgress({ done: 0, total: selectedFiles.length })

    try {
      const nonMedia = selectedFiles.filter((f) => !isMedia(f))
      if (nonMedia.length > 0) {
        setError('Only image and video files are supported in Media Files')
        setIsSubmitting(false)
        setProgress(null)
        return
      }

      await bulkUploadMedia(selectedFiles, targetFolderId, description.trim() || undefined)
      onUploaded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsSubmitting(false)
      setProgress(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Upload media</h2>
            <p className="text-sm text-muted-foreground">
              Add images or videos to a folder. Select one or many at once.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="media-folder">Folder</Label>
            <select
              id="media-folder"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{currentFolderId ? 'Current folder' : 'Select a folder'}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="media-description">Description (optional)</Label>
            <Input
              id="media-description"
              type="text"
              placeholder="e.g. Geography Trip 2026 highlights"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="media-files">Files</Label>
            <Input
              id="media-files"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFilesChange}
              disabled={isSubmitting}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto rounded-lg border border-border p-3">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 rounded-md bg-surface p-2"
                >
                  {isMedia(file) ? (
                    <FileImage className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <FileImage className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(Number(file.size) / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Uploading {progress.done}/{progress.total}...
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || selectedFiles.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : ''}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
