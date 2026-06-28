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

export default function TeacherAssignmentsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [courses, setCourses] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', course_id: '' })

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('courses').select('id, title').eq('teacher_id', user.id)
      setCourses(c || [])
      const ids = c?.map((x) => x.id) || []
      const { data: a } = await supabase.from('assignments').select('*, course:courses(title)').in('course_id', ids).order('due_date')
      setAssignments(a || [])
    }
    load()
  }, [user])

  const handleCreate = async () => {
    try {
      await supabase.from('assignments').insert({ ...form, due_date: new Date(form.due_date).toISOString() })
      toast({ title: 'Assignment created', variant: 'success' })
      setDialogOpen(false)
      const { data: a } = await supabase.from('assignments').select('*, course:courses(title)').in('course_id', courses.map((c) => c.id))
      setAssignments(a || [])
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assignments</h2>
          <p className="text-muted-foreground">Create and manage assignments</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Assignment</Button>
      </div>

      <div className="space-y-3">
        {assignments.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex justify-between p-4">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.course?.title} · Due {formatDate(a.due_date)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
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
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
