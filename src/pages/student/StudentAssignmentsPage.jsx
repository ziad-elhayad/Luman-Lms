import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchStudentEnrolledCourseIds } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildSubmissionPath(userId, assignmentId, fileName) {
  return `${userId}/assignments/${assignmentId}/${Date.now()}-${sanitizeFileName(fileName)}`
}

export default function StudentAssignmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)

  useEffect(() => {
    if (authLoading || !user) return

    async function load() {
      setLoading(true)
      try {
        const courseIds = await fetchStudentEnrolledCourseIds(user.id)

        const { data: assigns } = await supabase
          .from('assignments')
          .select('*, course:courses(title)')
          .in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000'])
          .order('due_date')

        const { data: subs } = await supabase
          .from('submissions')
          .select('*')
          .eq('student_id', user.id)
          .not('assignment_id', 'is', null)

        const subMap = {}
        subs?.forEach((s) => { subMap[s.assignment_id] = s })
        setAssignments(assigns || [])
        setSubmissions(subMap)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, authLoading])

  const handleUpload = async (assignmentId, file) => {
    if (!file) return
    setUploading(assignmentId)
    try {
      const path = buildSubmissionPath(user.id, assignmentId, file.name)
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        const msg = uploadError.message || ''
        if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
          throw new Error(
            'Storage bucket "submissions" is missing. In Supabase go to Storage → New bucket → name it submissions (public), or run supabase/patches/create_submissions_bucket.sql in the SQL Editor.'
          )
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(path)

      const existing = submissions[assignmentId]
      if (existing) {
        await supabase.from('submissions').update({ file_url: publicUrl, status: 'submitted' }).eq('id', existing.id)
      } else {
        await supabase.from('submissions').insert({
          student_id: user.id,
          assignment_id: assignmentId,
          file_url: publicUrl,
          status: 'submitted',
        })
      }

      toast({ title: 'Submitted!', description: 'Your assignment has been uploaded.', variant: 'success' })
      setSubmissions({ ...submissions, [assignmentId]: { ...submissions[assignmentId], status: 'submitted', file_url: publicUrl } })
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'danger' })
    } finally {
      setUploading(null)
    }
  }

  if (loading) return <SkeletonLoader count={3} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Assignments</h2>
        <p className="text-muted-foreground">Upload your completed work</p>
      </div>

      {assignments.length ? (
        <div className="space-y-4">
          {assignments.map((a) => {
            const sub = submissions[a.id]
            return (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{a.course?.title}</p>
                  </div>
                  <Badge variant={sub?.status === 'graded' ? 'success' : sub?.status === 'submitted' ? 'secondary' : 'warning'}>
                    {sub?.status || 'pending'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <p className="text-sm">Due: {formatDate(a.due_date)}</p>
                  {sub?.score !== null && sub?.score !== undefined && (
                    <p className="font-semibold text-primary">Score: {sub.score}%</p>
                  )}
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      className="max-w-xs"
                      onChange={(e) => handleUpload(a.id, e.target.files[0])}
                      disabled={uploading === a.id}
                    />
                    {uploading === a.id && <span className="text-sm text-muted-foreground">Uploading...</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={FileText} title="No assignments" description="You have no assignments in your assigned courses." />
      )}
    </div>
  )
}
