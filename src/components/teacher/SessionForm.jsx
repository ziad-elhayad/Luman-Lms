import { useEffect, useRef, useState } from 'react'
import { Film, Link2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  MAX_VIDEO_SIZE_BYTES,
  validateVideoFile,
} from '@/lib/videoConstants'
import { sessionHasVideo } from '@/lib/sessions'

const EMPTY_FORM = {
  title: '',
  description: '',
  duration_min: 30,
  order_no: 1,
  locked: false,
  videoSource: 'url',
  video_url: '',
}

export function sessionToFormValues(session, nextOrder = 1) {
  if (!session) {
    return { ...EMPTY_FORM, order_no: nextOrder }
  }
  const hasCloudinary = Boolean(session.public_id)
  return {
    title: session.title || '',
    description: session.description || '',
    duration_min: session.duration_min ?? 30,
    order_no: session.order_no ?? 1,
    locked: Boolean(session.locked),
    videoSource: hasCloudinary ? 'upload' : 'url',
    video_url: session.video_url || '',
  }
}

export function SessionForm({
  initialSession,
  nextOrder = 1,
  formKey,
  submitting,
  uploadProgress,
  onSubmit,
  onCancel,
}) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(sessionToFormValues(initialSession, nextOrder))
  const [videoFile, setVideoFile] = useState(null)
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    setForm(sessionToFormValues(initialSession, nextOrder))
    setVideoFile(null)
    setFileError('')
  }, [formKey, initialSession?.id, nextOrder])

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
    setForm((prev) => ({ ...prev, videoSource: 'upload' }))
  }

  const clearFile = () => {
    setVideoFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    const isCreate = !initialSession
    const hasExistingVideo = sessionHasVideo(initialSession)

    if (isCreate && !videoFile && form.videoSource === 'upload') {
      setFileError('Please select a video file or switch to Video URL.')
      return
    }
    if (isCreate && form.videoSource === 'url' && !form.video_url?.trim()) {
      setFileError('Enter a video URL or upload a file.')
      return
    }

    if (!isCreate && !videoFile && form.videoSource === 'upload' && !hasExistingVideo && !form.video_url?.trim()) {
      setFileError('Select a video file or provide a URL.')
      return
    }

    onSubmit({ ...form, videoFile })
  }

  const maxMb = MAX_VIDEO_SIZE_BYTES / (1024 * 1024)
  const showExisting = initialSession && sessionHasVideo(initialSession) && !videoFile

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="session-title">Title *</Label>
        <Input
          id="session-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Lesson title"
          required
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-description">Description</Label>
        <Textarea
          id="session-description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Brief lesson description"
          rows={2}
          disabled={submitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="session-duration">Duration (min)</Label>
          <Input
            id="session-duration"
            type="number"
            min={1}
            value={form.duration_min}
            onChange={(e) => setForm({ ...form, duration_min: parseInt(e.target.value, 10) || 0 })}
            disabled={submitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-order">Order</Label>
          <Input
            id="session-order"
            type="number"
            min={1}
            value={form.order_no}
            onChange={(e) => setForm({ ...form, order_no: parseInt(e.target.value, 10) || 1 })}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-control border border-border px-3 py-2">
        <Label htmlFor="session-locked" className="cursor-pointer">Locked until previous lesson complete</Label>
        <Switch
          id="session-locked"
          checked={form.locked}
          onCheckedChange={(locked) => setForm({ ...form, locked })}
          disabled={submitting}
        />
      </div>

      <div className="space-y-3">
        <Label>Video</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={form.videoSource === 'url' ? 'default' : 'outline'}
            onClick={() => setForm({ ...form, videoSource: 'url' })}
            disabled={submitting}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> URL
          </Button>
          <Button
            type="button"
            size="sm"
            variant={form.videoSource === 'upload' ? 'default' : 'outline'}
            onClick={() => setForm({ ...form, videoSource: 'upload' })}
            disabled={submitting}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
          </Button>
        </div>

        {form.videoSource === 'url' ? (
          <div className="space-y-2">
            <Input
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://www.youtube.com/embed/... or direct video URL"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Paste a YouTube embed URL or any direct video link.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {showExisting && (
              <div className="flex items-center gap-3 rounded-control border border-border bg-muted/20 p-3">
                {initialSession.thumbnail_url ? (
                  <img
                    src={initialSession.thumbnail_url}
                    alt=""
                    className="h-14 w-24 rounded object-cover"
                  />
                ) : (
                  <Film className="h-8 w-8 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  Current uploaded video — select a new file below to replace it.
                </p>
              </div>
            )}
            <div className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-muted/20 p-5 text-center">
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
                    MP4, WebM, MOV — max {maxMb} MB
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
          </div>
        )}
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
        <Button type="submit" disabled={submitting || !form.title.trim()}>
          {submitting ? (uploadProgress != null ? 'Uploading…' : 'Saving…') : 'Save Lesson'}
        </Button>
      </div>
    </form>
  )
}
