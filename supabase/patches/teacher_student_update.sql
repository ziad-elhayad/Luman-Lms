-- Patch: allow teachers to update student profiles
-- Run this in the Supabase SQL Editor.
--
-- Without this policy, any UPDATE a teacher makes on a student's profile row
-- is silently ignored by RLS (the request succeeds but 0 rows are affected).

DROP POLICY IF EXISTS "Teachers can update student profiles" ON public.profiles;

CREATE POLICY "Teachers can update student profiles" ON public.profiles
  FOR UPDATE
  USING  (public.get_user_role() = 'teacher' AND role = 'student')
  WITH CHECK (public.get_user_role() = 'teacher' AND role = 'student');
