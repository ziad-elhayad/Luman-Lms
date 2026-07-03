-- Teacher invitation system: slug, student_teachers, public teacher lookup, join RPC
-- Run once in Supabase SQL Editor on existing projects.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academy TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug_unique
  ON public.profiles (slug)
  WHERE slug IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_slug_format_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_slug_format_check
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE TABLE IF NOT EXISTS public.student_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_student_teachers_student ON public.student_teachers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_teachers_teacher ON public.student_teachers(teacher_id);

-- Backfill student_teachers from existing profiles.teacher_id
INSERT INTO public.student_teachers (student_id, teacher_id)
SELECT p.id, p.teacher_id
FROM public.profiles p
WHERE p.role = 'student'
  AND p.teacher_id IS NOT NULL
ON CONFLICT (student_id, teacher_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_teacher_slug(p_slug text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(
    lower(trim(regexp_replace(COALESCE(p_slug, ''), '\s+', '-', 'g'))),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_teacher_slug(p_slug text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_slug IS NOT NULL
    AND p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$';
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id uuid, p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_teachers st
    WHERE st.student_id = p_student_id AND st.teacher_id = p_teacher_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_student_id
      AND p.role = 'student'
      AND p.teacher_id = p_teacher_id
  );
$$;

ALTER FUNCTION public.is_teacher_of_student(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public teacher lookup (invitation landing page)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_teacher_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  subjects jsonb,
  education_level text,
  secondary_track text,
  bio text,
  academy text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := public.normalize_teacher_slug(p_slug);
  IF NOT public.is_valid_teacher_slug(v_slug) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.subjects,
    p.education_level,
    p.secondary_track,
    p.bio,
    p.academy
  FROM public.profiles p
  WHERE p.slug = v_slug
    AND p.role = 'teacher'
    AND COALESCE(p.disabled, false) = false;
END;
$$;

ALTER FUNCTION public.get_public_teacher_by_slug(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_by_slug(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Slug availability check (admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_teacher_slug_available(
  p_slug text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_slug := public.normalize_teacher_slug(p_slug);
  IF NOT public.is_valid_teacher_slug(v_slug) THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE slug = v_slug
      AND role = 'teacher'
      AND (p_exclude_user_id IS NULL OR id <> p_exclude_user_id)
  );
END;
$$;

ALTER FUNCTION public.is_teacher_slug_available(text, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_teacher_slug_available(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Join student to teacher via slug (registration + login)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_teacher_by_slug(p_teacher_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_student_role text;
  v_slug text;
  v_teacher_id uuid;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_student_role FROM public.profiles WHERE id = v_student_id;
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

  -- Keep profiles.teacher_id in sync for legacy RLS paths
  UPDATE public.profiles
  SET teacher_id = COALESCE(teacher_id, v_teacher_id)
  WHERE id = v_student_id;

  RETURN v_teacher_id;
END;
$$;

ALTER FUNCTION public.join_teacher_by_slug(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.join_teacher_by_slug(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Update teacher account RPC (add slug)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.update_teacher_account(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_education_level text,
  p_secondary_track text,
  p_subjects jsonb,
  p_slug text,
  p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
  v_full_name text;
  v_track text;
  v_slug text;
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized to update users';
  END IF;

  IF p_education_level NOT IN ('middle', 'secondary', 'both') THEN
    RAISE EXCEPTION 'Invalid education level';
  END IF;

  v_slug := public.normalize_teacher_slug(p_slug);
  IF NOT public.is_valid_teacher_slug(v_slug) THEN
    RAISE EXCEPTION 'Invalid teacher slug';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE slug = v_slug AND role = 'teacher' AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'This slug is already in use. Please choose another one.';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF target_role <> 'teacher' THEN
    RAISE EXCEPTION 'Can only update teacher accounts';
  END IF;

  v_track := NULLIF(trim(p_secondary_track), '');
  IF p_education_level IN ('secondary', 'both') AND v_track IS NULL THEN
    RAISE EXCEPTION 'Secondary track is required';
  END IF;
  IF p_education_level = 'middle' THEN
    v_track := NULL;
  END IF;
  IF v_track IS NOT NULL AND v_track NOT IN ('science', 'math', 'literature') THEN
    RAISE EXCEPTION 'Invalid secondary track';
  END IF;
  IF p_subjects IS NULL OR jsonb_typeof(p_subjects) <> 'array' OR jsonb_array_length(p_subjects) = 0 THEN
    RAISE EXCEPTION 'At least one subject is required';
  END IF;

  v_full_name := trim(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));

  UPDATE public.profiles SET
    first_name = NULLIF(trim(p_first_name), ''),
    last_name = NULLIF(trim(p_last_name), ''),
    full_name = v_full_name,
    email = lower(trim(p_email)),
    phone = NULLIF(trim(p_phone), ''),
    education_level = p_education_level,
    secondary_track = v_track,
    subjects = p_subjects,
    slug = v_slug
  WHERE id = p_user_id;

  UPDATE auth.users SET email = lower(trim(p_email)) WHERE id = p_user_id;

  IF p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf'))
    WHERE id = p_user_id;
  END IF;
END;
$$;

ALTER FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: student_teachers
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own teacher links" ON public.student_teachers
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view their student links" ON public.student_teachers
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Super admin full access student_teachers" ON public.student_teachers
  FOR ALL USING (public.get_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- RLS: extend teacher student access via student_teachers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers view own students" ON public.profiles;
CREATE POLICY "Teachers view own students" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND public.is_teacher_of_student(id, auth.uid())
  );

DROP POLICY IF EXISTS "Teachers update own students" ON public.profiles;
CREATE POLICY "Teachers update own students" ON public.profiles
  FOR UPDATE
  USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND public.is_teacher_of_student(id, auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND public.is_teacher_of_student(id, auth.uid())
  );

DROP POLICY IF EXISTS "Teachers delete own students" ON public.profiles;
CREATE POLICY "Teachers delete own students" ON public.profiles
  FOR DELETE USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND public.is_teacher_of_student(id, auth.uid())
  );

NOTIFY pgrst, 'reload schema';
