import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchTeacherCourses, syncStudentEnrollments } from '@/lib/api'
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
  educationLevel: 'middle',
  gradeYear: '1',
  subjects: [],
  courseIds: [],
  password: '',
  confirmPassword: '',
}

function toggleDisabledLocal(list, id) {
  return list.map((s) => s.id === id ? { ...s, disabled: !s.disabled } : s)
}

export default function TeacherStudentsPage() {
  const { toast } = useToast()
  const { profile: teacherProfile } = useAuth()
  const teacherId = teacherProfile?.id

  const [students, setStudents] = useState([])
  const [teacherCourses, setTeacherCourses] = useState([])
  const [enrollmentCounts, setEnrollmentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [togglingIds, setTogglingIds] = useState(new Set())

  const loadCourses = async () => {
    if (!teacherId) return
    const data = await fetchTeacherCourses(teacherId)
    setTeacherCourses(data || [])
  }

  const load = async () => {
    if (!teacherId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('teacher_id', teacherId)
      .order('full_name')

    if (error) {
      toast({ title: 'Error loading students', description: error.message, variant: 'danger' })
    } else {
      setStudents(data || [])
      const studentIds = data?.map((s) => s.id) || []
      if (studentIds.length) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .in('student_id', studentIds)
        const counts = {}
        enrollments?.forEach((e) => {
          counts[e.student_id] = (counts[e.student_id] || 0) + 1
        })
        setEnrollmentCounts(counts)
      } else {
        setEnrollmentCounts({})
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCourses()
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
    setForm(EMPTY_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = async (student) => {
    setEditing(student)
    setErrors({})
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', student.id)

    setForm({
      firstName: student.first_name || student.full_name?.split(' ')[0] || '',
      lastName: student.last_name || student.full_name?.split(' ').slice(1).join(' ') || '',
      email: student.email || '',
      phone: student.phone || '',
      educationLevel: student.education_level || 'middle',
      gradeYear: student.grade ? String(student.grade) : '1',
      subjects: Array.isArray(student.subjects) ? student.subjects : [],
      courseIds: enrollments?.map((e) => e.course_id) || [],
      password: '',
      confirmPassword: '',
    })
    setDialogOpen(true)
  }

  const validateForm = () => {
    const newErrors = {}
    if (!form.firstName?.trim()) newErrors.firstName = 'First name is required.'
    if (!form.lastName?.trim()) newErrors.lastName = 'Last name is required.'
    if (!form.email?.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Email is invalid.'
    }
    if (!form.courseIds?.length) newErrors.courseIds = 'Assign at least one course.'
    if (!form.educationLevel) newErrors.educationLevel = 'Education level is required.'
    if (!form.gradeYear) newErrors.gradeYear = 'Grade year is required.'
    if (!form.subjects?.length) newErrors.subjects = 'Select at least one subject.'

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

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`

      if (editing) {
        const updates = {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          full_name: fullName,
          email: form.email.trim().toLowerCase(),
          phone: form.phone?.trim() || null,
          teacher_id: teacherId,
          grade: Number(form.gradeYear),
          education_level: form.educationLevel,
          subjects: form.subjects || [],
        }
        const { error } = await supabase.from('profiles').update(updates).eq('id', editing.id)
        if (error) throw error

        if (form.email.trim().toLowerCase() !== editing.email?.toLowerCase()) {
          const { error: authError } = await supabase.rpc('update_user_email_direct', {
            p_user_id: editing.id,
            p_email: form.email.trim().toLowerCase(),
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

        await syncStudentEnrollments(editing.id, form.courseIds)
        toast({ title: 'Student updated', variant: 'success' })
      } else {
        const user = await createStudent({
          email: form.email.trim(),
          password: form.password || 'password123',
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          fullName,
          phone: form.phone?.trim() || null,
          teacherId,
          grade: Number(form.gradeYear),
          educationLevel: form.educationLevel,
          subjects: form.subjects || [],
        })

        await syncStudentEnrollments(user.id, form.courseIds)
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
      const errorMsg = err?.message || err?.error_description || JSON.stringify(err)
      toast({ title: 'Error', description: errorMsg || 'An unknown error occurred', variant: 'danger' })
    } finally {
      setSaving(false)
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
      setStudents((prev) => toggleDisabledLocal(prev, student.id))
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(student.id); return s })
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    {
      key: 'courses', label: 'Courses',
      render: (r) => (
        <Badge variant="secondary">{enrollmentCounts[r.id] || 0} assigned</Badge>
      ),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Students</h2>
          <p className="text-muted-foreground">Add students and assign your courses to them</p>
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
        emptyTitle="No students"
        emptyDescription="Add students and assign courses to get started."
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
            teacherCourses={teacherCourses}
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
