-- Run once on EXISTING Supabase projects (SQL Editor)
-- Adds teacher profile fields + update_teacher_account RPC

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Backfill from full_name + auth email
UPDATE public.profiles p SET
  first_name = COALESCE(p.first_name, split_part(p.full_name, ' ', 1)),
  last_name = COALESCE(p.last_name, NULLIF(trim(substring(p.full_name from length(split_part(p.full_name, ' ', 1)) + 1)), '')),
  email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE u.id = p.id;

-- Updated signup trigger (includes first_name, last_name, phone, email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_grade INTEGER;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_role := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')), '');
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'teacher', 'student') THEN
    v_role := 'student';
  END IF;

  BEGIN
    v_grade := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'grade', '')), '')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_grade := NULL;
  END;

  v_first_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_last_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');

  IF v_full_name IS NULL AND (v_first_name IS NOT NULL OR v_last_name IS NOT NULL) THEN
    v_full_name := trim(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, ''));
  END IF;
  IF v_full_name IS NULL THEN
    v_full_name := split_part(NEW.email, '@', 1);
  END IF;
  IF v_first_name IS NULL THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;
  IF v_last_name IS NULL THEN
    v_last_name := NULLIF(trim(substring(v_full_name from length(split_part(v_full_name, ' ', 1)) + 1)), '');
  END IF;

  INSERT INTO public.profiles (id, full_name, first_name, last_name, email, phone, role, grade)
  VALUES (NEW.id, v_full_name, v_first_name, v_last_name, NEW.email, v_phone, v_role, v_grade)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    role = EXCLUDED.role,
    grade = EXCLUDED.grade;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.email, SQLERRM;
  RAISE;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_teacher_account(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
  v_full_name text;
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized to update users';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF target_role <> 'teacher' THEN
    RAISE EXCEPTION 'Can only update teacher accounts';
  END IF;

  v_full_name := trim(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));

  UPDATE public.profiles SET
    first_name = NULLIF(trim(p_first_name), ''),
    last_name = NULLIF(trim(p_last_name), ''),
    full_name = v_full_name,
    email = lower(trim(p_email)),
    phone = NULLIF(trim(p_phone), '')
  WHERE id = p_user_id;

  UPDATE auth.users SET email = lower(trim(p_email)) WHERE id = p_user_id;

  IF p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf'))
    WHERE id = p_user_id;
  END IF;
END;
$$;

ALTER FUNCTION public.update_teacher_account(uuid, text, text, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
