import { useEffect, useState } from 'react'
import { Pencil, Play, Plus, Trash2, Video } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/shared/SearchInput'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { VideoPlayerDialog } from '@/components/shared/VideoPlayerDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VideoForm, videoToFormValues } from '@/components/teacher/VideoForm'
import { uploadTeacherVideo, deleteVideoFromCloudinary, destroyCloudinaryAsset } from '@/lib/cloudinary'
import {
  createVideoRecord,
  fetchTeacherVideos,
  replaceVideoAsset,
  updateVideoMetadata,
  videoGradeLabel,
  videoSubjectLabel,
} from '@/lib/videos'
import { formatDuration, formatUploadDate } from '@/lib/videoConstants'

export default function TeacherVideosPage() {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addFormVersion, setAddFormVersion] = useState(0)
  const [editVideo, setEditVideo] = useState(null)
  const [deleteVideo, setDeleteVideo] = useState(null)
  const [previewVideo, setPreviewVideo] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await fetchTeacherVideos(user.id)
      setVideos(data)
    } catch (err) {
      toast({ title: 'Error loading videos', description: err.message, variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id])

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase()
    return (
      v.title?.toLowerCase().includes(q) ||
      videoSubjectLabel(v.subject).toLowerCase().includes(q)
    )
  })

  const handleAdd = async ({ title, description, educationLevel, gradeYear, subject, videoFile }) => {
    setSubmitting(true)
    setUploadProgress(0)
    try {
      const asset = await uploadTeacherVideo(videoFile, setUploadProgress)
      await createVideoRecord(user.id, {
        title,
        description,
        educationLevel,
        gradeYear,
        subject,
        ...asset,
      })
      toast({ title: 'Video uploaded successfully', variant: 'success' })
      setAddOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'danger' })
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  const handleEdit = async ({ title, description, gradeYear, subject, videoFile }) => {
    if (!editVideo) return
    setSubmitting(true)
    setUploadProgress(null)
    try {
      if (videoFile) {
        const oldPublicId = editVideo.public_id
        setUploadProgress(0)
        const asset = await uploadTeacherVideo(videoFile, setUploadProgress)
        await replaceVideoAsset(editVideo.id, asset)
        try {
          await destroyCloudinaryAsset(editVideo.id, oldPublicId)
        } catch {
          // Old asset may already be gone; new metadata is saved
        }
      }
      await updateVideoMetadata(editVideo.id, {
        title,
        description,
        gradeYear,
        subject,
      })
      toast({ title: 'Video updated', variant: 'success' })
      setEditVideo(null)
      load()
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'danger' })
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteVideo) return
    setDeleting(true)
    try {
      await deleteVideoFromCloudinary(deleteVideo.id, deleteVideo.public_id)
      toast({ title: 'Video deleted', variant: 'success' })
      setDeleteVideo(null)
      load()
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lesson Videos</h1>
          <p className="text-muted-foreground">
            Upload and manage lesson videos stored securely in Cloudinary.
          </p>
        </div>
        <Button onClick={() => { setAddFormVersion((v) => v + 1); setAddOpen(true) }} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Add Video
        </Button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by title or subject…"
        className="max-w-md"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted/50" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No videos yet</p>
              <p className="text-sm text-muted-foreground">
                {search ? 'No videos match your search.' : 'Upload your first lesson video to get started.'}
              </p>
            </div>
            {!search && (
              <Button onClick={() => { setAddFormVersion((v) => v + 1); setAddOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" /> Add Video
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Video className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <Badge className="absolute bottom-2 right-2 bg-black/70 text-white hover:bg-black/70">
                  {formatDuration(video.duration)}
                </Badge>
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-2 font-semibold leading-snug">{video.title}</h3>
                  {video.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{videoSubjectLabel(video.subject)}</Badge>
                  <Badge variant="outline">
                    {videoGradeLabel(video.education_level, video.grade_year)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploaded {formatUploadDate(video.created_at)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPreviewVideo(video)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditVideo(video)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteVideo(video)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(open) => !submitting && setAddOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lesson Video</DialogTitle>
          </DialogHeader>
          <VideoForm
            key={`add-${addFormVersion}`}
            formKey={`add-${addFormVersion}`}
            profile={profile}
            mode="create"
            submitting={submitting}
            uploadProgress={uploadProgress}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVideo} onOpenChange={(open) => !submitting && !open && setEditVideo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
          </DialogHeader>
          {editVideo && (
            <VideoForm
              key={editVideo.id}
              formKey={editVideo.id}
              profile={profile}
              mode="edit"
              initialValues={videoToFormValues(editVideo)}
              submitting={submitting}
              uploadProgress={uploadProgress}
              onSubmit={handleEdit}
              onCancel={() => setEditVideo(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <VideoPlayerDialog
        video={previewVideo}
        open={!!previewVideo}
        onOpenChange={(open) => !open && setPreviewVideo(null)}
      />

      <ConfirmDialog
        open={!!deleteVideo}
        onOpenChange={(open) => !open && setDeleteVideo(null)}
        title="Delete video?"
        description="This will permanently remove the video from Cloudinary and delete its record. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
