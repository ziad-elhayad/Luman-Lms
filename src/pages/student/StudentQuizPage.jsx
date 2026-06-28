import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchQuiz, submitQuiz } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'

export default function StudentQuizPage() {
  const { courseId, quizId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [quiz, setQuiz] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchQuiz(quizId)
      .then((q) => {
        setQuiz(q)
        setTimeLeft(q.time_limit_min * 60)
      })
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'danger' }))
      .finally(() => setLoading(false))
  }, [quizId, toast])

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)

    const questions = quiz.questions
    let correct = 0
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_index) correct++
    })
    const score = Math.round((correct / questions.length) * 100)
    const passed = score >= quiz.passing_score

    try {
      await submitQuiz(user.id, quizId, answers, score, passed)
      navigate(`/student/courses/${courseId}/quiz/${quizId}/result`, {
        state: { score, passed, correct, total: questions.length, questions, answers },
      })
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
      setSubmitting(false)
    }
  }, [quiz, answers, user, quizId, courseId, navigate, toast, submitting])

  useEffect(() => {
    if (!quiz || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [quiz, timeLeft, handleSubmit])

  if (loading) return <Skeleton className="h-96 w-full rounded-card" />
  if (!quiz) return null

  const question = quiz.questions[currentQ]
  const progress = ((currentQ + 1) / quiz.questions.length) * 100
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Question {currentQ + 1} of {quiz.questions.length}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-2 rounded-card px-4 py-2 font-mono text-lg font-bold',
          timeLeft < 60 ? 'bg-danger/10 text-danger' : 'bg-muted/30'
        )}>
          <Clock className="h-5 w-5" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <Progress value={progress} />

      <Card>
        <CardContent className="p-6 space-y-6">
          <h2 className="text-lg font-medium">{question.text}</h2>
          <div className="space-y-3">
            {question.options.map((opt, i) => (
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
        {currentQ < quiz.questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)} disabled={answers[question.id] === undefined}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || answers[question.id] === undefined}>
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        )}
      </div>
    </div>
  )
}
