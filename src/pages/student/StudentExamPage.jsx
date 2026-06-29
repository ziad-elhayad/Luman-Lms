import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchExamForStudent, submitExamSubmission } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'

function examIsLive(exam) {
  const now = new Date()
  return now >= new Date(exam.start_date) && now <= new Date(exam.end_date)
}

export default function StudentExamPage() {
  const { courseId, examId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchExamForStudent(examId, user.id)
        if (data.submission) {
          navigate(`/student/courses/${courseId}/exam/${examId}/result`, { replace: true })
          return
        }
        if (!examIsLive(data.exam)) {
          toast({
            title: 'Exam not available',
            description: 'This exam is not open right now.',
            variant: 'danger',
          })
          navigate(`/student/courses/${courseId}`)
          return
        }
        setExam(data.exam)
        setQuestions(data.questions)
      } catch (err) {
        toast({ title: 'Error', description: err.message, variant: 'danger' })
        navigate(`/student/courses/${courseId}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [examId, user, courseId, navigate, toast])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const result = await submitExamSubmission(user.id, examId, answers)
      navigate(`/student/courses/${courseId}/exam/${examId}/result`, {
        state: {
          finalScore: result.finalScore,
          mcqScore: result.mcqScore,
          status: result.status,
        },
      })
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
      setSubmitting(false)
    }
  }

  if (loading) return <Skeleton className="h-96 w-full rounded-card" />
  if (!exam || !questions.length) return null

  const question = questions[currentQ]
  const progress = ((currentQ + 1) / questions.length) * 100
  const isMcq = question.type === 'mcq'
  const hasAnswer = isMcq
    ? answers[question.id] !== undefined
    : (answers[question.id] || '').trim().length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">{exam.title}</h1>
        <p className="text-sm text-muted-foreground">
          Question {currentQ + 1} of {questions.length}
        </p>
      </div>

      <Progress value={progress} />

      <Card>
        <CardContent className="p-6 space-y-6">
          {question.text && <h2 className="text-lg font-medium">{question.text}</h2>}
          {question.image_url && (
            <img src={question.image_url} alt="" className="max-h-64 rounded-control object-contain" />
          )}

          {isMcq ? (
            <div className="space-y-3">
              {(question.options || []).map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [question.id]: i })}
                  className={cn(
                    'w-full rounded-control border p-4 text-left text-sm transition-colors hover:bg-muted/20',
                    answers[question.id] === i
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'border-border'
                  )}
                >
                  <span className="mr-3 font-medium text-primary">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[120px] rounded-control border border-input bg-background px-3 py-2 text-sm"
              placeholder="Type your answer..."
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentQ === 0}
          onClick={() => setCurrentQ(currentQ - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)} disabled={!hasAnswer}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !hasAnswer}>
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </Button>
        )}
      </div>
    </div>
  )
}
