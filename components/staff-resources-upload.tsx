'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FolderPlus, Upload, X, FileText } from 'lucide-react'
import { uploadFile } from '@/app/actions/staff-resources'

type Folder = { id: string; name: string }

function getDefaultFileName(file: File) {
  return file.name.replace(/\.[^/.]+$/, '')
}

export function StaffResourcesUpload({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onUpload,
}: {
  isOpen: boolean
  onClose: () => void
  folders: Folder[]
  currentFolderId: string | null
  onUpload: (file?: {
    id: string
    filename: string
    originalName: string
    mimeType: string
    size: number
    uploadedBy: string
    uploadedAt: Date
    bucketPath: string
    folderId: string
  }) => void
}) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [fileNameEdited, setFileNameEdited] = React.useState(false)
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setFileName('')
      setFileNameEdited(false)
      setSelectedFolderId(currentFolderId || '')
      setError(null)
    }
  }, [isOpen, currentFolderId])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)

    if (file) {
      const defaultName = getDefaultFileName(file)
      if (!fileNameEdited) {
        setFileName(defaultName)
      }
    } else {
      setFileName('')
    }
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(event.target.value)
    setFileNameEdited(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFile) return

    const targetFolderId = selectedFolderId || currentFolderId
    if (!targetFolderId) {
      setError('Please select a folder')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('fileName', fileName.trim() || getDefaultFileName(selectedFile))
      const newFile = await uploadFile(formData, targetFolderId)
      onUpload(newFile)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Upload file</h2>
            <p className="text-sm text-muted-foreground">
              Select a file, choose a folder, and optionally rename it.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="staff-file">File</Label>
            <Input id="staff-file" type="file" onChange={handleFileChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-select">Folder</Label>
            <select
              id="folder-select"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">None (use current folder)</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-name">File name</Label>
            <Input
              id="file-name"
              type="text"
              placeholder="Enter file name"
              value={fileName}
              onChange={handleNameChange}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedFile || isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Save Upload'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
