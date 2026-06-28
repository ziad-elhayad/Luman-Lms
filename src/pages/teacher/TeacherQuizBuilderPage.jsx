import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'

export default function TeacherQuizBuilderPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [quiz, setQuiz] = useState({ title: '', passing_score: 70, time_limit_min: 30, attempts: 3 })
  const [questions, setQuestions] = useState([
    { text: '', options: ['', '', '', ''], correct_index: 0 },
  ])
  const [saving, setSaving] = useState(false)

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', '', '', ''], correct_index: 0 }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions]
    updated[qIndex].options[oIndex] = value
    setQuestions(updated)
  }

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: quizData, error } = await supabase
        .from('quizzes')
        .insert({ ...quiz, course_id: courseId })
        .select()
        .single()
      if (error) throw error

      const questionRows = questions.map((q, i) => ({
        quiz_id: quizData.id,
        text: q.text,
        options: q.options,
        correct_index: q.correct_index,
        order_no: i + 1,
      }))

      const { error: qError } = await supabase.from('questions').insert(questionRows)
      if (qError) throw qError

      toast({ title: 'Quiz created!', variant: 'success' })
      navigate(`/teacher/courses/${courseId}`)
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/teacher/courses/${courseId}`)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <h1 className="text-2xl font-bold">Quiz Builder</h1>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2"><Label>Quiz Title</Label><Input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Passing Score %</Label><Input type="number" value={quiz.passing_score} onChange={(e) => setQuiz({ ...quiz, passing_score: parseInt(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Time Limit (min)</Label><Input type="number" value={quiz.time_limit_min} onChange={(e) => setQuiz({ ...quiz, time_limit_min: parseInt(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Attempts</Label><Input type="number" value={quiz.attempts} onChange={(e) => setQuiz({ ...quiz, attempts: parseInt(e.target.value) })} /></div>
          </div>
        </CardContent>
      </Card>

      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <Label>Question {qi + 1}</Label>
              {questions.length > 1 && (
                <Button size="icon" variant="ghost" onClick={() => removeQuestion(qi)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              )}
            </div>
            <Input value={q.text} onChange={(e) => updateQuestion(qi, 'text', e.target.value)} placeholder="Question text" />
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correct_index === oi}
                    onChange={() => updateQuestion(qi, 'correct_index', oi)}
                    className="accent-primary"
                  />
                  <Input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-3">
        <Button variant="outline" onClick={addQuestion}><Plus className="h-4 w-4" /> Add Question</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Quiz'}</Button>
      </div>
    </div>
  )
}
