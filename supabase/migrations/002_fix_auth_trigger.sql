-- Fix: "Database error creating new user"
-- Run this in Supabase SQL Editor if user creation fails.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_grade INTEGER;
  v_full_name TEXT;
BEGIN
  -- Safe role (empty string from dashboard metadata fails the CHECK constraint)
  v_role := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')), '');
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'teacher', 'student') THEN
    v_role := 'student';
  END IF;

  -- Safe grade (invalid cast aborts the whole auth insert)
  BEGIN
    v_grade := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'grade', '')), '')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_grade := NULL;
  END;

  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  IF v_full_name IS NULL THEN
    v_full_name := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, full_name, role, grade)
  VALUES (NEW.id, v_full_name, v_role, v_grade)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    grade = EXCLUDED.grade;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.email, SQLERRM;
  RAISE;
END;
$$;

-- Ensure auth can invoke the trigger function
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Allow users to insert their own profile row (signup fallback)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
