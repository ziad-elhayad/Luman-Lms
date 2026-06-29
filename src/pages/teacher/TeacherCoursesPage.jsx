import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchTeacherCourses } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { CourseCard } from '@/components/shared/CourseCard'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BookOpen } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function TeacherCoursesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await fetchTeacherCourses(user.id)
      setCourses(data || [])
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '' })
    setDialogOpen(true)
  }

  const openEdit = (course) => {
    setEditing(course)
    setForm({
      title: course.title,
      description: course.description || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Title required', description: 'Enter a course title.', variant: 'danger' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        teacher_id: user.id,
      }
      if (editing) {
        const { error } = await supabase.from('courses').update(payload).eq('id', editing.id)
        if (error) throw error
        toast({ title: 'Course updated', variant: 'success' })
      } else {
        const { error } = await supabase.from('courses').insert(payload)
        if (error) throw error
        toast({ title: 'Course created', variant: 'success' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('courses').delete().eq('id', deleteId)
      if (error) throw error
      toast({ title: 'Course deleted', variant: 'success' })
      setDeleteId(null)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Courses</h2>
          <p className="text-muted-foreground">Create courses, then assign them when you add students</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Course</Button>
      </div>

      {loading ? (
        <SkeletonLoader count={3} />
      ) : courses.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="relative group">
              <CourseCard
                course={course}
                to={`/teacher/courses/${course.id}`}
                studentCount={course.enrollments?.[0]?.count}
                sessionCount={course.sessions?.[0]?.count}
              />
              <div className="absolute top-3 right-3 z-10 flex gap-1">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 shadow-soft"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(course) }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="danger"
                  className="h-8 w-8 shadow-soft"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(course.id) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No courses yet" description="Create your first course to get started." actionLabel="Create Course" onAction={openCreate} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Course' : 'New Course'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Introduction to Physics" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will students learn?" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete course?"
        description="This will permanently delete the course and all its content."
        onConfirm={handleDelete}
      />
    </div>
  )
}
