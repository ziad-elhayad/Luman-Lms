import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Film, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  GRADE_YEARS,
  MAX_VIDEO_SIZE_BYTES,
  VIDEO_EDUCATION_LEVELS,
  validateVideoFile,
} from '@/lib/videoConstants'
import { getTeacherSubjectOptions } from '@/lib/videos'

const EMPTY_FORM = {
  title: '',
  description: '',
  educationLevel: 'middle',
  gradeYear: '1',
  subject: '',
}

export function VideoForm({
  profile,
  initialValues,
  formKey,
  mode = 'create',
  submitting,
  uploadProgress,
  onSubmit,
  onCancel,
}) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues })
  const [videoFile, setVideoFile] = useState(null)
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...initialValues })
    setVideoFile(null)
    setFileError('')
  }, [formKey])

  const subjectOptions = useMemo(
    () => getTeacherSubjectOptions(profile, form.educationLevel),
    [profile, form.educationLevel],
  )

  useEffect(() => {
    if (form.subject && !subjectOptions.some((s) => s.id === form.subject)) {
      setForm((prev) => ({ ...prev, subject: '' }))
    }
  }, [subjectOptions, form.subject])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setVideoFile(null)
      setFileError('')
      return
    }
    const error = validateVideoFile(file)
    if (error) {
      setVideoFile(null)
      setFileError(error)
      e.target.value = ''
      return
    }
    setVideoFile(file)
    setFileError('')
  }

  const clearFile = () => {
    setVideoFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!form.subject) return
    if (mode === 'create' && !videoFile) {
      setFileError('Please select a video file.')
      return
    }
    onSubmit({ ...form, gradeYear: Number(form.gradeYear), videoFile })
  }

  const maxMb = MAX_VIDEO_SIZE_BYTES / (1024 * 1024)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="video-title">Title *</Label>
        <Input
          id="video-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Lesson title"
          required
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-description">Description</Label>
        <Textarea
          id="video-description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Brief description of this lesson video"
          rows={3}
          disabled={submitting}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Education Level *</Label>
          <Select
            value={form.educationLevel}
            onValueChange={(v) => setForm({ ...form, educationLevel: v, subject: '' })}
            disabled={submitting || mode === 'edit'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_EDUCATION_LEVELS.map((lvl) => (
                <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Grade Year *</Label>
          <Select
            value={String(form.gradeYear)}
            onValueChange={(v) => setForm({ ...form, gradeYear: v })}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_YEARS.map((g) => (
                <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Subject *</Label>
        {subjectOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-control border border-dashed border-border p-3">
            No assigned subjects for this education level. Ask your administrator to update your profile.
          </p>
        ) : (
          <Select
            value={form.subject}
            onValueChange={(v) => setForm({ ...form, subject: v })}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Video File {mode === 'create' ? '*' : '(optional — leave empty to keep current video)'}
        </Label>
        <div
          className="relative flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:border-primary/50"
        >
          {videoFile ? (
            <div className="flex w-full items-center justify-between gap-3 rounded-control bg-card px-3 py-2 text-left">
              <div className="flex min-w-0 items-center gap-2">
                <Film className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{videoFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={clearFile} disabled={submitting}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                MP4, WebM, MOV, AVI, MKV, or OGG — max {maxMb} MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                Choose video
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={submitting}
          />
        </div>
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>

      {submitting && uploadProgress != null && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Uploading to Cloudinary…</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || !form.title.trim() || !form.subject || subjectOptions.length === 0}
        >
          {submitting
            ? (mode === 'create' ? 'Uploading…' : 'Saving…')
            : (mode === 'create' ? 'Upload Video' : 'Save Changes')}
        </Button>
      </div>
    </form>
  )
}

export function videoToFormValues(video) {
  if (!video) return {}
  return {
    title: video.title || '',
    description: video.description || '',
    educationLevel: video.education_level,
    gradeYear: String(video.grade_year),
    subject: video.subject || '',
  }
}
