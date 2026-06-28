import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Users, ClipboardList } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/shared/StatCard'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ courses: 0, students: 0, pending: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('teacher_id', user.id)

      const courseIds = courses?.map((c) => c.id) || []

      const { count: studentCount } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact' })
        .in('course_id', courseIds)

      const { count: pendingCount } = await supabase
        .from('submissions')
        .select('id', { count: 'exact' })
        .eq('status', 'submitted')
        .not('assignment_id', 'is', null)

      const { data: subs } = await supabase
        .from('submissions')
        .select('*, student:profiles(full_name)')
        .eq('status', 'submitted')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({ courses: courses?.length || 0, students: studentCount || 0, pending: pendingCount || 0 })
      setRecent(subs || [])
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <SkeletonLoader type="stat" count={3} />

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Teacher Dashboard</h2>
        <p className="text-muted-foreground">Overview of your teaching activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="My Courses" value={stats.courses} icon={BookOpen} />
        <StatCard title="Total Students" value={stats.students} icon={Users} />
        <StatCard title="Grading Queue" value={stats.pending} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Grading Queue</CardTitle>
          <Link to="/teacher/grades" className="text-sm text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <div className="divide-y divide-border">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.student?.full_name}</p>
                    <p className="text-sm text-muted-foreground">Submitted assignment</p>
                  </div>
                  <Link to="/teacher/grades" className="text-sm text-primary hover:underline">Grade</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No submissions to grade</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
