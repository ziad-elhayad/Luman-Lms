-- Patch: allow teachers to update only their own student profiles
-- Run this in the Supabase SQL Editor (replaces the old broad policy).

DROP POLICY IF EXISTS "Teachers can update student profiles" ON public.profiles;

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
