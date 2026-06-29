import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { createStudent } from '@/lib/createUser'
import { StudentForm } from '@/components/shared/StudentForm'

const PAGE_SIZE = 10

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gradeYear: '1',
  subjects: [],
  password: '',
  confirmPassword: ''
}

/** Flip the disabled flag for one student in the local list (optimistic UI) */
function toggleDisabledLocal(list, id) {
  return list.map((s) => s.id === id ? { ...s, disabled: !s.disabled } : s)
}

export default function TeacherStudentsPage() {
  const { toast } = useToast()
  const { profile: teacherProfile } = useAuth()
  const teacherId = teacherProfile?.id

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)   // null → create mode, object → edit mode
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Confirm dialog (delete only)
  const [deleteId, setDeleteId] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Tracks which student IDs are currently being toggled (prevents double-click)
  const [togglingIds, setTogglingIds] = useState(new Set())

  const load = async () => {
    console.log('=== LOAD FUNCTION START ===')
    console.log('teacherId:', teacherId)
    console.log('teacherProfile:', teacherProfile)
    if (!teacherId) {
      console.log('Returning early - no teacherId')
      return
    }
    setLoading(true)
    // Use direct query without teacher_id filter since RLS allows all students
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
    console.log('Direct query returned students:', data)
    console.log('Direct query error:', error)
    if (error) {
      console.error('Query error details:', JSON.stringify(error, null, 2))
      toast({ title: 'Error loading students', description: error.message, variant: 'danger' })
    }
    setStudents(data || [])
    setLoading(false)
    console.log('=== LOAD FUNCTION END ===')
  }

  useEffect(() => { load() }, [teacherId])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = students.filter((s) => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && !s.disabled) ||
      (filter === 'disabled' && s.disabled)
    return matchSearch && matchFilter
  })
  console.log('Total students:', students.length)
  console.log('Filtered students:', filtered.length)
  console.log('Search:', search, 'Filter:', filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  console.log('Paginated students:', paginated.length)

  // ── Open dialogs ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (student) => {
    setEditing(student)
    setErrors({})
    setForm({
      firstName: student.first_name || student.full_name?.split(' ')[0] || '',
      lastName: student.last_name || student.full_name?.split(' ').slice(1).join(' ') || '',
      email: student.email || '',
      phone: student.phone || '',
      gradeYear: String(student.grade ?? '1'),
      subjects: Array.isArray(student.subjects) ? student.subjects : [],
      password: '',
      confirmPassword: ''
    })
    setDialogOpen(true)
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {}
    if (!form.firstName?.trim()) newErrors.firstName = 'First name is required.'
    if (!form.lastName?.trim()) newErrors.lastName = 'Last name is required.'
    if (!form.email?.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Email is invalid.'
    }
    if (!form.gradeYear) newErrors.gradeYear = 'Grade year is required.'

    if (!editing) {
      if (!form.password) {
        newErrors.password = 'Password is required.'
      } else if (form.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters.'
      }
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.'
      }
    } else if (form.password) {
      if (form.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters.'
      }
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Create / Edit ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`
      const gradeVal = parseInt(form.gradeYear, 10)

      if (editing) {
        // Update profile row
        const updates = {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          full_name: fullName,
          email: form.email.trim().toLowerCase(),
          phone: form.phone?.trim() || null,
          grade: gradeVal,
          subjects: form.subjects || [],
          teacher_id: teacherId,
        }
        const { error } = await supabase.from('profiles').update(updates).eq('id', editing.id)
        if (error) throw error

        // Also update auth.users email if it changed
        if (form.email.trim().toLowerCase() !== editing.email?.toLowerCase()) {
          const { error: authError } = await supabase.rpc('update_user_email_direct', {
            p_user_id: editing.id,
            p_email: form.email.trim().toLowerCase()
          })
          if (authError) {
            console.warn("Could not sync auth email:", authError.message)
          }
        }

        // Update password if provided
        if (form.password) {
          const { error: passwordError } = await supabase.rpc('update_user_password_direct', {
            p_user_id: editing.id,
            p_password: form.password
          })
          if (passwordError) {
            console.warn("Could not sync auth password:", passwordError.message)
          }
        }

        toast({ title: 'Student updated', variant: 'success' })
      } else {
        // Create new student
        const user = await createStudent({
          email: form.email.trim(),
          password: form.password || 'password123',
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          fullName,
          phone: form.phone?.trim() || null,
          grade: gradeVal,
          subjects: form.subjects || [],
          teacherId,
        })

        toast({
          title: 'Student created',
          description: 'They can log in with the email and password you set.',
          variant: 'success',
        })
      }
      setDialogOpen(false)
      setEditing(null)
      load()
    } catch (err) {
      console.error('Save error:', err)
      const errorMsg = err?.message || err?.error_description || JSON.stringify(err)
      toast({ title: 'Error', description: errorMsg || 'An unknown error occurred', variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setConfirmLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user_account', { p_user_id: deleteId })
      if (error) throw error
      toast({ title: 'Student deleted', variant: 'success' })
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
          ? 'Database function missing. Run supabase/patches/delete_user_account.sql in the SQL Editor, then try again.'
          : err.message,
        variant: 'danger',
      })
    } finally {
      setConfirmLoading(false)
    }
  }

  // ── Enable / Disable (optimistic toggle — no confirm dialog) ─────────────
  const handleToggleDisable = async (student) => {
    if (togglingIds.has(student.id)) return   // already in-flight

    const nowDisabled = !student.disabled

    // 1. Flip locally right away
    setStudents((prev) => toggleDisabledLocal(prev, student.id))
    setTogglingIds((prev) => new Set(prev).add(student.id))

    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ disabled: nowDisabled })
        .eq('id', student.id)
        .select('id, disabled')   // ask Supabase to return the updated row

      if (error) throw error

      // If RLS blocked the update, Supabase returns no rows (empty array)
      if (!updated || updated.length === 0) {
        throw new Error(
          'Permission denied: your account does not have permission to update student profiles. ' +
          'Ask your admin to run supabase/patches/teacher_student_update.sql in the Supabase SQL Editor.'
        )
      }

      toast({
        title: nowDisabled ? 'Student disabled' : 'Student enabled',
        description: nowDisabled
          ? `${student.full_name} can no longer log in.`
          : `${student.full_name} can log in again.`,
        variant: 'success',
      })
    } catch (err) {
      // Revert the optimistic flip on failure
      setStudents((prev) => toggleDisabledLocal(prev, student.id))
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(student.id); return s })
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    {
      key: 'grade', label: 'Grade',
      render: (r) => <Badge variant="secondary">Grade {r.grade}</Badge>,
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <Badge variant={r.disabled ? 'danger' : 'success'}>
          {r.disabled ? 'Disabled' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => {
        const isToggling = togglingIds.has(r.id)
        return (
          <div className="flex gap-2">
            {/* Edit */}
            <Button size="sm" variant="ghost" title="Edit student" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {/* Enable / Disable — instant optimistic toggle */}
            <Button
              size="sm"
              variant="ghost"
              title={r.disabled ? 'Enable account' : 'Disable account'}
              disabled={isToggling}
              onClick={() => handleToggleDisable(r)}
            >
              {r.disabled
                ? <UserCheck className="h-4 w-4 text-success" />
                : <UserX className="h-4 w-4 text-warning" />}
            </Button>
            {/* Delete */}
            <Button size="sm" variant="ghost" title="Delete student" onClick={() => setDeleteId(r.id)}>
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Students</h2>
          <p className="text-muted-foreground">Manage your students</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Student
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
          placeholder="Search students..."
          className="sm:w-64"
        />
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyTitle="No students"
        emptyDescription="Add students to get started."
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) { setEditing(null) }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Student' : 'Add Student'}</DialogTitle>
          </DialogHeader>
          
          <StudentForm
            form={form}
            errors={errors}
            isEdit={Boolean(editing)}
            onChange={setForm}
            disabled={saving}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm only */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete student?"
        description="This will permanently remove the student and all their data."
        confirmLabel="Delete"
        variant="danger"
        loading={confirmLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}
