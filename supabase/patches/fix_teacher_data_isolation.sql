-- Fix teacher data isolation: each teacher sees only their own courses and students
-- Run in Supabase SQL Editor

-- Teachers were able to SELECT every course due to this policy
DROP POLICY IF EXISTS "Teachers view all courses" ON public.courses;

-- Broad student update policy (from teacher_student_update.sql) bypasses teacher_id
DROP POLICY IF EXISTS "Teachers can update student profiles" ON public.profiles;

-- Ensure scoped policies exist (safe to re-run)
DROP POLICY IF EXISTS "Teachers view own students" ON public.profiles;
CREATE POLICY "Teachers view own students" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "Teachers update own students" ON public.profiles;
CREATE POLICY "Teachers update own students" ON public.profiles
  FOR UPDATE
  USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND teacher_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "Teachers delete own students" ON public.profiles;
CREATE POLICY "Teachers delete own students" ON public.profiles
  FOR DELETE USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "Teachers manage own courses" ON public.courses;
CREATE POLICY "Teachers manage own courses" ON public.courses
  FOR ALL
  USING (public.get_user_role() = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'teacher' AND teacher_id = auth.uid());

-- Link seed/demo students to teachers by email (safe for existing data)
UPDATE public.profiles s
SET teacher_id = t.id
FROM public.profiles t
WHERE s.role = 'student'
  AND t.role = 'teacher'
  AND s.teacher_id IS NULL
  AND (
    (s.email IN ('student1@lumen.edu', 'student2@lumen.edu') AND t.email = 'teacher1@lumen.edu')
    OR (s.email = 'student3@lumen.edu' AND t.email = 'teacher2@lumen.edu')
  );
