import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UserPlus, LogIn, ArrowLeft, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { getPublicTeacherBySlug, joinTeacherBySlug } from '@/lib/invitation'
import { formatSubjectsList } from '@/lib/teacherSubjects'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

function JoinPageSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 p-8">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="w-full space-y-3 text-center">
          <Skeleton className="mx-auto h-7 w-48" />
          <Skeleton className="mx-auto h-4 w-32" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 flex-1" />
        </div>
      </CardContent>
    </Card>
  )
}

function TeacherNotFound() {
  return (
    <AuthPageShell title="Teacher Not Found" subtitle="This invitation link is invalid or the teacher is no longer available.">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground">
              The teacher you are looking for could not be found. Please check the link and try again, or contact your teacher for a new invitation.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}

export default function JoinPage() {
  const { teacherSlug } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isAuthenticated, profile, loading: authLoading } = useAuth()
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const data = await getPublicTeacherBySlug(teacherSlug)
        if (cancelled) return
        if (!data) {
          setNotFound(true)
          setTeacher(null)
        } else {
          setTeacher(data)
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teacherSlug])

  const initials = teacher?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const handleExistingAccount = async () => {
    if (isAuthenticated && profile?.role === 'student') {
      setJoining(true)
      try {
        await joinTeacherBySlug(teacherSlug)
        toast({ title: 'Connected to your teacher', variant: 'success' })
        navigate('/student')
      } catch (err) {
        toast({ title: 'Could not join teacher', description: err.message, variant: 'danger' })
      } finally {
        setJoining(false)
      }
      return
    }
    navigate(`/login?teacher=${encodeURIComponent(teacherSlug)}`)
  }

  if (loading || authLoading) {
    return (
      <AuthPageShell title="Join Your Teacher" subtitle="Loading teacher profile...">
        <JoinPageSkeleton />
      </AuthPageShell>
    )
  }

  if (notFound || !teacher) {
    return <TeacherNotFound />
  }

  return (
    <AuthPageShell
      title="You're invited!"
      subtitle="Join your teacher on Lumen LMS"
      maxWidth="max-w-lg"
    >
      <Card className="overflow-hidden shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <Avatar className="h-24 w-24 ring-4 ring-primary/10">
            <AvatarImage src={teacher.avatar_url} alt={teacher.full_name} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{teacher.full_name}</h2>
            {teacher.subjects?.length > 0 && (
              <p className="text-sm font-medium text-primary">{formatSubjectsList(teacher.subjects)}</p>
            )}
            {teacher.bio && (
              <p className="text-sm text-muted-foreground max-w-sm">{teacher.bio}</p>
            )}
            {teacher.academy && (
              <p className="text-xs text-muted-foreground">{teacher.academy}</p>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1 gap-2"
              size="lg"
              onClick={() => navigate(`/register?teacher=${encodeURIComponent(teacherSlug)}`)}
              disabled={isAuthenticated && profile?.role !== 'student'}
            >
              <UserPlus className="h-5 w-5" />
              Create Account
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              size="lg"
              onClick={handleExistingAccount}
              disabled={joining || (isAuthenticated && profile?.role && profile.role !== 'student')}
            >
              <LogIn className="h-5 w-5" />
              {joining ? 'Connecting...' : 'I Already Have an Account'}
            </Button>
          </div>

          {isAuthenticated && profile?.role && profile.role !== 'student' && (
            <p className="text-xs text-muted-foreground text-center">
              You are signed in as a {profile.role.replace('_', ' ')}. Please sign out to register as a student.
            </p>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
