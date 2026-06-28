import { supabase } from '@/lib/supabase'

export async function fetchStudentCourses(studentGrade) {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      teacher:profiles!courses_teacher_id_fkey(full_name),
      sessions(count),
      enrollments(count)
    `)
    .eq('grade', studentGrade)
    .order('title')

  if (error) throw error
  return data
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
      course:courses(id, title, grade, teacher:profiles!courses_teacher_id_fkey(full_name))
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
