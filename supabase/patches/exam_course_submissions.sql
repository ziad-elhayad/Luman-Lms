-- Exams linked to courses + student submissions with auto MCQ grading
-- Run after exams_tables.sql and 004_enrollment_access.sql

-- ---------------------------------------------------------------------------
-- Link exams to courses
-- ---------------------------------------------------------------------------

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exams_course_id ON public.exams(course_id);

-- ---------------------------------------------------------------------------
-- Exam submissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id     UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers     JSONB NOT NULL DEFAULT '{}',
  mcq_score   INTEGER,
  final_score INTEGER,
  status      TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'auto_graded', 'graded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_id    ON public.exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student_id ON public.exam_submissions(student_id);

ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Update exam policies — students only see exams for enrolled courses
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view exams" ON public.exams;
CREATE POLICY "Students view enrolled course exams" ON public.exams
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND course_id IS NOT NULL
    AND public.student_enrolled_in_course(course_id)
  );

-- ---------------------------------------------------------------------------
-- exam_submissions policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admin full access exam_submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "Students manage own exam submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "Teachers manage own course exam submissions" ON public.exam_submissions;

CREATE POLICY "Super admin full access exam_submissions" ON public.exam_submissions
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Students manage own exam submissions" ON public.exam_submissions
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers manage own course exam submissions" ON public.exam_submissions
  FOR ALL
  USING (
    public.get_user_role() = 'teacher'
    AND exam_id IN (
      SELECT e.id FROM public.exams e
      JOIN public.courses c ON c.id = e.course_id
      WHERE c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND exam_id IN (
      SELECT e.id FROM public.exams e
      JOIN public.courses c ON c.id = e.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_submissions TO authenticated;
