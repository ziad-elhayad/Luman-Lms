import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Calendar, Clock } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_SIZE = 10

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function examStatus(exam) {
  const now = new Date()
  const start = new Date(exam.start_date)
  const end = new Date(exam.end_date)
  if (now < start) return { label: 'Upcoming', variant: 'secondary' }
  if (now > end)   return { label: 'Ended',    variant: 'danger' }
  return               { label: 'Live',     variant: 'success' }
}

export default function TeacherExamsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('exams')
      .select('*, exam_questions(count), course:courses(title)')
      .eq('teacher_id', user.id)
      .order('start_date', { ascending: false })
    if (error) toast({ title: 'Error loading exams', description: error.message, variant: 'danger' })
    setExams(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = exams.filter((e) =>
    e.title?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('exams').delete().eq('id', deleteId)
      if (error) throw error
      toast({ title: 'Exam deleted', variant: 'success' })
      setDeleteId(null)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'title', label: 'Title',
      render: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: 'course', label: 'Course',
      render: (r) => r.course?.title || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'start', label: 'Start',
      render: (r) => (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> {formatDateTime(r.start_date)}
        </span>
      ),
    },
    {
      key: 'end', label: 'End',
      render: (r) => (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {formatDateTime(r.end_date)}
        </span>
      ),
    },
    {
      key: 'questions', label: 'Questions',
      render: (r) => {
        const count = r.exam_questions?.[0]?.count ?? '—'
        return <Badge variant="secondary">{count} Q</Badge>
      },
    },
    {
      key: 'status', label: 'Status',
      render: (r) => {
        const s = examStatus(r)
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" title="Edit exam" onClick={() => navigate(`/teacher/exams/${r.id}/edit`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" title="Delete exam" onClick={() => setDeleteId(r.id)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exams</h2>
          <p className="text-muted-foreground">Create and manage timed exams</p>
        </div>
        <Button onClick={() => navigate('/teacher/exams/new')}>
          <Plus className="h-4 w-4" /> New Exam
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1) }}
        placeholder="Search exams..."
        className="max-w-sm"
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyTitle="No exams yet"
        emptyDescription="Click 'New Exam' to create your first exam."
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete exam?"
        description="This will permanently delete the exam and all its questions."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
