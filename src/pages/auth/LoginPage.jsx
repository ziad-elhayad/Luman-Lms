import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { joinTeacherBySlug } from '@/lib/invitation'
import { studentDashboardRoute } from '@/lib/studentStatus'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const teacherSlug = searchParams.get('teacher') || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { profile } = await signIn(email, password)
      toast({ title: 'Welcome back!', description: `Signed in as ${profile?.full_name}`, variant: 'success' })

      if (teacherSlug && profile?.role === 'student') {
        try {
          await joinTeacherBySlug(teacherSlug)
          toast({ title: 'Connected to your teacher', variant: 'success' })
        } catch (joinErr) {
          toast({ title: 'Could not join teacher', description: joinErr.message, variant: 'danger' })
        }
      }

      const routes = { super_admin: '/admin', teacher: '/teacher', student: '/student' }
      if (profile?.role === 'student') {
        navigate(studentDashboardRoute(profile))
      } else {
        navigate(routes[profile?.role] || '/login')
      }
    } catch (err) {
      const isUnconfirmed =
        err.message?.toLowerCase().includes('email not confirmed') ||
        err.code === 'email_not_confirmed'
      toast({
        title: 'Login failed',
        description: isUnconfirmed
          ? 'Email not confirmed. In Supabase: Authentication → Users → open the user → Confirm email. Or run supabase/seeds.sql'
          : err.message,
        variant: 'danger',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell title="Welcome to Lumen LMS" subtitle="Sign in to continue learning">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {teacherSlug
              ? 'Sign in to connect with your teacher'
              : 'Enter your credentials to access your dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 rounded-control border border-border bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Demo accounts (password: password123)</p>
            <p><strong>Admin CRUD:</strong> superadmin@lumen.edu → Teachers</p>
            <p><strong>Teacher CRUD:</strong> teacher1@lumen.edu → My Courses</p>
            <p><strong>Student view:</strong> student1@lumen.edu (read-only)</p>
          </div>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
