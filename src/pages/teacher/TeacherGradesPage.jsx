import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/contexts/ToastContext'

export default function TeacherGradesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState({})

  useEffect(() => {
    async function load() {
      const { data: courses } = await supabase.from('courses').select('id').eq('teacher_id', user.id)
      const courseIds = courses?.map((c) => c.id) || []

      const { data: assignments } = await supabase.from('assignments').select('id').in('course_id', courseIds)
      const assignmentIds = assignments?.map((a) => a.id) || []

      const { data } = await supabase
        .from('submissions')
        .select('*, student:profiles(full_name), assignment:assignments(title)')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false })

      setSubmissions(data || [])
      setLoading(false)
    }
    load()
  }, [user])

  const handleGrade = async (id) => {
    const score = grading[id]
    if (score === undefined || score === '') return
    try {
      await supabase.from('submissions').update({ score: parseInt(score), status: 'graded' }).eq('id', id)
      toast({ title: 'Grade saved', variant: 'success' })
      setSubmissions(submissions.map((s) => s.id === id ? { ...s, score: parseInt(score), status: 'graded' } : s))
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    }
  }

  const columns = [
    { key: 'student', label: 'Student', render: (r) => r.student?.full_name },
    { key: 'assignment', label: 'Assignment', render: (r) => r.assignment?.title },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'graded' ? 'success' : 'warning'}>{r.status}</Badge> },
    {
      key: 'score', label: 'Score', render: (r) => r.status === 'graded' ? (
        <span className="font-semibold">{r.score}%</span>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="w-20 h-8"
            min={0}
            max={100}
            value={grading[r.id] || ''}
            onChange={(e) => setGrading({ ...grading, [r.id]: e.target.value })}
          />
          <Button size="sm" onClick={() => handleGrade(r.id)}>Save</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Grades</h2>
        <p className="text-muted-foreground">Review and grade student submissions</p>
      </div>
      <DataTable columns={columns} data={submissions} loading={loading} emptyTitle="No submissions" emptyDescription="No student submissions to grade yet." />
    </div>
  )
}
