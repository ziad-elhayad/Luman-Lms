import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TeacherForm } from '@/components/admin/TeacherForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/contexts/ToastContext'
import {
  EMPTY_TEACHER_FORM,
  profileToTeacherForm,
  validateTeacherForm,
  teacherDisplayName,
} from '@/lib/teacherForm'
import { formatSubjectsList, EDUCATION_LEVELS } from '@/lib/teacherSubjects'
import { createTeacher, updateTeacher } from '@/lib/createUser'

const PAGE_SIZE = 10

export default function AdminTeachersPage() {
  const { toast } = useToast()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [disableId, setDisableId] = useState(null)
  const [form, setForm] = useState(EMPTY_TEACHER_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name')
    if (error) {
      toast({ title: 'Error loading teachers', description: error.message, variant: 'danger' })
    }
    setTeachers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_TEACHER_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = async (teacher) => {
    setEditing(teacher)
    setErrors({})
    setDialogOpen(true)
    setFormLoading(true)
    setForm(profileToTeacherForm(teacher))

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, email, phone, education_level, secondary_track, subjects')
      .eq('id', teacher.id)
      .single()

    if (error) {
      toast({ title: 'Error loading teacher', description: error.message, variant: 'danger' })
    } else if (data) {
      setForm(profileToTeacherForm(data))
    }
    setFormLoading(false)
  }

  const filtered = teachers.filter((t) => {
    const name = teacherDisplayName(t).toLowerCase()
    const matchSearch =
      name.includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.phone?.includes(search)
    const matchFilter = filter === 'all' || (filter === 'active' && !t.disabled) || (filter === 'disabled' && t.disabled)
    return matchSearch && matchFilter
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSave = async () => {
    const isEdit = Boolean(editing)
    const validationErrors = validateTeacherForm(form, isEdit)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSaving(true)
    try {
      if (isEdit) {
        await updateTeacher(editing.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          educationLevel: form.educationLevel,
          secondaryTrack: form.secondaryTrack,
          subjects: form.subjects,
          password: form.password || null,
        })
        toast({ title: 'Teacher updated', variant: 'success' })
      } else {
        const fullName = `${form.firstName} ${form.lastName}`.trim()
        await createTeacher({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          fullName,
          phone: form.phone,
          educationLevel: form.educationLevel,
          secondaryTrack: form.secondaryTrack,
          subjects: form.subjects,
        })
        toast({
          title: 'Teacher created',
          description: 'They can log in with the email and password you set.',
          variant: 'success',
        })
      }
      setDialogOpen(false)
      setEditing(null)
      setForm(EMPTY_TEACHER_FORM)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase.rpc('delete_user_account', { p_user_id: deleteId })
      if (error) throw error
      toast({ title: 'Teacher deleted', variant: 'success' })
      setDeleteId(null)
      load()
    } catch (err) {
      const missingFn =
        err.code === 'PGRST202' ||
        err.message?.includes('Could not find the function') ||
        err.message?.includes('404')
      toast({
        title: 'Delete failed',
        description: missingFn
          ? 'Database function missing. Run supabase/patches/delete_user_account.sql in Supabase SQL Editor, then try again.'
          : err.message,
        variant: 'danger',
      })
    }
  }

  const handleDisable = async () => {
    const teacher = teachers.find((t) => t.id === disableId)
    const { error } = await supabase.from('profiles').update({ disabled: !teacher.disabled }).eq('id', disableId)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'danger' })
      return
    }
    toast({ title: teacher.disabled ? 'Teacher enabled' : 'Teacher disabled', variant: 'success' })
    setDisableId(null)
    load()
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => teacherDisplayName(r) },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    {
      key: 'level',
      label: 'Level',
      render: (r) => EDUCATION_LEVELS.find((l) => l.value === r.education_level)?.label || '—',
    },
    {
      key: 'subjects',
      label: 'Subjects',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground">
          {formatSubjectsList(r.subjects)}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <Badge variant={r.disabled ? 'danger' : 'success'}>{r.disabled ? 'Disabled' : 'Active'}</Badge>,
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDisableId(r.id)}>
            {r.disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Teacher Management</h2>
          <p className="text-muted-foreground">Manage platform teachers</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Teacher
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search teachers..." className="sm:w-64" />
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={paginated} loading={loading} emptyTitle="No teachers" emptyDescription="Add teachers to get started." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditing(null)
          setErrors({})
          setFormLoading(false)
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
          </DialogHeader>
          {formLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading teacher details...</p>
          ) : (
            <TeacherForm
              form={form}
              errors={errors}
              isEdit={Boolean(editing)}
              onChange={setForm}
              disabled={saving}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || formLoading}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete teacher?" description="This will permanently remove the teacher." onConfirm={handleDelete} />
      <ConfirmDialog
        open={!!disableId}
        onOpenChange={() => setDisableId(null)}
        title={teachers.find((t) => t.id === disableId)?.disabled ? 'Enable teacher?' : 'Disable teacher?'}
        description="The teacher will lose access to the platform."
        confirmLabel={teachers.find((t) => t.id === disableId)?.disabled ? 'Enable' : 'Disable'}
        variant="default"
        onConfirm={handleDisable}
      />
    </div>
  )
}
