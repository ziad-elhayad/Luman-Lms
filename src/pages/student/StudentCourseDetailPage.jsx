import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCourseWithDetails, fetchCourseExams, getExamSubmission } from '@/lib/api'
import { SessionRow } from '@/components/shared/SessionRow'
import { QuizCard } from '@/components/shared/QuizCard'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CourseThumbnail } from '@/components/shared/CourseThumbnail'
import { useToast } from '@/contexts/ToastContext'
import { getQuizAttempts } from '@/lib/api'

export default function StudentCourseDetailPage() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [exams, setExams] = useState([])
  const [examSubmissions, setExamSubmissions] = useState({})
  const [quizAttempts, setQuizAttempts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchCourseWithDetails(courseId, user.id)
        setData(result)

        const courseExams = await fetchCourseExams(courseId)
        setExams(courseExams)

        const subMap = {}
        for (const exam of courseExams) {
          const sub = await getExamSubmission(user.id, exam.id)
          if (sub) subMap[exam.id] = sub
        }
        setExamSubmissions(subMap)

        const attempts = {}
        for (const quiz of result.course.quizzes || []) {
          attempts[quiz.id] = await getQuizAttempts(user.id, quiz.id)
        }
        setQuizAttempts(attempts)
      } catch (err) {
        toast({ title: 'Error', description: err.message, variant: 'danger' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId, user, toast])

  if (loading) return <SkeletonLoader count={3} />
  if (!data) return null

  const { course, enrollment, sessionProgress } = data
  const completedSet = new Set(sessionProgress.filter((p) => p.completed).map((p) => p.session_id))

  const isSessionLocked = (session, index) => {
    if (!session.locked) return false
    if (index === 0) return false
    const prev = course.sessions[index - 1]
    return !completedSet.has(prev?.id)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/student/courses')}>
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </Button>

      <div className="relative overflow-hidden rounded-card">
        <CourseThumbnail course={course} aspectClass="aspect-[3/1]" iconClassName="h-16 w-16" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 p-6 text-white">
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-white/80">
            <User className="h-4 w-4" />
            {course.teacher?.full_name}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Course Progress</span>
            <span className="font-semibold">{enrollment?.progress || 0}%</span>
          </div>
          <Progress value={enrollment?.progress || 0} />
        </CardContent>
      </Card>

      {course.description && (
        <p className="text-muted-foreground">{course.description}</p>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">Sessions</h2>
        <div className="space-y-3">
          {course.sessions?.map((session, i) => (
            <SessionRow
              key={session.id}
              session={session}
              completed={completedSet.has(session.id)}
              locked={isSessionLocked(session, i)}
              onWatch={() => navigate(`/student/courses/${courseId}/lesson/${session.id}`)}
            />
          ))}
        </div>
      </section>

      {course.quizzes?.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Quizzes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {course.quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                questionCount={quiz.questions?.length || 0}
                attemptsLeft={quiz.attempts - (quizAttempts[quiz.id] || 0)}
                onStart={() => navigate(`/student/courses/${courseId}/quiz/${quiz.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {exams.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Exams</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((exam) => {
              const now = new Date()
              const start = new Date(exam.start_date)
              const end = new Date(exam.end_date)
              const live = now >= start && now <= end
              const ended = now > end
              const submitted = examSubmissions[exam.id]
              const qCount = exam.exam_questions?.[0]?.count ?? 0

              return (
                <Card key={exam.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{exam.title}</CardTitle>
                      <Badge variant={submitted ? 'success' : live ? 'default' : ended ? 'danger' : 'secondary'}>
                        {submitted ? 'Done' : live ? 'Live' : ended ? 'Ended' : 'Upcoming'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{qCount} questions</p>
                    {submitted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/student/courses/${courseId}/exam/${exam.id}/result`)}
                      >
                        View result
                      </Button>
                    ) : live ? (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/student/courses/${courseId}/exam/${exam.id}`)}
                      >
                        Start exam
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {ended ? 'Exam window has closed.' : `Opens ${start.toLocaleString()}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {course.assignments?.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Assignments</h2>
          <div className="space-y-3">
            {course.assignments.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/student/assignments')}
                  >
                    View Assignment
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
