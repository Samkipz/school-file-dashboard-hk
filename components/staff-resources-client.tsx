'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FolderPlus, Upload, X, FileText, FolderOpen, ArrowLeft, Trash2, Pencil } from 'lucide-react'
import { StaffResourcesUpload } from '@/components/staff-resources-upload'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Toaster, useToast } from '@/components/ui/toast'
import {
  createFolder,
  getFilesInFolder,
  deleteFile,
  renameFolder,
  deleteFolder,
} from '@/app/actions/staff-resources'

type Folder = { id: string; name: string }
type FileRecord = {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  blobUrl: string
  createdAt: Date
}

export function StaffResourcesClient({ initialFolders }: { initialFolders: Folder[] }) {
  const [folders, setFolders] = React.useState<Folder[]>(initialFolders)
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = React.useState<Folder | null>(null)
  const [files, setFiles] = React.useState<FileRecord[]>([])
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState('')
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [deletingFolderId, setDeletingFolderId] = React.useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = React.useState<string | null>(null)
  const { toasts, addToast } = useToast()

  const loadFiles = React.useCallback(async (folderId: string) => {
    const result = await getFilesInFolder(folderId)
    setFiles(result as FileRecord[])
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
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const folder = await createFolder(newFolderName.trim())
      setFolders((prev) => [...prev, folder])
      setNewFolderName('')
      setIsCreatingFolder(false)
      addToast('Folder created', 'success')
    } catch {
      addToast('Failed to create folder', 'error')
    }
  }

  const startRename = (folder: Folder) => {
    setRenamingId(folder.id)
    setRenameValue(folder.name)
  }

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) return
    try {
      const updated = await renameFolder(renamingId, renameValue.trim())
      setFolders((prev) => prev.map((f) => (f.id === renamingId ? updated : f)))
      if (currentFolderId === renamingId) {
        setCurrentFolder(updated)
      }
      setRenamingId(null)
      setRenameValue('')
      addToast('Folder renamed', 'success')
    } catch {
      addToast('Failed to rename folder', 'error')
    }
  }

  const confirmDeleteFolder = async () => {
    if (!deletingFolderId) return
    try {
      await deleteFolder(deletingFolderId)
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
      await deleteFile(deletingFileId)
      setFiles((prev) => prev.filter((f) => f.id !== deletingFileId))
      setDeletingFileId(null)
      addToast('File deleted', 'success')
    } catch {
      addToast('Failed to delete file', 'error')
    }
  }

  const handleUploadComplete = (newFile?: FileRecord) => {
    setIsUploadOpen(false)
    if (currentFolderId && newFile) {
      setFiles((prev) => [...prev, newFile])
      addToast('File uploaded', 'success')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {currentFolderId && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {currentFolder ? currentFolder.name : 'Staff Resources'}
          </h2>
        </div>
        <div className="flex gap-3">
          {!currentFolderId && (
            <Button className="gap-2" onClick={() => setIsCreatingFolder(true)}>
              <FolderPlus className="w-4 h-4" />
              New Folder
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setIsUploadOpen(true)}>
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
        </div>
      </div>

      {isCreatingFolder && !currentFolderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">New Folder</h2>
                <p className="text-sm text-muted-foreground">Create a new folder to organize your files.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsCreatingFolder(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
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

      <Card className="p-12 bg-card border-border">
        {currentFolderId ? (
          files.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No files yet</p>
              <p className="text-sm">Upload files to this folder</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.fileType} · {(Number(file.fileSize) / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.blobUrl, '_blank')}
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingFileId(file.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          folders.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No folders yet</p>
              <p className="text-sm">Create a new folder to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-6 hover:border-primary/50 transition-colors"
                >
                  {renamingId === folder.id ? (
                    <div className="w-full space-y-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="text-center"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename()
                          if (e.key === 'Escape') {
                            setRenamingId(null)
                            setRenameValue('')
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={handleRename}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          onClick={() => {
                            setRenamingId(null)
                            setRenameValue('')
                          }}
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
                      </button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startRename(folder)}
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
          )
        )}
      </Card>

      <StaffResourcesUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        folders={folders}
        currentFolderId={currentFolderId}
        onUpload={handleUploadComplete}
      />

      <ConfirmModal
        isOpen={!!deletingFolderId}
        title="Delete folder?"
        description="This will permanently remove this folder and all files inside it. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeletingFolderId(null)}
      />

      <ConfirmModal
        isOpen={!!deletingFileId}
        title="Delete file?"
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
