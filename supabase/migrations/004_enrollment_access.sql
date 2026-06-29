-- Lumen LMS — Enrollment-based student access (no grade/subject filtering)
-- Run after 003_security.sql

-- Relax legacy grade/subject requirements
ALTER TABLE public.courses ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN subject SET DEFAULT '';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_student_grade_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_non_student_grade_null;

-- Helper: student is enrolled in a course
CREATE OR REPLACE FUNCTION public.student_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.student_id = auth.uid()
      AND e.course_id = p_course_id
      AND public.get_user_role() = 'student'
  );
$$;

ALTER FUNCTION public.student_enrolled_in_course(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_enrolled_in_course(uuid) TO authenticated;

-- Replace grade-matched student policies with enrollment-based access
DROP POLICY IF EXISTS "Students see grade-matched courses" ON public.courses;
CREATE POLICY "Students see enrolled courses" ON public.courses
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(id)
  );

DROP POLICY IF EXISTS "Students view grade-matched sessions" ON public.sessions;
CREATE POLICY "Students view enrolled course sessions" ON public.sessions
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );

DROP POLICY IF EXISTS "Students view grade-matched resources" ON public.resources;
CREATE POLICY "Students view enrolled course resources" ON public.resources
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND session_id IN (
      SELECT s.id FROM public.sessions s
      WHERE public.student_enrolled_in_course(s.course_id)
    )
  );

DROP POLICY IF EXISTS "Students view grade-matched quizzes" ON public.quizzes;
CREATE POLICY "Students view enrolled course quizzes" ON public.quizzes
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );

DROP POLICY IF EXISTS "Students view grade-matched questions" ON public.questions;
CREATE POLICY "Students view enrolled course questions" ON public.questions
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND quiz_id IN (
      SELECT q.id FROM public.quizzes q
      WHERE public.student_enrolled_in_course(q.course_id)
    )
  );

DROP POLICY IF EXISTS "Students view enrolled course assignments" ON public.assignments;
CREATE POLICY "Students view enrolled course assignments" ON public.assignments
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );
