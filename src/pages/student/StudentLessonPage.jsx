import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Download, ClipboardList } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchSession, markSessionComplete } from '@/lib/api'
import { LessonVideoPlayer } from '@/components/shared/LessonVideoPlayer'
import { sessionToPlayerVideo } from '@/lib/sessions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/contexts/ToastContext'

export default function StudentLessonPage() {
  const { courseId, sessionId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    fetchSession(sessionId)
      .then(setSession)
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'danger' }))
      .finally(() => setLoading(false))
  }, [sessionId, toast])

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const progress = await markSessionComplete(user.id, sessionId, courseId)
      toast({ title: 'Session completed!', description: `Course progress: ${progress}%`, variant: 'success' })
      navigate(`/student/courses/${courseId}`)
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-video w-full rounded-card" />
      </div>
    )
  }

  if (!session) return null

  const playerVideo = sessionToPlayerVideo(session)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/student/courses/${courseId}`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </Button>

        <div>
          <p className="text-sm text-muted-foreground">Session {session.order_no}</p>
          <h1 className="text-2xl font-bold">{session.title}</h1>
        </div>

        <div className="overflow-hidden rounded-card">
          <LessonVideoPlayer video={playerVideo} />
        </div>

        <Button onClick={handleComplete} disabled={completing} className="w-full sm:w-auto">
          {completing ? 'Saving...' : 'Mark as Complete'}
        </Button>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{session.course?.title}</p>
            <p className="text-sm text-muted-foreground">{session.course?.teacher?.full_name}</p>
          </CardContent>
        </Card>

        {session.resources?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {session.resources.map((r) => (
                <a
                  key={r.id}
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-control p-2 text-sm hover:bg-muted/30 transition-colors"
                >
                  <Download className="h-4 w-4 text-primary" />
                  {r.name}
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full min-h-[120px] rounded-control border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Take notes while watching..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
