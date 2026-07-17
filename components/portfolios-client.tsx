'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  UserPlus,
  Upload,
  X,
  FileText,
  Pencil,
  Trash2,
  ChevronDown,
  Search,
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Toaster, useToast } from '@/components/ui/toast'
import { PortfoliosUpload } from '@/components/portfolios-upload'

type Student = {
  id: string
  name: string
  className: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

type FileRecord = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedAt: Date
  bucketPath: string
  studentId: string
}

const CLASS_OPTIONS = ['Grade 10', 'Form 3', 'Form 4'] as const
type ClassOption = typeof CLASS_OPTIONS[number]

export function PortfoliosClient({ initialStudents }: { initialStudents: Student[] }) {
  const [studentsList, setStudentsList] = React.useState<Student[]>(initialStudents)
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null)
  const [files, setFiles] = React.useState<FileRecord[]>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [classFilter, setClassFilter] = React.useState<ClassOption | ''>('')

  const [isCreatingStudent, setIsCreatingStudent] = React.useState(false)
  const [newStudentName, setNewStudentName] = React.useState('')
  const [newStudentClass, setNewStudentClass] = React.useState<ClassOption>('Grade 10')

  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editClass, setEditClass] = React.useState<ClassOption>('Grade 10')

  const [deletingStudentId, setDeletingStudentId] = React.useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = React.useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)

  const { toasts, addToast } = useToast()

  const filteredStudents = React.useMemo(() => {
    let result = [...studentsList]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
    }

    if (classFilter) {
      result = result.filter((s) => s.className === classFilter)
    }

    result.sort((a, b) => a.name.localeCompare(b.name))

    return result
  }, [studentsList, searchQuery, classFilter])

  const uniqueClasses = React.useMemo(() => {
    return Array.from(new Set(studentsList.map((s) => s.className))).sort()
  }, [studentsList])

  const loadFiles = React.useCallback(async (studentId: string) => {
    const { getPortfolioFiles } = await import('@/app/actions/portfolios')
    const result = await getPortfolioFiles(studentId)
    setFiles(result as FileRecord[])
  }, [])

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student)
    await loadFiles(student.id)
  }

  const handleBack = () => {
    setSelectedStudent(null)
    setFiles([])
  }

  const handleCreateStudent = async () => {
    if (!newStudentName.trim() || !newStudentClass.trim()) return
    try {
      const { createStudent } = await import('@/app/actions/portfolios')
      const student = await createStudent(newStudentName.trim(), newStudentClass.trim())
      setStudentsList((prev) => [...prev, student])
      setNewStudentName('')
      setNewStudentClass('Grade 10')
      setIsCreatingStudent(false)
      addToast('Student added', 'success')
    } catch {
      addToast('Failed to add student', 'error')
    }
  }

  const startEdit = (student: Student) => {
    setEditingStudent(student)
    setEditName(student.name)
    setEditClass(student.className as ClassOption)
  }

  const handleEdit = async () => {
    if (!editingStudent || !editName.trim() || !editClass.trim()) return
    try {
      const { updateStudent } = await import('@/app/actions/portfolios')
      const updated = await updateStudent(editingStudent.id, editName.trim(), editClass.trim())
      setStudentsList((prev) => prev.map((s) => (s.id === editingStudent.id ? updated : s)))
      if (selectedStudent?.id === editingStudent.id) {
        setSelectedStudent(updated)
      }
      setEditingStudent(null)
      setEditName('')
      setEditClass('Grade 10')
      addToast('Student updated', 'success')
    } catch {
      addToast('Failed to update student', 'error')
    }
  }

  const confirmDeleteStudent = async () => {
    if (!deletingStudentId) return
    try {
      const { deleteStudent } = await import('@/app/actions/portfolios')
      await deleteStudent(deletingStudentId)
      setStudentsList((prev) => prev.filter((s) => s.id !== deletingStudentId))
      if (selectedStudent?.id === deletingStudentId) {
        handleBack()
      }
      setDeletingStudentId(null)
      addToast('Student deleted', 'success')
    } catch {
      addToast('Failed to delete student', 'error')
    }
  }

  const handleUploadComplete = (newFile?: FileRecord) => {
    setIsUploadOpen(false)
    if (selectedStudent && newFile) {
      setFiles((prev) => [...prev, newFile])
      addToast('File uploaded', 'success')
    }
  }

  const confirmDeleteFile = async () => {
    if (!deletingFileId) return
    try {
      const { deletePortfolioFile } = await import('@/app/actions/portfolios')
      await deletePortfolioFile(deletingFileId)
      setFiles((prev) => prev.filter((f) => f.id !== deletingFileId))
      setDeletingFileId(null)
      addToast('File deleted', 'success')
    } catch {
      addToast('Failed to delete file', 'error')
    }
  }

  const handleOpenFile = async (file: FileRecord) => {
    try {
      const { getPortfolioFileUrl } = await import('@/app/actions/portfolios')
      const url = await getPortfolioFileUrl(file.id)
      window.open(url, '_blank')
    } catch {
      addToast('Failed to open file', 'error')
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {selectedStudent ? `${selectedStudent.name}'s Portfolio` : 'Student Portfolios'}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {!selectedStudent && (
            <Button className="gap-2" onClick={() => setIsCreatingStudent(true)}>
              <UserPlus className="w-4 h-4" />
              New Student
            </Button>
          )}
          {selectedStudent && (
            <>
              <Button variant="outline" className="gap-2" onClick={handleBack}>
                <X className="w-4 h-4" />
                Back
              </Button>
              <Button className="gap-2" onClick={() => setIsUploadOpen(true)}>
                <Upload className="w-4 h-4" />
                Upload File
              </Button>
            </>
          )}
        </div>
      </div>

      {isCreatingStudent && !selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">New Student</h2>
                <p className="text-sm text-muted-foreground">Add a new student to the portfolio.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsCreatingStudent(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-name">Full Name</Label>
                <Input
                  id="student-name"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Enter full name"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateStudent()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-class">Class</Label>
                <select
                  id="student-class"
                  value={newStudentClass}
                  onChange={(e) => setNewStudentClass(e.target.value as ClassOption)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreatingStudent(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateStudent}>Add Student</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Edit Student</h2>
                <p className="text-sm text-muted-foreground">Update student details.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingStudent(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class">Class</Label>
                <select
                  id="edit-class"
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value as ClassOption)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 sm:p-8 lg:p-10 xl:p-12 bg-card border-border">
        {selectedStudent ? (
          files.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No files yet</p>
              <p className="text-sm">Upload files to this student&apos;s portfolio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface p-4 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.originalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.mimeType} · {(Number(file.size) / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenFile(file)}>
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
          <>
            <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value as ClassOption | '')}
                  className="flex h-10 w-full sm:w-auto min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none pr-8"
                >
                  <option value="">All Classes</option>
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  {studentsList.length === 0 ? 'No students yet' : 'No students match your search'}
                </p>
                <p className="text-sm">
                  {studentsList.length === 0
                    ? 'Add a new student to get started'
                    : 'Try adjusting your search query'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-6 hover:border-primary/50 transition-colors"
                  >
                    <button
                      onClick={() => handleSelectStudent(student)}
                      className="flex flex-1 flex-col items-center justify-center gap-3 w-full"
                    >
                      <Avatar size="lg">
                        <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground text-center break-all">
                        {student.name}
                      </span>
                      <Badge variant="secondary">{student.className}</Badge>
                    </button>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(student)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingStudentId(student.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <PortfoliosUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        students={studentsList}
        selectedStudentId={selectedStudent?.id || null}
        onUpload={handleUploadComplete}
      />

      <ConfirmModal
        isOpen={!!deletingStudentId}
        title="Delete student?"
        description="This will permanently remove this student and all their files. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteStudent}
        onCancel={() => setDeletingStudentId(null)}
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
