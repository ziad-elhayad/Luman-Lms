import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { StudentForm } from '@/components/shared/StudentForm'
import { getPublicTeacherBySlug, joinTeacherBySlug } from '@/lib/invitation'
import { registerStudent } from '@/lib/createUser'
import {
  EMPTY_STUDENT_FORM,
  validateStudentForm,
  studentFormToPayload,
} from '@/lib/studentForm'
import { useToast } from '@/contexts/ToastContext'

function NoInvitationState() {
  return (
    <AuthPageShell title="Registration Unavailable" subtitle="You need a teacher invitation to create an account.">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <p className="text-muted-foreground">
            Registration is only available through your teacher&apos;s invitation link.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const teacherSlug = searchParams.get('teacher') || ''
  const navigate = useNavigate()
  const { toast } = useToast()

  const [teacher, setTeacher] = useState(null)
  const [teacherLoading, setTeacherLoading] = useState(!!teacherSlug)
  const [teacherInvalid, setTeacherInvalid] = useState(false)

  const [form, setForm] = useState(EMPTY_STUDENT_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!teacherSlug) {
      setTeacherLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setTeacherLoading(true)
      try {
        const data = await getPublicTeacherBySlug(teacherSlug)
        if (cancelled) return
        if (!data) setTeacherInvalid(true)
        else setTeacher(data)
      } catch {
        if (!cancelled) setTeacherInvalid(true)
      } finally {
        if (!cancelled) setTeacherLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teacherSlug])

  if (!teacherSlug) {
    return <NoInvitationState />
  }

  if (teacherLoading) {
    return (
      <AuthPageShell title="Create Your Account" subtitle="Setting up registration...">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </AuthPageShell>
    )
  }

  if (teacherInvalid) {
    return (
      <AuthPageShell title="Invalid Invitation" subtitle="This teacher invitation link is not valid.">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-muted-foreground">Please ask your teacher for a new invitation link.</p>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </AuthPageShell>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validateStudentForm(form, {
      requirePassword: true,
      requireCourses: false,
    })
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setLoading(true)
    try {
      const payload = studentFormToPayload(form)
      await registerStudent(payload)
      await joinTeacherBySlug(teacherSlug)

      toast({
        title: 'Account created!',
        description: `Welcome! You've joined ${teacher?.full_name || 'your teacher'}.`,
        variant: 'success',
      })
      navigate('/student/pending')
    } catch (err) {
      const isUnconfirmed =
        err.code === 'email_confirmation_required' ||
        err.message?.toLowerCase().includes('email not confirmed') ||
        err.originalError?.code === 'email_not_confirmed'
      toast({
        title: 'Registration failed',
        description: isUnconfirmed
          ? 'Please confirm your email, or disable email confirmation in Supabase for development.'
          : err.message,
        variant: 'danger',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      title="Create Your Account"
      subtitle={teacher ? `Join ${teacher.full_name} on Lumen LMS` : 'Complete your registration'}
      maxWidth="max-w-lg"
    >
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>
            {teacher
              ? `You'll be automatically connected to ${teacher.full_name}.`
              : 'Fill in your details to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <StudentForm
              form={form}
              errors={errors}
              onChange={setForm}
              disabled={loading}
              teacherProfile={teacher}
              showCourseAssignment={false}
              showPassword
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to={`/login?teacher=${encodeURIComponent(teacherSlug)}`}
              className="text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
