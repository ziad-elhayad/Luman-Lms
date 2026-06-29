import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getExamSubmission } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function StudentExamResultPage() {
  const { courseId, examId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getExamSubmission(user.id, examId)
      setSubmission(data)
      setLoading(false)
    }
    load()
  }, [user, examId])

  if (loading) return <Skeleton className="h-64 w-full rounded-card" />

  const finalScore = location.state?.finalScore ?? submission?.final_score
  const mcqScore = location.state?.mcqScore ?? submission?.mcq_score
  const status = location.state?.status ?? submission?.status
  const isAutoGraded = status === 'auto_graded'
  const isGraded = status === 'graded' || isAutoGraded

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <Card>
        <CardContent className="p-8 space-y-4">
          {isGraded && finalScore != null ? (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
              <h1 className="text-2xl font-bold">Exam Submitted</h1>
              <p className="text-4xl font-bold text-primary">{finalScore}%</p>
              {mcqScore != null && !isAutoGraded && (
                <p className="text-sm text-muted-foreground">MCQ auto-score: {mcqScore}%</p>
              )}
              {isAutoGraded && (
                <Badge variant="success">Auto-graded (all MCQ)</Badge>
              )}
            </>
          ) : (
            <>
              <Clock className="mx-auto h-16 w-16 text-warning" />
              <h1 className="text-2xl font-bold">Exam Submitted</h1>
              <p className="text-muted-foreground">
                Your teacher will review written answers and assign a final score.
              </p>
              {mcqScore != null && (
                <p className="text-sm">MCQ section: {mcqScore}%</p>
              )}
              <Badge variant="warning">Awaiting teacher review</Badge>
            </>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => navigate(`/student/courses/${courseId}`)}>
        Back to course
      </Button>
    </div>
  )
}
