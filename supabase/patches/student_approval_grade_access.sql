-- Student approval workflow + grade-based course access
-- Run once in Supabase SQL Editor after teacher_invitation_system.sql

-- ---------------------------------------------------------------------------
-- Student status on profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IS NULL OR status IN ('pending', 'active', 'rejected'));

-- Existing students/teachers default to active
UPDATE public.profiles SET status = 'active'
WHERE status IS NULL AND role IN ('student', 'teacher', 'super_admin');

CREATE INDEX IF NOT EXISTS idx_profiles_student_status
  ON public.profiles (status)
  WHERE role = 'student';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_is_active(p_student_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_student_id
      AND p.role = 'student'
      AND COALESCE(p.status, 'active') = 'active'
      AND COALESCE(p.disabled, false) = false
  );
$$;

ALTER FUNCTION public.student_is_active(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_is_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_can_access_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.courses c ON c.id = p_course_id
    WHERE p.id = auth.uid()
      AND p.role = 'student'
      AND COALESCE(p.status, 'active') = 'active'
      AND COALESCE(p.disabled, false) = false
      AND p.grade IS NOT NULL
      AND c.grade IS NOT NULL
      AND p.grade = c.grade
      AND c.teacher_id IS NOT NULL
      AND public.is_teacher_of_student(p.id, c.teacher_id)
  );
$$;

ALTER FUNCTION public.student_can_access_course(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_can_access_course(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auto-enroll active students in grade-matched courses (progress tracking)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_grade_enrollments(p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grade integer;
  v_inserted integer := 0;
BEGIN
  IF NOT public.student_is_active(p_student_id) THEN
    RETURN 0;
  END IF;

  SELECT p.grade INTO v_grade
  FROM public.profiles p
  WHERE p.id = p_student_id AND p.role = 'student';

  IF v_grade IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, progress)
  SELECT p_student_id, c.id, 0
  FROM public.courses c
  JOIN public.profiles p ON p.id = p_student_id
  WHERE c.grade = p.grade
    AND c.teacher_id IS NOT NULL
    AND public.is_teacher_of_student(p_student_id, c.teacher_id)
  ON CONFLICT (student_id, course_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

ALTER FUNCTION public.sync_grade_enrollments(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_grade_enrollments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_teacher_grade_enrollments(p_teacher_id uuid, p_grade integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_total integer := 0;
BEGIN
  IF public.get_user_role() NOT IN ('teacher', 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF public.get_user_role() = 'teacher' AND p_teacher_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_student_id IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'student'
      AND COALESCE(p.status, 'active') = 'active'
      AND COALESCE(p.disabled, false) = false
      AND p.grade = p_grade
      AND public.is_teacher_of_student(p.id, p_teacher_id)
  LOOP
    v_total := v_total + public.sync_grade_enrollments(v_student_id);
  END LOOP;

  RETURN v_total;
END;
$$;

ALTER FUNCTION public.sync_teacher_grade_enrollments(uuid, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_teacher_grade_enrollments(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Teacher approve / reject pending students
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can approve students';
  END IF;

  IF NOT public.is_teacher_of_student(p_student_id, auth.uid()) THEN
    RAISE EXCEPTION 'Student is not linked to you';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_student_id AND role = 'student' AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Student is not pending approval';
  END IF;

  UPDATE public.profiles
  SET status = 'active', disabled = false
  WHERE id = p_student_id;

  PERFORM public.sync_grade_enrollments(p_student_id);
END;
$$;

ALTER FUNCTION public.approve_student(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can reject students';
  END IF;

  IF NOT public.is_teacher_of_student(p_student_id, auth.uid()) THEN
    RAISE EXCEPTION 'Student is not linked to you';
  END IF;

  UPDATE public.profiles
  SET status = 'rejected'
  WHERE id = p_student_id AND role = 'student';

  DELETE FROM public.student_teachers
  WHERE student_id = p_student_id AND teacher_id = auth.uid();

  UPDATE public.profiles
  SET teacher_id = NULL
  WHERE id = p_student_id AND teacher_id = auth.uid();
END;
$$;

ALTER FUNCTION public.reject_student(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_student(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Update join_teacher_by_slug: self-join sets pending (unless already active)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_teacher_by_slug(p_teacher_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_student_role text;
  v_current_status text;
  v_slug text;
  v_teacher_id uuid;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, status INTO v_student_role, v_current_status
  FROM public.profiles WHERE id = v_student_id;

  IF v_student_role IS NULL OR v_student_role <> 'student' THEN
    RAISE EXCEPTION 'Only students can join a teacher';
  END IF;

  v_slug := public.normalize_teacher_slug(p_teacher_slug);
  IF NOT public.is_valid_teacher_slug(v_slug) THEN
    RAISE EXCEPTION 'Invalid teacher invitation link';
  END IF;

  SELECT p.id INTO v_teacher_id
  FROM public.profiles p
  WHERE p.slug = v_slug
    AND p.role = 'teacher'
    AND COALESCE(p.disabled, false) = false;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Teacher not found';
  END IF;

  INSERT INTO public.student_teachers (student_id, teacher_id)
  VALUES (v_student_id, v_teacher_id)
  ON CONFLICT (student_id, teacher_id) DO NOTHING;

  UPDATE public.profiles
  SET
    teacher_id = COALESCE(teacher_id, v_teacher_id),
    status = CASE
      WHEN COALESCE(v_current_status, 'active') = 'active' THEN 'active'
      WHEN v_current_status = 'rejected' THEN 'pending'
      ELSE COALESCE(v_current_status, 'pending')
    END
  WHERE id = v_student_id;

  RETURN v_teacher_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Replace enrollment-only course access with grade + teacher + active checks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.student_can_access_course(p_course_id);
$$;

-- ---------------------------------------------------------------------------
-- RLS: teachers view pending students
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers view pending students" ON public.profiles;
CREATE POLICY "Teachers view pending students" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND status = 'pending'
    AND public.is_teacher_of_student(id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: student_teachers — teachers can manage links
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers manage student links" ON public.student_teachers;
CREATE POLICY "Teachers manage student links" ON public.student_teachers
  FOR ALL USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

NOTIFY pgrst, 'reload schema';
