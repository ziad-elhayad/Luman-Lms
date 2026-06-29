import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ExternalLink, FileText, ClipboardList, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

function ExamReviewDialog({ submission, questions, open, onClose, onGraded }) {
  const { toast } = useToast()
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (submission) {
      setScore(submission.final_score != null ? String(submission.final_score) : '')
    }
  }, [submission])

  if (!submission) return null

  const answers = submission.answers || {}
  const needsManualGrade = submission.status === 'submitted'

  const handleSave = async () => {
    const val = parseInt(score, 10)
    if (Number.isNaN(val) || val < 0 || val > 100) {
      toast({ title: 'Enter a score between 0 and 100', variant: 'danger' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('exam_submissions')
        .update({ final_score: val, status: 'graded' })
        .eq('id', submission.id)
      if (error) throw error
      toast({ title: 'Exam graded', variant: 'success' })
      onGraded(submission.id, val)
      onClose()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {submission.student?.full_name} — {submission.exam?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {submission.mcq_score != null && (
            <p className="text-sm text-muted-foreground">
              Auto MCQ score: <strong>{submission.mcq_score}%</strong>
            </p>
          )}

          {questions.map((q, i) => {
            const ans = answers[q.id]
            const isMcq = q.type === 'mcq'
            const isCorrect = isMcq && ans === q.correct_index

            return (
              <div key={q.id} className="rounded-control border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">Q{i + 1}. {q.text || '(Image question)'}</p>
                  <Badge variant={isMcq ? (isCorrect ? 'success' : 'danger') : 'secondary'}>
                    {isMcq ? (isCorrect ? 'Correct' : 'Wrong') : 'Written'}
                  </Badge>
                </div>
                {q.image_url && (
                  <img src={q.image_url} alt="" className="max-h-32 rounded-control object-contain" />
                )}
                {isMcq ? (
                  <p className="text-sm">
                    Answer: <strong>{q.options?.[ans] ?? '—'}</strong>
                    {!isCorrect && (
                      <span className="text-muted-foreground"> (correct: {q.options?.[q.correct_index]})</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap rounded-control bg-muted/20 p-3">
                    {ans || <em className="text-muted-foreground">No answer</em>}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {needsManualGrade && (
          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex w-full items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                className="w-24"
                placeholder="Score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">% final score</span>
              <Button onClick={handleSave} disabled={saving} className="ml-auto">
                {saving ? 'Saving...' : 'Save Grade'}
              </Button>
            </div>
          </DialogFooter>
        )}

        {!needsManualGrade && submission.final_score != null && (
          <p className="text-center font-semibold text-primary">Final score: {submission.final_score}%</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function TeacherGradesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [assignmentSubs, setAssignmentSubs] = useState([])
  const [examSubs, setExamSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState({})
  const [reviewSub, setReviewSub] = useState(null)
  const [reviewQuestions, setReviewQuestions] = useState([])

  const load = async () => {
    setLoading(true)
    const { data: courses } = await supabase.from('courses').select('id').eq('teacher_id', user.id)
    const courseIds = courses?.map((c) => c.id) || []

    const { data: assignments } = await supabase.from('assignments').select('id').in('course_id', courseIds)
    const assignmentIds = assignments?.map((a) => a.id) || []

    const { data: aSubs } = await supabase
      .from('submissions')
      .select('*, student:profiles(full_name), assignment:assignments(title, course:courses(title))')
      .in('assignment_id', assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])
      .not('assignment_id', 'is', null)
      .order('created_at', { ascending: false })

    const { data: exams } = await supabase.from('exams').select('id').eq('teacher_id', user.id)
    const examIds = exams?.map((e) => e.id) || []

    const { data: eSubs } = await supabase
      .from('exam_submissions')
      .select('*, student:profiles(full_name), exam:exams(title, course:courses(title))')
      .in('exam_id', examIds.length ? examIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: false })

    setAssignmentSubs(aSubs || [])
    setExamSubs(eSubs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleAssignmentGrade = async (id) => {
    const score = grading[id]
    if (score === undefined || score === '') return
    try {
      await supabase.from('submissions').update({ score: parseInt(score, 10), status: 'graded' }).eq('id', id)
      toast({ title: 'Grade saved', variant: 'success' })
      setAssignmentSubs(assignmentSubs.map((s) =>
        s.id === id ? { ...s, score: parseInt(score, 10), status: 'graded' } : s
      ))
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    }
  }

  const openExamReview = async (sub) => {
    const { data: questions, error } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', sub.exam_id)
      .order('order_no')
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'danger' })
      return
    }
    setReviewQuestions(questions || [])
    setReviewSub(sub)
  }

  const assignmentColumns = [
    { key: 'student', label: 'Student', render: (r) => r.student?.full_name },
    { key: 'assignment', label: 'Assignment', render: (r) => r.assignment?.title },
    { key: 'course', label: 'Course', render: (r) => r.assignment?.course?.title || '—' },
    {
      key: 'file', label: 'File',
      render: (r) => r.file_url ? (
        <Button size="sm" variant="outline" asChild>
          <a href={r.file_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> View file
          </a>
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">No file</span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'graded' ? 'success' : r.status === 'submitted' ? 'secondary' : 'warning'}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'score', label: 'Score',
      render: (r) => r.status === 'graded' ? (
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
          <Button size="sm" onClick={() => handleAssignmentGrade(r.id)}>Save</Button>
        </div>
      ),
    },
  ]

  const examColumns = [
    { key: 'student', label: 'Student', render: (r) => r.student?.full_name },
    { key: 'exam', label: 'Exam', render: (r) => r.exam?.title },
    { key: 'course', label: 'Course', render: (r) => r.exam?.course?.title || '—' },
    {
      key: 'mcq', label: 'MCQ',
      render: (r) => r.mcq_score != null ? (
        <span className="flex items-center gap-1 text-sm">
          {r.status === 'auto_graded' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : null}
          {r.mcq_score}%
        </span>
      ) : '—',
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'graded' || r.status === 'auto_graded' ? 'success' : 'warning'}>
          {r.status === 'auto_graded' ? 'auto graded' : r.status}
        </Badge>
      ),
    },
    {
      key: 'score', label: 'Final Score',
      render: (r) => r.final_score != null ? (
        <span className="font-semibold">{r.final_score}%</span>
      ) : (
        <span className="text-muted-foreground text-sm">Pending</span>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => openExamReview(r)}>
          Review answers
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Grades</h2>
        <p className="text-muted-foreground">Review assignment files and grade exam submissions</p>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5">
            <FileText className="h-4 w-4" /> Assignments
          </TabsTrigger>
          <TabsTrigger value="exams" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Exams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <DataTable
            columns={assignmentColumns}
            data={assignmentSubs}
            loading={loading}
            emptyTitle="No assignment submissions"
            emptyDescription="Student uploads will appear here."
          />
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <DataTable
            columns={examColumns}
            data={examSubs}
            loading={loading}
            emptyTitle="No exam submissions"
            emptyDescription="Submissions appear after students complete course exams."
          />
        </TabsContent>
      </Tabs>

      <ExamReviewDialog
        submission={reviewSub}
        questions={reviewQuestions}
        open={!!reviewSub}
        onClose={() => setReviewSub(null)}
        onGraded={(id, score) => {
          setExamSubs(examSubs.map((s) =>
            s.id === id ? { ...s, final_score: score, status: 'graded' } : s
          ))
        }}
      />
    </div>
  )
}
