import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ImagePlus, X,
  CheckCircle2, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchTeacherCourses } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeQuestion(type = 'mcq') {
  return {
    _id: crypto.randomUUID(),   // client-only key (before DB insert)
    type,
    text: '',
    image_url: '',
    imageFile: null,            // pending upload File object
    imagePreview: '',           // local blob URL for preview
    options: ['', '', '', ''],  // MCQ A-D
    correct_index: 0,
  }
}

/** toISOLocal converts a local datetime-local value (YYYY-MM-DDTHH:mm) to ISO string */
function toISO(localDT) {
  if (!localDT) return ''
  return new Date(localDT).toISOString()
}

/** Convert an ISO string back to the value format needed by datetime-local inputs */
function toLocalDT(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  // format: YYYY-MM-DDTHH:mm
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({ q, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const fileInputRef = useRef()

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    onChange({ ...q, imageFile: file, imagePreview: preview, image_url: '' })
  }

  const clearImage = () => {
    if (q.imagePreview) URL.revokeObjectURL(q.imagePreview)
    onChange({ ...q, imageFile: null, imagePreview: '', image_url: '' })
  }

  const isMCQ = q.type === 'mcq'
  const preview = q.imagePreview || q.image_url

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          {/* Question number + type badge */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <Badge
              variant={isMCQ ? 'default' : 'secondary'}
              className="cursor-pointer select-none"
              onClick={() => onChange({ ...q, type: isMCQ ? 'written' : 'mcq' })}
              title="Click to switch type"
            >
              {isMCQ ? '✦ MCQ' : '✎ Written'}
            </Badge>
            <span className="text-xs text-muted-foreground">(click badge to toggle type)</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={onMoveUp} title="Move up">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={onMoveDown} title="Move down">
              <ChevronDown className="h-4 w-4" />
            </Button>
            {total > 1 && (
              <Button size="icon" variant="ghost" onClick={onRemove} title="Remove question">
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Question text */}
        <div className="space-y-1.5">
          <Label>Question text {!preview && <span className="text-muted-foreground">(or add an image below)</span>}</Label>
          <textarea
            className="w-full rounded-control border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={2}
            value={q.text}
            onChange={(e) => onChange({ ...q, text: e.target.value })}
            placeholder="Type your question here…"
          />
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          {preview ? (
            <div className="relative w-fit">
              <img
                src={preview}
                alt="Question visual"
                className="max-h-48 rounded-control border border-border object-contain"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-card shadow"
                onClick={clearImage}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" /> Add Image (optional)
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>

        {/* MCQ options */}
        {isMCQ && (
          <div className="space-y-2">
            <Label>Options <span className="text-muted-foreground text-xs">(select the correct answer)</span></Label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...q, correct_index: oi })}
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                    q.correct_index === oi
                      ? 'border-primary bg-primary text-white'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  ].join(' ')}
                  title="Mark as correct answer"
                >
                  {String.fromCharCode(65 + oi)}
                </button>
                <Input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...q.options]
                    opts[oi] = e.target.value
                    onChange({ ...q, options: opts })
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                />
                {q.correct_index === oi && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Written hint */}
        {!isMCQ && (
          <p className="flex items-center gap-1.5 rounded-control bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Students will type a written answer for this question.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeacherExamBuilderPage() {
  const navigate = useNavigate()
  const { examId } = useParams()        // present when editing
  const { user } = useAuth()
  const { toast } = useToast()
  const isEdit = Boolean(examId)

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [courses, setCourses] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [questions, setQuestions] = useState([makeQuestion('mcq')])

  const [loading, setLoading] = useState(isEdit)   // loading existing data
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // ── Load teacher courses ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    fetchTeacherCourses(user.id).then((data) => setCourses(data || []))
  }, [user])

  // ── Load existing exam when editing ───────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    ;(async () => {
      setLoading(true)
      const { data: exam, error: eErr } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()
      const { data: qs, error: qErr } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_no')

      if (eErr || qErr) {
        toast({ title: 'Error loading exam', description: (eErr || qErr).message, variant: 'danger' })
        navigate('/teacher/exams')
        return
      }

      setTitle(exam.title)
      setCourseId(exam.course_id || '')
      setStartDate(toLocalDT(exam.start_date))
      setEndDate(toLocalDT(exam.end_date))
      setQuestions(
        (qs || []).map((q) => ({
          _id: q.id,          // reuse DB id as client key
          type: q.type,
          text: q.text || '',
          image_url: q.image_url || '',
          imageFile: null,
          imagePreview: '',
          options: q.options || ['', '', '', ''],
          correct_index: q.correct_index ?? 0,
        }))
      )
      setLoading(false)
    })()
  }, [examId])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!title.trim())    e.title = 'Title is required.'
    if (!courseId)       e.courseId = 'Select a course — enrolled students will see this exam.'
    if (!startDate)       e.startDate = 'Start date is required.'
    if (!endDate)         e.endDate = 'End date is required.'
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      e.endDate = 'End date must be after start date.'
    }
    questions.forEach((q, i) => {
      if (!q.text.trim() && !q.imageFile && !q.image_url) {
        e[`q_${i}`] = 'Question must have text or an image.'
      }
      if (q.type === 'mcq' && q.options.some((o) => !o.trim())) {
        e[`q_${i}_opts`] = 'All MCQ options must be filled in.'
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Image upload helper ────────────────────────────────────────────────────
  const uploadImage = async (file, examIdForPath) => {
    const ext = file.name.split('.').pop()
    const path = `${examIdForPath}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('exam-images')
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('exam-images').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      let savedExamId = examId

      if (isEdit) {
        // Update header
        const { error } = await supabase
          .from('exams')
          .update({ title: title.trim(), course_id: courseId, start_date: toISO(startDate), end_date: toISO(endDate) })
          .eq('id', examId)
        if (error) throw error

        // Delete old questions and re-insert fresh (simplest approach for edits)
        const { error: delErr } = await supabase.from('exam_questions').delete().eq('exam_id', examId)
        if (delErr) throw delErr
      } else {
        // Create exam header
        const { data, error } = await supabase
          .from('exams')
          .insert({
            title: title.trim(),
            course_id: courseId,
            start_date: toISO(startDate),
            end_date: toISO(endDate),
            teacher_id: user.id,
          })
          .select()
          .single()
        if (error) throw error
        savedExamId = data.id
      }

      // Upload any pending images then build question rows
      const questionRows = await Promise.all(
        questions.map(async (q, i) => {
          let imageUrl = q.image_url || ''
          if (q.imageFile) {
            imageUrl = await uploadImage(q.imageFile, savedExamId)
          }
          return {
            exam_id: savedExamId,
            order_no: i + 1,
            type: q.type,
            text: q.text.trim() || null,
            image_url: imageUrl || null,
            options: q.type === 'mcq' ? q.options : [],
            correct_index: q.type === 'mcq' ? q.correct_index : null,
          }
        })
      )

      const { error: qErr } = await supabase.from('exam_questions').insert(questionRows)
      if (qErr) throw qErr

      toast({ title: isEdit ? 'Exam updated!' : 'Exam created!', variant: 'success' })
      navigate('/teacher/exams')
    } catch (err) {
      // Gracefully handle missing storage bucket
      const isBucketMissing =
        err.message?.includes('Bucket not found') ||
        err.message?.includes('bucket') ||
        err.statusCode === 400
      toast({
        title: 'Error saving exam',
        description: isBucketMissing
          ? 'Image upload failed: create a public bucket called "exam-images" in Supabase Storage, or remove the image and try again.'
          : err.message,
        variant: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Question list helpers ──────────────────────────────────────────────────
  const addQuestion = (type) => setQuestions((prev) => [...prev, makeQuestion(type)])

  const updateQuestion = (index, updated) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)))

  const removeQuestion = (index) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index))

  const moveQuestion = (from, to) => {
    if (to < 0 || to >= questions.length) return
    const next = [...questions]
    ;[next[from], next[to]] = [next[to], next[from]]
    setQuestions(next)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading exam…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      {/* Back */}
      <Button variant="ghost" onClick={() => navigate('/teacher/exams')}>
        <ArrowLeft className="h-4 w-4" /> Back to Exams
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Exam' : 'New Exam'}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {questions.length} question{questions.length !== 1 ? 's' : ''} · fill in the details below then save
        </p>
      </div>

      {/* ── Exam Header Card ── */}
      <Card>
        <CardHeader><CardTitle>Exam Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="exam-title">Exam Title</Label>
            <Input
              id="exam-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Exam — Unit 3"
            />
            {errors.title && <p className="text-xs text-danger">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId || undefined} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">All students enrolled in this course can take the exam.</p>
            {errors.courseId && <p className="text-xs text-danger">{errors.courseId}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date &amp; Time</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {errors.startDate && <p className="text-xs text-danger">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End Date &amp; Time</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {errors.endDate && <p className="text-xs text-danger">{errors.endDate}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Questions ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions</h2>
          <span className="text-sm text-muted-foreground">{questions.length} total</span>
        </div>

        {questions.map((q, qi) => (
          <div key={q._id}>
            {errors[`q_${qi}`] && (
              <p className="mb-1 text-xs text-danger">{errors[`q_${qi}`]}</p>
            )}
            {errors[`q_${qi}_opts`] && (
              <p className="mb-1 text-xs text-danger">{errors[`q_${qi}_opts`]}</p>
            )}
            <QuestionCard
              q={q}
              index={qi}
              total={questions.length}
              onChange={(updated) => updateQuestion(qi, updated)}
              onRemove={() => removeQuestion(qi)}
              onMoveUp={() => moveQuestion(qi, qi - 1)}
              onMoveDown={() => moveQuestion(qi, qi + 1)}
            />
          </div>
        ))}
      </div>

      {/* ── Add question buttons ── */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => addQuestion('mcq')}>
          <Plus className="h-4 w-4" /> Add MCQ
        </Button>
        <Button variant="outline" onClick={() => addQuestion('written')}>
          <Plus className="h-4 w-4" /> Add Written
        </Button>
      </div>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button variant="outline" onClick={() => navigate('/teacher/exams')} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? 'Saving…' : isEdit ? 'Update Exam' : 'Create Exam'}
        </Button>
      </div>
    </div>
  )
}
