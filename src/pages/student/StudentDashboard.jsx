import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileText, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { CourseCard } from '@/components/shared/CourseCard'
import { StatCard } from '@/components/shared/StatCard'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default function StudentDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user || !profile) {
      setLoading(false)
      return
    }

    if (!profile.grade) {
      setCourses([])
      setAssignments([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select(`
            *,
            teacher:profiles!courses_teacher_id_fkey(full_name),
            sessions(count),
            enrollments!inner(progress)
          `)
          .eq('grade', profile.grade)
          .eq('enrollments.student_id', user.id)
          .limit(4)

        const { data: gradeCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('grade', profile.grade)

        const courseIds = gradeCourses?.map((c) => c.id) || []

        let assignmentData = []
        if (courseIds.length) {
          const { data } = await supabase
            .from('assignments')
            .select('*, course:courses(title)')
            .in('course_id', courseIds)
            .gte('due_date', new Date().toISOString())
            .order('due_date')
            .limit(5)
          assignmentData = data || []
        }

        setCourses(courseData || [])
        setAssignments(assignmentData)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [profile, user, authLoading])

  if (authLoading || loading) return <SkeletonLoader type="stat" count={3} />

  if (!profile?.grade) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Grade not set"
        description="Your student profile is missing a grade. Ask your teacher or admin to assign one, or run the seed script in Supabase."
      />
    )
  }

  const avgProgress = courses.length
    ? Math.round(courses.reduce((sum, c) => sum + (c.enrollments?.[0]?.progress || 0), 0) / courses.length)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Welcome back, {profile?.full_name?.split(' ')[0]}!</h2>
        <p className="text-muted-foreground">Continue your learning journey</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Enrolled Courses" value={courses.length} icon={BookOpen} />
        <StatCard title="Avg. Progress" value={`${avgProgress}%`} icon={TrendingUp} />
        <StatCard title="Upcoming Assignments" value={assignments.length} icon={FileText} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Continue Learning</h3>
          <Link to="/student/courses" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {courses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                to={`/student/courses/${course.id}`}
                teacherName={course.teacher?.full_name}
                studentCount={course.enrollments?.length}
                sessionCount={course.sessions?.[0]?.count}
                progress={course.enrollments?.[0]?.progress || 0}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No enrolled courses yet for Grade {profile.grade}. Run <code className="text-sm">SELECT seed_lumen_data();</code> in Supabase if you haven&apos;t seeded the database.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold">Upcoming Assignments</h3>
        <Card>
          <CardContent className="p-0">
            {assignments.length ? (
              <div className="divide-y divide-border">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.course?.title}</p>
                    </div>
                    <Badge variant="warning">Due {formatDate(a.due_date)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-muted-foreground">No upcoming assignments</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
