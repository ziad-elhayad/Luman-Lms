import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState([])
  const [courses, setCourses] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', course_id: '' })

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('courses').select('id, title').eq('teacher_id', user.id)
      setCourses(c || [])
      const { data: a } = await supabase.from('announcements').select('*, course:courses(title)').eq('teacher_id', user.id).order('created_at', { ascending: false })
      setAnnouncements(a || [])
    }
    load()
  }, [user])

  const handleCreate = async () => {
    try {
      await supabase.from('announcements').insert({ ...form, teacher_id: user.id })
      toast({ title: 'Announcement posted', variant: 'success' })
      setDialogOpen(false)
      const { data: a } = await supabase.from('announcements').select('*, course:courses(title)').eq('teacher_id', user.id).order('created_at', { ascending: false })
      setAnnouncements(a || [])
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Announcements</h2>
          <p className="text-muted-foreground">Post updates to your students</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Announcement</Button>
      </div>

      <div className="space-y-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <p className="font-medium">{a.title}</p>
                <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.course?.title}</p>
              <p className="mt-2 text-sm">{a.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
