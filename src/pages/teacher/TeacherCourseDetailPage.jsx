import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowLeft, HelpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDuration } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

export default function TeacherCourseDetailPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionDialog, setSessionDialog] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [deleteSessionId, setDeleteSessionId] = useState(null)
  const [sessionForm, setSessionForm] = useState({ title: '', duration_min: 30, video_url: '', order_no: 1, locked: false })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, sessions(*), quizzes(*), assignments(*)')
      .eq('id', courseId)
      .single()
    if (error) toast({ title: 'Error', description: error.message, variant: 'danger' })
    else {
      data.sessions?.sort((a, b) => a.order_no - b.order_no)
      setCourse(data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId])

  const openSessionDialog = (session = null) => {
    if (session) {
      setEditingSession(session)
      setSessionForm({ title: session.title, duration_min: session.duration_min, video_url: session.video_url || '', order_no: session.order_no, locked: session.locked })
    } else {
      setEditingSession(null)
      setSessionForm({ title: '', duration_min: 30, video_url: '', order_no: (course?.sessions?.length || 0) + 1, locked: false })
    }
    setSessionDialog(true)
  }

  const saveSession = async () => {
    setSaving(true)
    try {
      if (editingSession) {
        await supabase.from('sessions').update(sessionForm).eq('id', editingSession.id)
        toast({ title: 'Session updated', variant: 'success' })
      } else {
        await supabase.from('sessions').insert({ ...sessionForm, course_id: courseId })
        toast({ title: 'Session created', variant: 'success' })
      }
      setSessionDialog(false)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const deleteSession = async () => {
    await supabase.from('sessions').delete().eq('id', deleteSessionId)
    toast({ title: 'Session deleted', variant: 'success' })
    setDeleteSessionId(null)
    load()
  }

  if (loading) return <SkeletonLoader count={3} />
  if (!course) return null

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/teacher/courses')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <Badge className="mb-2">Grade {course.grade}</Badge>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground">{course.subject}</p>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Button size="sm" onClick={() => openSessionDialog()}><Plus className="h-4 w-4" /> Add Session</Button>
        </div>
        <div className="space-y-3">
          {course.sessions?.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{s.order_no}</span>
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{formatDuration(s.duration_min)} {s.locked && '· Locked'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => openSessionDialog(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteSessionId(s.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
              <Card key={q.id}><CardContent className="p-4 flex justify-between items-center">
                <span>{q.title}</span>
                <Badge>{q.passing_score}% to pass</Badge>
              </CardContent></Card>
            ))}
          </div>
        ) : <p className="text-muted-foreground">No quizzes yet</p>}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Assignments</h2>
        {course.assignments?.length ? (
          <div className="space-y-2">
            {course.assignments.map((a) => (
              <Card key={a.id}><CardContent className="p-4"><p className="font-medium">{a.title}</p></CardContent></Card>
            ))}
          </div>
        ) : <p className="text-muted-foreground">No assignments yet</p>}
      </section>

      <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSession ? 'Edit Session' : 'New Session'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={sessionForm.duration_min} onChange={(e) => setSessionForm({ ...sessionForm, duration_min: parseInt(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Order</Label><Input type="number" value={sessionForm.order_no} onChange={(e) => setSessionForm({ ...sessionForm, order_no: parseInt(e.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label>Video URL (YouTube embed)</Label><Input value={sessionForm.video_url} onChange={(e) => setSessionForm({ ...sessionForm, video_url: e.target.value })} placeholder="https://www.youtube.com/embed/..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(false)}>Cancel</Button>
            <Button onClick={saveSession} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)} title="Delete session?" onConfirm={deleteSession} />
    </div>
  )
}
