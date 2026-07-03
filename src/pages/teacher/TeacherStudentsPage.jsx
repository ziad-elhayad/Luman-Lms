import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, UserCheck, UserX, Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { createStudent } from '@/lib/createUser'
import { StudentForm } from '@/components/shared/StudentForm'
import {
  EMPTY_STUDENT_FORM,
  profileToStudentForm,
  validateStudentForm,
  studentFormToPayload,
} from '@/lib/studentForm'
import { approveStudent, rejectStudent, syncGradeEnrollments } from '@/lib/invitation'
import { STUDENT_STATUS } from '@/lib/studentStatus'
import { GRADE_YEARS } from '@/lib/videoConstants'

const PAGE_SIZE = 10

function toggleDisabledLocal(list, id) {
  return list.map((s) => s.id === id ? { ...s, disabled: !s.disabled } : s)
}

function gradeLabel(grade) {
  return GRADE_YEARS.find((g) => g.value === grade)?.label || `Grade ${grade}`
}

export default function TeacherStudentsPage() {
  const { toast } = useToast()
  const { profile: teacherProfile } = useAuth()
  const teacherId = teacherProfile?.id

  const [students, setStudents] = useState([])
  const [pendingStudents, setPendingStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_STUDENT_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)

  const [deleteId, setDeleteId] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [togglingIds, setTogglingIds] = useState(new Set())

  const loadPending = async () => {
    if (!teacherId) return
    setPendingLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('status', STUDENT_STATUS.PENDING)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) {
      toast({ title: 'Error loading pending students', description: error.message, variant: 'danger' })
    } else {
      setPendingStudents(data || [])
    }
    setPendingLoading(false)
  }

  const load = async () => {
    if (!teacherId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('teacher_id', teacherId)
      .or(`status.eq.${STUDENT_STATUS.ACTIVE},status.is.null`)
      .order('full_name')

    if (error) {
      toast({ title: 'Error loading students', description: error.message, variant: 'danger' })
    } else {
      setStudents((data || []).filter((s) => s.status !== STUDENT_STATUS.PENDING && s.status !== STUDENT_STATUS.REJECTED))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPending()
    load()
  }, [teacherId])

  const filtered = students.filter((s) => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && !s.disabled) ||
      (filter === 'disabled' && s.disabled)
    return matchSearch && matchFilter
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_STUDENT_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (student) => {
    setEditing(student)
    setErrors({})
    setForm(profileToStudentForm(student))
    setDialogOpen(true)
  }

  const validateForm = () => {
    const newErrors = validateStudentForm(form, {
      isEdit: Boolean(editing),
      requirePassword: !editing,
      requireCourses: false,
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const payload = studentFormToPayload(form)

      if (editing) {
        const updates = {
          first_name: payload.firstName,
          last_name: payload.lastName,
          full_name: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          teacher_id: teacherId,
          grade: payload.grade,
          education_level: payload.educationLevel,
          subjects: payload.subjects,
        }
        const { error } = await supabase.from('profiles').update(updates).eq('id', editing.id)
        if (error) throw error

        if (payload.email !== editing.email?.toLowerCase()) {
          const { error: authError } = await supabase.rpc('update_user_email_direct', {
            p_user_id: editing.id,
            p_email: payload.email,
          })
          if (authError) console.warn('Could not sync auth email:', authError.message)
        }

        if (form.password) {
          const { error: passwordError } = await supabase.rpc('update_user_password_direct', {
            p_user_id: editing.id,
            p_password: form.password,
          })
          if (passwordError) console.warn('Could not sync auth password:', passwordError.message)
        }

        await syncGradeEnrollments(editing.id)
        toast({ title: 'Student updated', variant: 'success' })
      } else {
        const user = await createStudent({ ...payload, teacherId })

        await supabase.from('student_teachers').upsert(
          { student_id: user.id, teacher_id: teacherId },
          { onConflict: 'student_id,teacher_id' },
        )

        await syncGradeEnrollments(user.id)
        toast({
          title: 'Student created',
          description: 'They can log in with the email and password you set.',
          variant: 'success',
        })
      }
      setDialogOpen(false)
      setEditing(null)
      load()
      loadPending()
    } catch (err) {
      const errorMsg = err?.message || err?.error_description || JSON.stringify(err)
      toast({ title: 'Error', description: errorMsg || 'An unknown error occurred', variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (studentId) => {
    setActionId(studentId)
    try {
      await approveStudent(studentId)
      toast({ title: 'Student approved', description: 'They now have access to grade-matched courses.', variant: 'success' })
      load()
      loadPending()
    } catch (err) {
      toast({ title: 'Approval failed', description: err.message, variant: 'danger' })
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async (studentId) => {
    setActionId(studentId)
    try {
      await rejectStudent(studentId)
      toast({ title: 'Student rejected', variant: 'success' })
      loadPending()
    } catch (err) {
      toast({ title: 'Rejection failed', description: err.message, variant: 'danger' })
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async () => {
    setConfirmLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user_account', { p_user_id: deleteId })
      if (error) throw error
      toast({ title: 'Student deleted', variant: 'success' })
      setDeleteId(null)
      load()
      loadPending()
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

  const handleToggleDisable = async (student) => {
    if (togglingIds.has(student.id)) return

    const nowDisabled = !student.disabled
    setStudents((prev) => toggleDisabledLocal(prev, student.id))
    setTogglingIds((prev) => new Set(prev).add(student.id))

    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ disabled: nowDisabled })
        .eq('id', student.id)
        .select('id, disabled')

      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('Permission denied updating student profile.')
      }

      toast({
        title: nowDisabled ? 'Student disabled' : 'Student enabled',
        description: nowDisabled
          ? `${student.full_name} can no longer log in.`
          : `${student.full_name} can log in again.`,
        variant: 'success',
      })
    } catch (err) {
      setStudents((prev) => toggleDisabledLocal(prev, student.id))
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(student.id); return s })
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'grade', label: 'Grade', render: (r) => gradeLabel(r.grade) },
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
            <Button size="sm" variant="ghost" title="Edit student" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
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
            <Button size="sm" variant="ghost" title="Delete student" onClick={() => setDeleteId(r.id)}>
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        )
      },
    },
  ]

  const pendingColumns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'grade', label: 'Grade', render: (r) => gradeLabel(r.grade) },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="gap-1"
            disabled={actionId === r.id}
            onClick={() => handleApprove(r.id)}
          >
            <Check className="h-4 w-4" />
            {actionId === r.id ? 'Approving...' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={actionId === r.id}
            onClick={() => handleReject(r.id)}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Students
            {pendingStudents.length > 0 && (
              <Badge variant="warning">{pendingStudents.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={pendingColumns}
            data={pendingStudents}
            loading={pendingLoading}
            emptyTitle="No pending students"
            emptyDescription="New registrations via your invitation link will appear here for approval."
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Active Students</h2>
            <p className="text-muted-foreground">
              Students see courses automatically when their grade matches a course grade
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Student
          </Button>
        </div>

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

        <DataTable
          columns={columns}
          data={paginated}
          loading={loading}
          emptyTitle="No active students"
          emptyDescription="Add students or approve pending registrations."
        />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) { setEditing(null) }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Student' : 'Add Student'}</DialogTitle>
          </DialogHeader>

          <StudentForm
            form={form}
            errors={errors}
            isEdit={Boolean(editing)}
            onChange={setForm}
            disabled={saving}
            teacherProfile={teacherProfile}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
