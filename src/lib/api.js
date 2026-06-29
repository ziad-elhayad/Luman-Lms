import { supabase } from '@/lib/supabase'

export async function fetchStudentCourses(studentId) {
  const { data: enrollments, error: enrError } = await supabase
    .from('enrollments')
    .select('course_id, progress')
    .eq('student_id', studentId)

  if (enrError) throw enrError
  if (!enrollments?.length) return []

  const courseIds = enrollments.map((e) => e.course_id)
  const progressMap = Object.fromEntries(enrollments.map((e) => [e.course_id, e.progress]))

  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      teacher:profiles!courses_teacher_id_fkey(full_name),
      sessions(count),
      enrollments(count)
    `)
    .in('id', courseIds)
    .order('title')

  if (error) throw error
  return (data || []).map((course) => ({
    ...course,
    enrollmentProgress: progressMap[course.id] ?? 0,
  }))
}

export async function fetchStudentEnrolledCourseIds(studentId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', studentId)

  if (error) throw error
  return data?.map((e) => e.course_id) || []
}

export async function syncStudentEnrollments(studentId, courseIds) {
  const ids = courseIds || []

  const { data: existing, error: fetchError } = await supabase
    .from('enrollments')
    .select('id, course_id')
    .eq('student_id', studentId)

  if (fetchError) throw fetchError

  const existingIds = existing?.map((e) => e.course_id) || []
  const toRemove = existing?.filter((e) => !ids.includes(e.course_id)) || []
  const toAdd = ids.filter((id) => !existingIds.includes(id))

  if (toRemove.length) {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .in('id', toRemove.map((e) => e.id))
    if (error) throw error
  }

  if (toAdd.length) {
    const { error } = await supabase
      .from('enrollments')
      .insert(toAdd.map((course_id) => ({ student_id: studentId, course_id, progress: 0 })))
    if (error) throw error
  }
}

export async function fetchCourseWithDetails(courseId, studentId) {
  const { data: course, error } = await supabase
    .from('courses')
    .select(`
      *,
      teacher:profiles!courses_teacher_id_fkey(full_name, avatar_url),
      sessions(*, resources(*)),
      quizzes(*, questions(*)),
      assignments(*)
    `)
    .eq('id', courseId)
    .single()

  if (error) throw error

  let enrollment = null
  let sessionProgress = []

  if (studentId) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .single()
    enrollment = enr

    const { data: progress } = await supabase
      .from('session_progress')
      .select('session_id, completed')
      .eq('student_id', studentId)
    sessionProgress = progress || []
  }

  if (course.sessions) {
    course.sessions.sort((a, b) => a.order_no - b.order_no)
  }

  return { course, enrollment, sessionProgress }
}

export async function fetchSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      resources(*),
      course:courses(id, title, teacher:profiles!courses_teacher_id_fkey(full_name))
    `)
    .eq('id', sessionId)
    .single()

  if (error) throw error
  return data
}

export async function markSessionComplete(studentId, sessionId, courseId) {
  await supabase.from('session_progress').upsert({
    student_id: studentId,
    session_id: sessionId,
    completed: true,
    completed_at: new Date().toISOString(),
  })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('course_id', courseId)

  const { data: completed } = await supabase
    .from('session_progress')
    .select('session_id')
    .eq('student_id', studentId)
    .eq('completed', true)
    .in('session_id', sessions?.map((s) => s.id) || [])

  const progress = sessions?.length
    ? Math.round((completed?.length / sessions.length) * 100)
    : 0

  await supabase
    .from('enrollments')
    .update({ progress })
    .eq('student_id', studentId)
    .eq('course_id', courseId)

  const nextSession = await supabase
    .from('sessions')
    .select('id')
    .eq('course_id', courseId)
    .eq('locked', true)
    .order('order_no')
    .limit(1)
    .single()

  if (nextSession.data) {
    await supabase
      .from('sessions')
      .update({ locked: false })
      .eq('id', nextSession.data.id)
  }

  return progress
}

export async function fetchQuiz(quizId) {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, questions(*)')
    .eq('id', quizId)
    .single()

  if (error) throw error
  if (data.questions) {
    data.questions.sort((a, b) => a.order_no - b.order_no)
  }
  return data
}

export async function getQuizAttempts(studentId, quizId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', studentId)
    .eq('quiz_id', quizId)

  if (error) throw error
  return data?.length || 0
}

export async function submitQuiz(studentId, quizId, answers, score, passed) {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      student_id: studentId,
      quiz_id: quizId,
      answers,
      score,
      status: passed ? 'passed' : 'failed',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchTeacherCourses(teacherId) {
  const { data, error } = await supabase
    .from('courses')
    .select('*, sessions(count), enrollments(count)')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchAllTeachers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('full_name')

  if (error) throw error
  return data
}

export async function fetchAdminStats() {
  const [teachers, students, courses, quizzes, enrollments] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'teacher'),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
    supabase.from('courses').select('id', { count: 'exact' }),
    supabase.from('quizzes').select('id', { count: 'exact' }),
    supabase.from('enrollments').select('id', { count: 'exact' }),
  ])

  return {
    teachers: teachers.count || 0,
    students: students.count || 0,
    courses: courses.count || 0,
    quizzes: quizzes.count || 0,
    activeUsers: enrollments.count || 0,
  }
}

export async function fetchCourseExams(courseId) {
  const { data, error } = await supabase
    .from('exams')
    .select('id, title, start_date, end_date, course_id, exam_questions(count)')
    .eq('course_id', courseId)
    .order('start_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getExamSubmission(studentId, examId) {
  const { data, error } = await supabase
    .from('exam_submissions')
    .select('*')
    .eq('student_id', studentId)
    .eq('exam_id', examId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchExamForStudent(examId, studentId) {
  const { data: exam, error } = await supabase
    .from('exams')
    .select('id, title, start_date, end_date, course_id')
    .eq('id', examId)
    .single()

  if (error) throw error

  const { data: questions, error: qErr } = await supabase
    .from('exam_questions')
    .select('id, order_no, type, text, image_url, options')
    .eq('exam_id', examId)
    .order('order_no')

  if (qErr) throw qErr

  const existing = await getExamSubmission(studentId, examId)

  return { exam, questions: questions || [], submission: existing }
}

export function gradeExamAnswers(questions, answers) {
  let mcqTotal = 0
  let mcqCorrect = 0
  let hasWritten = false

  questions.forEach((q) => {
    if (q.type === 'mcq') {
      mcqTotal += 1
      if (answers[q.id] === q.correct_index) mcqCorrect += 1
    } else {
      hasWritten = true
    }
  })

  const mcqScore = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : null
  const allMcq = mcqTotal > 0 && !hasWritten
  const status = allMcq ? 'auto_graded' : hasWritten ? 'submitted' : 'auto_graded'
  const finalScore = allMcq ? mcqScore : (mcqTotal > 0 && !hasWritten ? mcqScore : null)

  return { mcqScore, finalScore, status, mcqCorrect, mcqTotal, hasWritten }
}

export async function submitExamSubmission(studentId, examId, answers) {
  const { data: questions, error: qErr } = await supabase
    .from('exam_questions')
    .select('id, type, correct_index')
    .eq('exam_id', examId)

  if (qErr) throw qErr

  const { mcqScore, finalScore, status } = gradeExamAnswers(questions || [], answers)

  const { data, error } = await supabase
    .from('exam_submissions')
    .insert({
      exam_id: examId,
      student_id: studentId,
      answers,
      mcq_score: mcqScore,
      final_score: finalScore,
      status,
    })
    .select()
    .single()

  if (error) throw error
  return { submission: data, mcqScore, finalScore, status, questions: questions || [] }
}
