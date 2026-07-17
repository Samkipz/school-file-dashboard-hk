'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, FileText, Search } from 'lucide-react'
import { uploadPortfolioFile } from '@/app/actions/portfolios'

type Student = {
  id: string
  name: string
  className: string
  avatarUrl: string | null
}

export function PortfoliosUpload({
  isOpen,
  onClose,
  students,
  selectedStudentId,
  onUpload,
}: {
  isOpen: boolean
  onClose: () => void
  students: Student[]
  selectedStudentId: string | null
  onUpload: (file?: {
    id: string
    filename: string
    originalName: string
    mimeType: string
    size: number
    uploadedBy: string
    uploadedAt: Date
    bucketPath: string
    studentId: string
  }) => void
}) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [fileNameEdited, setFileNameEdited] = React.useState(false)
  const [selectedStudentIdState, setSelectedStudentId] = React.useState<string>('')
  const [studentSearch, setStudentSearch] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)

  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setFileName('')
      setFileNameEdited(false)
      setSelectedStudentId(selectedStudentId || '')
      setStudentSearch('')
      setError(null)
      setIsDropdownOpen(false)
    }
  }, [isOpen, selectedStudentId])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    if (file) {
      const defaultName = file.name.replace(/\.[^/.]+$/, '')
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

  const handleSelectStudent = (id: string, name: string) => {
    setSelectedStudentId(id)
    setStudentSearch(name)
    setIsDropdownOpen(false)
  }

  const filteredStudents = React.useMemo(() => {
    if (!studentSearch.trim()) return students
    const q = studentSearch.toLowerCase()
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
    )
  }, [students, studentSearch])

  const selectedStudent = students.find((s) => s.id === selectedStudentIdState)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFile) return
    if (!selectedStudentIdState) {
      setError('Please select a student')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('fileName', fileName.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''))
      const newFile = await uploadPortfolioFile(formData, selectedStudentIdState)
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
              Select a student, choose a file, and optionally rename it.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="student-select">Student</Label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={selectedStudent ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedStudent ? `${selectedStudent.name} (${selectedStudent.className})` : 'Select a student'}
                </span>
                <Search className="w-4 h-4 text-muted-foreground" />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
                  <div className="p-2">
                    <Input
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border-t border-border">
                    {filteredStudents.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No students found
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleSelectStudent(student.id, student.name)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted ${
                            selectedStudentIdState === student.id ? 'bg-muted' : ''
                          }`}
                        >
                          <span>{student.name}</span>
                          <span className="text-xs text-muted-foreground">{student.className}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolio-file">File</Label>
            <Input id="portfolio-file" type="file" onChange={handleFileChange} />
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
