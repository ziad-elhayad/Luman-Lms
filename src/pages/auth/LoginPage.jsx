import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { profile } = await signIn(email, password)
      toast({ title: 'Welcome back!', description: `Signed in as ${profile?.full_name}`, variant: 'success' })
      const routes = { super_admin: '/admin', teacher: '/teacher', student: '/student' }
      navigate(routes[profile?.role] || '/login')
    } catch (err) {
      toast({ title: 'Login failed', description: err.message, variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-primary text-white">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Lumen LMS</h1>
          <p className="mt-2 text-muted-foreground">Sign in to continue learning</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
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
      </div>
    </div>
  )
}
