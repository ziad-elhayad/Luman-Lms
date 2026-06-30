import { useEffect, useState } from 'react'
import { AlertCircle, Play, Video } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchStudentVideos,
  getStudentVideoProfileIssues,
  videoGradeLabel,
  videoSubjectLabel,
} from '@/lib/videos'
import { formatDuration, formatUploadDate } from '@/lib/videoConstants'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { EmptyState } from '@/components/shared/EmptyState'
import { VideoPlayerDialog } from '@/components/shared/VideoPlayerDialog'

export function StudentVideosSection() {
  const { profile } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profileIssues, setProfileIssues] = useState([])
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    const issues = getStudentVideoProfileIssues(profile)
    if (issues.length) {
      setProfileIssues(issues)
      setVideos([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setProfileIssues([])
      try {
        const data = await fetchStudentVideos(profile)
        if (!cancelled) setVideos(data)
      } catch (err) {
        if (!cancelled) {
          if (err.code === 'PROFILE_INCOMPLETE') {
            setProfileIssues(err.issues || [])
            setVideos([])
          } else {
            console.error('[StudentVideosSection] load error:', err)
            setError(err.message || 'Failed to load videos')
            setVideos([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [profile])

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Lesson Videos</h3>
        <p className="text-sm text-muted-foreground">
          Videos from your teacher matching your grade and subjects
        </p>
      </div>

      {loading ? (
        <SkeletonLoader type="card" count={3} />
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Could not load videos</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : profileIssues.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Your profile needs to be completed</p>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {profileIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask your teacher to update your grade, education level, and subjects.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No videos available"
          description="Your teacher has not uploaded any lesson videos matching your grade and subjects yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
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
                  <h4 className="line-clamp-2 font-semibold leading-snug">{video.title}</h4>
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
                  {formatUploadDate(video.created_at)}
                </p>
                <Button size="sm" className="w-full" onClick={() => setPlaying(video)}>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Watch
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VideoPlayerDialog
        video={playing}
        open={!!playing}
        onOpenChange={(open) => !open && setPlaying(null)}
      />
    </section>
  )
}
