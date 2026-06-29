-- Run once on EXISTING Supabase projects (SQL Editor)
-- Adds education level, track, subjects + updates update_teacher_account RPC

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education_level TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_track TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_education_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_education_level_check
  CHECK (education_level IS NULL OR education_level IN ('middle', 'secondary', 'both'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_secondary_track_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_secondary_track_check
  CHECK (secondary_track IS NULL OR secondary_track IN ('science', 'math', 'literature'));

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.update_teacher_account(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_teacher_account(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_education_level text,
  p_secondary_track text,
  p_subjects jsonb,
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
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized to update users';
  END IF;

  IF p_education_level NOT IN ('middle', 'secondary', 'both') THEN
    RAISE EXCEPTION 'Invalid education level';
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
    subjects = p_subjects
  WHERE id = p_user_id;

  UPDATE auth.users SET email = lower(trim(p_email)) WHERE id = p_user_id;

  IF p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf'))
    WHERE id = p_user_id;
  END IF;
END;
$$;

ALTER FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
