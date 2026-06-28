import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchStudentCourses } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { CourseCard } from '@/components/shared/CourseCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { EmptyState } from '@/components/shared/EmptyState'
import { BookOpen } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function StudentCoursesPage() {
  const { profile, user, loading: authLoading } = useAuth()
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (authLoading) return

    if (!profile?.grade) {
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      try {
        const data = await fetchStudentCourses(profile.grade)
        setCourses(data || [])

        const { data: enr } = await supabase
          .from('enrollments')
          .select('course_id, progress')
          .eq('student_id', user.id)
        const map = {}
        enr?.forEach((e) => { map[e.course_id] = e.progress })
        setEnrollments(map)
      } catch (err) {
        toast({ title: 'Error', description: err.message, variant: 'danger' })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [profile, user, authLoading, toast])

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subject?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Courses</h2>
          <p className="text-muted-foreground">Grade {profile?.grade} courses only</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search courses..." className="sm:w-64" />
      </div>

      {loading ? (
        <SkeletonLoader count={6} />
      ) : !profile?.grade ? (
        <EmptyState icon={BookOpen} title="Grade not set" description="Your profile needs a grade before courses can be shown." />
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              to={`/student/courses/${course.id}`}
              teacherName={course.teacher?.full_name}
              studentCount={course.enrollments?.[0]?.count}
              sessionCount={course.sessions?.[0]?.count}
              progress={enrollments[course.id] || 0}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          description={`No Grade ${profile?.grade} courses match your search.`}
        />
      )}
    </div>
  )
}
