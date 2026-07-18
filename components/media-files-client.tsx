'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  FolderPlus,
  Upload,
  X,
  FolderOpen,
  ArrowLeft,
  Trash2,
  Pencil,
  FileImage,
  PlayCircle,
  Loader2,
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Toaster, useToast } from '@/components/ui/toast'
import { MediaFilesUpload } from '@/components/media-files-upload'
import {
  getMediaFolders,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  getMediaFiles,
  deleteMediaFile,
  getMediaFileUrl,
} from '@/app/actions/media-files'

type Folder = { id: string; name: string; description: string | null }
type MediaFile = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedAt: Date
  bucketPath: string
  folderId: string
}

const isImage = (mime: string) => mime.startsWith('image/')
const isVideo = (mime: string) => mime.startsWith('video/')

export function MediaFilesClient({ initialFolders }: { initialFolders: Folder[] }) {
  const [folders, setFolders] = React.useState<Folder[]>(initialFolders)
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = React.useState<Folder | null>(null)
  const [files, setFiles] = React.useState<MediaFile[]>([])
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({})

  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState('')
  const [newFolderDesc, setNewFolderDesc] = React.useState('')

  const [editingFolderId, setEditingFolderId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editDesc, setEditDesc] = React.useState('')

  const [deletingFolderId, setDeletingFolderId] = React.useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = React.useState<string | null>(null)

  const { toasts, addToast } = useToast()

  const loadFiles = React.useCallback(async (folderId: string) => {
    const result = await getMediaFiles(folderId)
    setFiles(result as MediaFile[])
    const urls: Record<string, string> = {}
    await Promise.all(
      (result as MediaFile[]).map(async (f) => {
        try {
          urls[f.id] = await getMediaFileUrl(f.id)
        } catch {}
      })
    )
    setThumbUrls(urls)
  }, [])

  const openFolder = async (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setCurrentFolder(folder)
    await loadFiles(folder.id)
  }

  const handleBack = () => {
    setCurrentFolderId(null)
    setCurrentFolder(null)
    setFiles([])
    setThumbUrls({})
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const folder = await createMediaFolder(newFolderName.trim(), newFolderDesc.trim())
      setFolders((prev) => [...prev, folder])
      setNewFolderName('')
      setNewFolderDesc('')
      setIsCreatingFolder(false)
      addToast('Folder created', 'success')
    } catch {
      addToast('Failed to create folder', 'error')
    }
  }

  const startEdit = (folder: Folder) => {
    setEditingFolderId(folder.id)
    setEditName(folder.name)
    setEditDesc(folder.description || '')
  }

  const handleEdit = async () => {
    if (!editingFolderId || !editName.trim()) return
    try {
      const updated = await updateMediaFolder(editingFolderId, editName.trim(), editDesc.trim())
      setFolders((prev) => prev.map((f) => (f.id === editingFolderId ? updated : f)))
      if (currentFolderId === editingFolderId) {
        setCurrentFolder(updated)
      }
      setEditingFolderId(null)
      setEditName('')
      setEditDesc('')
      addToast('Folder updated', 'success')
    } catch {
      addToast('Failed to update folder', 'error')
    }
  }

  const confirmDeleteFolder = async () => {
    if (!deletingFolderId) return
    try {
      await deleteMediaFolder(deletingFolderId)
      setFolders((prev) => prev.filter((f) => f.id !== deletingFolderId))
      if (currentFolderId === deletingFolderId) {
        handleBack()
      }
      setDeletingFolderId(null)
      addToast('Folder deleted', 'success')
    } catch {
      addToast('Failed to delete folder', 'error')
    }
  }

  const confirmDeleteFile = async () => {
    if (!deletingFileId) return
    try {
      await deleteMediaFile(deletingFileId)
      setFiles((prev) => prev.filter((f) => f.id !== deletingFileId))
      setDeletingFileId(null)
      addToast('Media deleted', 'success')
    } catch {
      addToast('Failed to delete media', 'error')
    }
  }

  const handleUploaded = () => {
    setIsUploadOpen(false)
    if (currentFolderId) {
      loadFiles(currentFolderId)
      addToast('Media uploaded', 'success')
    }
  }

  const handleOpenFile = async (file: MediaFile) => {
    try {
      const url = await getMediaFileUrl(file.id)
      window.open(url, '_blank')
    } catch {
      addToast('Failed to open file', 'error')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {currentFolderId && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {currentFolder ? currentFolder.name : 'Media Files'}
            </h2>
            {currentFolder?.description && (
              <p className="text-sm text-muted-foreground">{currentFolder.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {!currentFolderId && (
            <Button className="gap-2" onClick={() => setIsCreatingFolder(true)}>
              <FolderPlus className="w-4 h-4" />
              New Folder
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setIsUploadOpen(true)}>
            <Upload className="w-4 h-4" />
            Upload Media
          </Button>
        </div>
      </div>

      {isCreatingFolder && !currentFolderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">New Folder</h2>
                <p className="text-sm text-muted-foreground">
                  Create a folder to organize school media, e.g. Geography Trip.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsCreatingFolder(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="media-folder-name">Folder name</Label>
                <Input
                  id="media-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Geography Trip"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-folder-desc">Description (optional)</Label>
                <Textarea
                  id="media-folder-desc"
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="Short description of this media collection"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreatingFolder(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFolder}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingFolderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Edit Folder</h2>
                <p className="text-sm text-muted-foreground">Update folder details.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingFolderId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="media-edit-name">Folder name</Label>
                <Input
                  id="media-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-edit-desc">Description (optional)</Label>
                <Textarea
                  id="media-edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingFolderId(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 sm:p-8 bg-card border-border">
        {currentFolderId ? (
          files.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <FileImage className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No media yet</p>
              <p className="text-sm">Upload images or videos to this folder</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((file) => {
                const url = thumbUrls[file.id]
                const video = isVideo(file.mimeType)
                const image = isImage(file.mimeType)
                return (
                  <div
                    key={file.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <button
                      onClick={() => handleOpenFile(file)}
                      className="block w-full aspect-square overflow-hidden bg-background/50"
                    >
                      {url && image ? (
                        <img
                          src={url}
                          alt={file.originalName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : url && video ? (
                        <video
                          src={url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {video && (
                        <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white/90 drop-shadow" />
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {file.originalName}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => setDeletingFileId(file.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : folders.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">No folders yet</p>
            <p className="text-sm">Create a folder to start adding media</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-6 hover:border-primary/50 transition-colors"
              >
                {editingFolderId === folder.id ? (
                  <div className="w-full space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-center"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEdit()
                        if (e.key === 'Escape') setEditingFolderId(null)
                      }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={handleEdit}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setEditingFolderId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => openFolder(folder)}
                      className="flex flex-1 flex-col items-center justify-center gap-3 w-full"
                    >
                      <FolderOpen className="w-10 h-10 text-primary" />
                      <span className="font-medium text-foreground text-center break-all">
                        {folder.name}
                      </span>
                      {folder.description && (
                        <span className="text-xs text-muted-foreground text-center line-clamp-2">
                          {folder.description}
                        </span>
                      )}
                    </button>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(folder)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingFolderId(folder.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <MediaFilesUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        folders={folders}
        currentFolderId={currentFolderId}
        onUploaded={handleUploaded}
      />

      <ConfirmModal
        isOpen={!!deletingFolderId}
        title="Delete folder?"
        description="This will permanently remove this folder and all media inside it. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeletingFolderId(null)}
      />

      <ConfirmModal
        isOpen={!!deletingFileId}
        title="Delete media?"
        description="This will permanently remove this file. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteFile}
        onCancel={() => setDeletingFileId(null)}
      />

      <Toaster toasts={toasts} />
    </div>
  )
}
