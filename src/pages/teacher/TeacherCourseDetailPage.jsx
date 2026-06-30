import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowLeft, HelpCircle, Play, Video } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { VideoPlayerDialog } from '@/components/shared/VideoPlayerDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatDuration } from '@/lib/utils'
import { formatDuration as formatVideoDuration } from '@/lib/videoConstants'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { SessionForm } from '@/components/teacher/SessionForm'
import {
  uploadSessionVideo,
  deleteSessionFromCloudinary,
  destroySessionCloudinaryAsset,
} from '@/lib/cloudinary'
import {
  buildSessionFromUpload,
  buildSessionFromUrl,
  buildSessionMetadataOnly,
  insertSession,
  mergeSessionIntoList,
  sessionHasVideo,
  sessionToPlayerVideo,
  updateSessionRecord,
} from '@/lib/sessions'

export default function TeacherCourseDetailPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const saveInFlight = useRef(false)

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionDialog, setSessionDialog] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [deleteSession, setDeleteSession] = useState(null)
  const [previewSession, setPreviewSession] = useState(null)
  const [formVersion, setFormVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('courses')
      .select('*, sessions(*), quizzes(*), assignments(*)')
      .eq('id', courseId)
      .eq('teacher_id', user.id)
      .single()
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'danger' })
      navigate('/teacher/courses')
    } else {
      data.sessions?.sort((a, b) => a.order_no - b.order_no)
      setCourse(data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId, user?.id])

  const openSessionDialog = (session = null) => {
    setEditingSession(session)
    setFormVersion((v) => v + 1)
    setSessionDialog(true)
  }

  const applySavedSession = (saved) => {
    setCourse((prev) => {
      if (!prev) return prev
      return { ...prev, sessions: mergeSessionIntoList(prev.sessions, saved) }
    })
  }

  const saveSession = async (form) => {
    if (saveInFlight.current || saving) return
    saveInFlight.current = true
    setSaving(true)
    setUploadProgress(null)

    const teacherId = user?.id
    if (!teacherId || !courseId) {
      toast({ title: 'Error', description: 'You must be signed in as a teacher.', variant: 'danger' })
      saveInFlight.current = false
      setSaving(false)
      return
    }

    let uploadedAsset = null
    const oldPublicId = editingSession?.public_id

    try {
      let saved

      if (form.videoFile) {
        // 1) Upload to Cloudinary first
        setUploadProgress(0)
        uploadedAsset = await uploadSessionVideo(form.videoFile, courseId, setUploadProgress)
        setUploadProgress(100)

        // 2) Insert/update DB only after upload succeeds
        const payload = buildSessionFromUpload(form, uploadedAsset)

        if (editingSession) {
          saved = await updateSessionRecord(editingSession.id, teacherId, payload)
          if (oldPublicId && oldPublicId !== payload.public_id) {
            try {
              await destroySessionCloudinaryAsset(editingSession.id, oldPublicId)
            } catch (cleanupErr) {
              console.warn('[sessions] old Cloudinary asset cleanup failed', cleanupErr)
            }
          }
          toast({ title: 'Lesson updated', variant: 'success' })
        } else {
          saved = await insertSession(courseId, teacherId, payload)
          toast({ title: 'Lesson created', variant: 'success' })
        }
      } else if (form.videoSource === 'url' && form.video_url?.trim()) {
        const payload = buildSessionFromUrl(form)
        if (editingSession) {
          if (oldPublicId) {
            try {
              await destroySessionCloudinaryAsset(editingSession.id, oldPublicId)
            } catch (cleanupErr) {
              console.warn('[sessions] Cloudinary cleanup failed', cleanupErr)
            }
          }
          saved = await updateSessionRecord(editingSession.id, teacherId, payload)
          toast({ title: 'Lesson updated', variant: 'success' })
        } else {
          saved = await insertSession(courseId, teacherId, payload)
          toast({ title: 'Lesson created', variant: 'success' })
        }
      } else if (editingSession) {
        const payload = buildSessionMetadataOnly(form, editingSession)
        saved = await updateSessionRecord(editingSession.id, teacherId, payload)
        toast({ title: 'Lesson updated', variant: 'success' })
      } else {
        throw new Error('Add a video URL or upload a file.')
      }

      applySavedSession(saved)
      setSessionDialog(false)
      setEditingSession(null)

      if (sessionHasVideo(saved)) {
        setPreviewSession(saved)
      }

      load().catch((err) => console.warn('[sessions] background reload failed', err))
    } catch (err) {
      console.error('[sessions] save failed', err)
      toast({
        title: uploadedAsset ? 'Upload succeeded but save failed' : 'Error',
        description: err.message || 'Could not save lesson.',
        variant: 'danger',
      })
    } finally {
      saveInFlight.current = false
      setSaving(false)
      setUploadProgress(null)
    }
  }

  const handleDeleteSession = async () => {
    if (!deleteSession) return
    setDeleting(true)
    try {
      if (deleteSession.public_id) {
        await deleteSessionFromCloudinary(deleteSession.id, deleteSession.public_id)
      } else {
        const { error } = await supabase.from('sessions').delete().eq('id', deleteSession.id)
        if (error) throw error
      }
      setCourse((prev) => ({
        ...prev,
        sessions: (prev.sessions || []).filter((s) => s.id !== deleteSession.id),
      }))
      toast({ title: 'Lesson deleted', variant: 'success' })
      setDeleteSession(null)
      load().catch((err) => console.warn('[sessions] background reload failed', err))
    } catch (err) {
      console.error('[sessions] delete failed', err)
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <SkeletonLoader count={3} />
  if (!course) return null

  const nextOrder = (course.sessions?.length || 0) + 1

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/teacher/courses')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && <p className="text-muted-foreground">{course.description}</p>}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lessons</h2>
          <Button size="sm" onClick={() => openSessionDialog()}>
            <Plus className="h-4 w-4" /> Add Lesson
          </Button>
        </div>
        <div className="space-y-3">
          {course.sessions?.length ? course.sessions.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {s.order_no}
                  </span>
                  {s.thumbnail_url ? (
                    <img
                      src={s.thumbnail_url}
                      alt=""
                      className="hidden h-14 w-24 shrink-0 rounded object-cover sm:block"
                    />
                  ) : sessionHasVideo(s) ? (
                    <div className="hidden h-14 w-24 shrink-0 items-center justify-center rounded bg-muted sm:flex">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-medium">{s.title}</p>
                    {s.description && (
                      <p className="line-clamp-1 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(s.duration_min)}
                      {s.video_duration ? ` · Video ${formatVideoDuration(s.video_duration)}` : ''}
                      {s.locked ? ' · Locked' : ''}
                    </p>
                    {s.public_id && (
                      <Badge variant="secondary" className="mt-1">Cloudinary upload</Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {sessionHasVideo(s) && (
                    <Button size="sm" variant="outline" onClick={() => setPreviewSession(s)}>
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Preview
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openSessionDialog(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteSession(s)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-muted-foreground">No lessons yet. Add your first lesson with a URL or uploaded video.</p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quizzes</h2>
          <Link to={`/teacher/courses/${courseId}/quiz-builder`}>
            <Button size="sm"><HelpCircle className="h-4 w-4" /> Quiz Builder</Button>
          </Link>
        </div>
        {course.quizzes?.length ? (
          <div className="space-y-2">
            {course.quizzes.map((q) => (
              <Card key={q.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <span>{q.title}</span>
                  <Badge>{q.passing_score}% to pass</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <p className="text-muted-foreground">No quizzes yet</p>}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Assignments</h2>
        {course.assignments?.length ? (
          <div className="space-y-2">
            {course.assignments.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <p className="font-medium">{a.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <p className="text-muted-foreground">No assignments yet</p>}
      </section>

      <Dialog open={sessionDialog} onOpenChange={(open) => !saving && setSessionDialog(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
          </DialogHeader>
          <SessionForm
            key={`session-${formVersion}`}
            formKey={`session-${formVersion}`}
            initialSession={editingSession}
            nextOrder={nextOrder}
            submitting={saving}
            uploadProgress={uploadProgress}
            onSubmit={saveSession}
            onCancel={() => setSessionDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <VideoPlayerDialog
        video={sessionToPlayerVideo(previewSession)}
        open={!!previewSession}
        onOpenChange={(open) => !open && setPreviewSession(null)}
      />

      <ConfirmDialog
        open={!!deleteSession}
        onOpenChange={(open) => !open && setDeleteSession(null)}
        title="Delete lesson?"
        description="This will permanently remove the lesson and delete any uploaded video from Cloudinary."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDeleteSession}
      />
    </div>
  )
}
