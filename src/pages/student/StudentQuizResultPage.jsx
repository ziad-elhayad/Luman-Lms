import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function StudentQuizResultPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()

  if (!state) {
    navigate(`/student/courses/${courseId}`)
    return null
  }

  const { score, passed, correct, total, questions, answers } = state

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className={cn('text-center', passed ? 'border-success/30' : 'border-danger/30')}>
        <CardContent className="p-8">
          {passed ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          ) : (
            <XCircle className="mx-auto h-16 w-16 text-danger" />
          )}
          <h1 className="mt-4 text-2xl font-bold">
            {passed ? 'Congratulations!' : 'Keep Trying'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {passed ? 'You passed the quiz!' : 'You did not reach the passing score.'}
          </p>
          <div className="mt-6 text-4xl font-bold text-primary">{score}%</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {correct} of {total} correct
          </p>
          <Badge variant={passed ? 'success' : 'danger'} className="mt-4">
            {passed ? 'Passed' : 'Failed'}
          </Badge>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Review Answers</h2>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const userAnswer = answers[q.id]
            const isCorrect = userAnswer === q.correct_index
            return (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                      isCorrect ? 'bg-success' : 'bg-danger'
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{q.text}</p>
                      <p className="mt-2 text-sm">
                        Your answer: <span className={isCorrect ? 'text-success' : 'text-danger'}>
                          {q.options[userAnswer]}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="mt-1 text-sm text-success">
                          Correct: {q.options[q.correct_index]}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <Button onClick={() => navigate(`/student/courses/${courseId}`)}>
        <ArrowLeft className="h-4 w-4" />
        Back to Course
      </Button>
    </div>
  )
}
