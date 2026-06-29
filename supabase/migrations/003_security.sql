-- Lumen LMS — RLS policies, storage policies, table grants
-- Run after 002_database_logic.sql

-- ---------------------------------------------------------------------------
-- Drop legacy policies (safe re-run on upgraded databases)
-- ---------------------------------------------------------------------------

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

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

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Super admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admin can update all profiles" ON public.profiles
  FOR UPDATE USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admin can delete profiles" ON public.profiles
  FOR DELETE USING (public.get_user_role() = 'super_admin');

-- Teacher-scoped student access: teachers can only view/update/delete their own students
-- Note: We don't restrict INSERT because profiles are created by auth triggers
-- The teacher_id is set by the app after user creation

CREATE POLICY "Teachers view own students" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'teacher' 
    AND role = 'student' 
    AND teacher_id = auth.uid()
  );

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

CREATE POLICY "Teachers delete own students" ON public.profiles
  FOR DELETE USING (
    public.get_user_role() = 'teacher' 
    AND role = 'student' 
    AND teacher_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access courses" ON public.courses
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage own courses" ON public.courses
  FOR ALL USING (public.get_user_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY "Students see enrolled courses" ON public.courses
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(id)
  );

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access sessions" ON public.sessions
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage course sessions" ON public.sessions
  FOR ALL USING (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students view enrolled course sessions" ON public.sessions
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access resources" ON public.resources
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage resources" ON public.resources
  FOR ALL USING (
    public.get_user_role() = 'teacher'
    AND session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.courses c ON s.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view enrolled course resources" ON public.resources
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND session_id IN (
      SELECT s.id FROM public.sessions s
      WHERE public.student_enrolled_in_course(s.course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access quizzes" ON public.quizzes
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage quizzes" ON public.quizzes
  FOR ALL USING (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students view enrolled course quizzes" ON public.quizzes
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access questions" ON public.questions
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage questions" ON public.questions
  FOR ALL USING (
    public.get_user_role() = 'teacher'
    AND quiz_id IN (
      SELECT q.id FROM public.quizzes q
      JOIN public.courses c ON q.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view enrolled course questions" ON public.questions
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND quiz_id IN (
      SELECT q.id FROM public.quizzes q
      WHERE public.student_enrolled_in_course(q.course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access enrollments" ON public.enrollments
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers view course enrollments" ON public.enrollments
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers manage own course enrollments" ON public.enrollments
  FOR ALL
  USING (public.get_user_role() = 'teacher' AND public.teacher_owns_course(course_id))
  WITH CHECK (public.get_user_role() = 'teacher' AND public.teacher_owns_course(course_id));

CREATE POLICY "Students view own enrollments" ON public.enrollments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students update own enrollments" ON public.enrollments
  FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Students insert own enrollments" ON public.enrollments
  FOR INSERT WITH CHECK (student_id = auth.uid() AND public.get_user_role() = 'student');

-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access assignments" ON public.assignments
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage assignments" ON public.assignments
  FOR ALL USING (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students view enrolled course assignments" ON public.assignments
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND public.student_enrolled_in_course(course_id)
  );

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access submissions" ON public.submissions
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers view own course submissions" ON public.submissions
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND (
      (quiz_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
        WHERE q.id = submissions.quiz_id AND c.teacher_id = auth.uid()
      ))
      OR (assignment_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.assignments a JOIN public.courses c ON c.id = a.course_id
        WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Teachers update own course submissions" ON public.submissions
  FOR UPDATE USING (
    public.get_user_role() = 'teacher'
    AND (
      (quiz_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
        WHERE q.id = submissions.quiz_id AND c.teacher_id = auth.uid()
      ))
      OR (assignment_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.assignments a JOIN public.courses c ON c.id = a.course_id
        WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Students manage own submissions" ON public.submissions
  FOR ALL USING (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session_progress
-- ---------------------------------------------------------------------------

CREATE POLICY "Super admin full access session_progress" ON public.session_progress
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Students manage own progress" ON public.session_progress
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view own course session progress" ON public.session_progress
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = session_progress.session_id AND c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage (requires bucket "submissions" in Supabase dashboard)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students upload own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Students read own submission files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers read submission files for their courses" ON storage.objects;
DROP POLICY IF EXISTS "Super admin full access submissions bucket" ON storage.objects;

CREATE POLICY "Students upload own submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Students read own submission files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Students update own submission files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Students delete own submission files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Teachers read submission files for their courses" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND public.get_user_role() = 'teacher');

CREATE POLICY "Super admin full access submissions bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'submissions' AND public.get_user_role() = 'super_admin')
  WITH CHECK (bucket_id = 'submissions' AND public.get_user_role() = 'super_admin');

-- Storage bucket (safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('submissions', 'submissions', true, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- ---------------------------------------------------------------------------
-- Table grants (RLS still enforced)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_progress TO authenticated;
