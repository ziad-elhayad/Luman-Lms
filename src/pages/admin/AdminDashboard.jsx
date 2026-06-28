import { useEffect, useState } from 'react'
import { Users, GraduationCap, BookOpen, HelpCircle, Activity } from 'lucide-react'
import { fetchAdminStats } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/shared/StatCard'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { formatDate } from '@/lib/utils'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [courseStats, setCourseStats] = useState([])
  const [growth, setGrowth] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const s = await fetchAdminStats()
      setStats(s)

      const { data: courses } = await supabase.from('courses').select('subject, grade')
      const subjectMap = {}
      courses?.forEach((c) => {
        subjectMap[c.subject] = (subjectMap[c.subject] || 0) + 1
      })
      setCourseStats(Object.entries(subjectMap).map(([name, count]) => ({ name, count })))

      const { data: students } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('role', 'student')
        .order('created_at')

      const monthMap = {}
      students?.forEach((s) => {
        const month = new Date(s.created_at).toLocaleString('default', { month: 'short' })
        monthMap[month] = (monthMap[month] || 0) + 1
      })
      let cumulative = 0
      setGrowth(Object.entries(monthMap).map(([month, count]) => {
        cumulative += count
        return { month, students: cumulative }
      }))

      const { data: recent } = await supabase
        .from('enrollments')
        .select('created_at, student:profiles(full_name), course:courses(title)')
        .order('created_at', { ascending: false })
        .limit(8)
      setActivity(recent || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <SkeletonLoader type="stat" count={5} />

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">Platform overview and analytics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Teachers" value={stats.teachers} icon={Users} />
        <StatCard title="Students" value={stats.students} icon={GraduationCap} />
        <StatCard title="Courses" value={stats.courses} icon={BookOpen} />
        <StatCard title="Quizzes" value={stats.quizzes} icon={HelpCircle} />
        <StatCard title="Active Users" value={stats.activeUsers} icon={Activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Student Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={growth.length ? growth : [{ month: 'Jan', students: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="students" stroke="#0F766E" strokeWidth={2} dot={{ fill: '#0F766E' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Course Statistics</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={courseStats.length ? courseStats : [{ name: 'None', count: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="#14B8A6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length ? (
            <div className="divide-y divide-border">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{a.student?.full_name} enrolled in {a.course?.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
