-- Lumen LMS — Functions, triggers, seed helpers
-- Run after 001_initial.sql

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.get_user_grade()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT grade FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.teacher_owns_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id
      AND c.teacher_id = auth.uid()
      AND public.get_user_role() = 'teacher'
  );
$$;

-- ---------------------------------------------------------------------------
-- Auth trigger: auto-create profile on signup
-- ---------------------------------------------------------------------------

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: confirm email for users created from admin/teacher dashboard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_user_email(p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
  target_role text;
BEGIN
  caller_role := public.get_user_role();
  IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized to confirm users';
  END IF;

  SELECT p.role INTO target_role
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email = lower(trim(p_email));

  IF caller_role = 'teacher' AND target_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Teachers can only confirm student accounts';
  END IF;

  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
  WHERE email = lower(trim(p_email));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_email;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete user (super_admin only — removes auth user + profile)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
BEGIN
  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF public.get_user_role() = 'teacher' AND target_role <> 'student' THEN
    RAISE EXCEPTION 'Teachers are only authorized to delete student accounts';
  END IF;

  IF public.get_user_role() NOT IN ('super_admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized to delete users';
  END IF;

  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot delete super admin accounts';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: update teacher (super_admin only — profile, email, optional password)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Demo seed helpers (dev only — revoke in production)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_demo_profiles()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, grade)
  SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
    CASE
      WHEN NULLIF(TRIM(u.raw_user_meta_data->>'role'), '') IN ('super_admin', 'teacher', 'student')
        THEN NULLIF(TRIM(u.raw_user_meta_data->>'role'), '')
      WHEN u.email = 'superadmin@lumen.edu' THEN 'super_admin'
      WHEN u.email LIKE 'teacher%@lumen.edu' THEN 'teacher'
      ELSE 'student'
    END,
    NULLIF(TRIM(u.raw_user_meta_data->>'grade'), '')::INTEGER
  FROM auth.users u
  WHERE u.email IN (
    'superadmin@lumen.edu', 'teacher1@lumen.edu', 'teacher2@lumen.edu',
    'student1@lumen.edu', 'student2@lumen.edu', 'student3@lumen.edu'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    grade = EXCLUDED.grade;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_lumen_data()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_id UUID; teacher1_id UUID; teacher2_id UUID;
  student1_id UUID; student2_id UUID; student3_id UUID;
  course_physics UUID; course_math UUID; course_chemistry UUID;
  session1_id UUID; session2_id UUID; session3_id UUID; quiz1_id UUID;
BEGIN
  PERFORM public.sync_demo_profiles();

  SELECT id INTO admin_id FROM public.profiles
  WHERE full_name = 'Admin User' OR full_name = 'superadmin' OR role = 'super_admin'
  ORDER BY CASE WHEN full_name = 'Admin User' THEN 0 WHEN role = 'super_admin' THEN 1 ELSE 2 END LIMIT 1;

  SELECT id INTO teacher1_id FROM public.profiles
  WHERE full_name IN ('Dr. Sarah Chen', 'teacher1') OR (role = 'teacher' AND id != COALESCE(teacher2_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY CASE WHEN full_name = 'Dr. Sarah Chen' THEN 0 ELSE 1 END, created_at LIMIT 1;

  SELECT id INTO teacher2_id FROM public.profiles
  WHERE full_name IN ('Mr. James Wilson', 'teacher2') OR (role = 'teacher' AND id != COALESCE(teacher1_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY CASE WHEN full_name = 'Mr. James Wilson' THEN 0 ELSE 1 END, created_at LIMIT 1;

  SELECT id INTO student1_id FROM public.profiles
  WHERE full_name IN ('Alex Johnson', 'student1') OR role = 'student'
  ORDER BY CASE WHEN full_name = 'Alex Johnson' THEN 0 ELSE 1 END, created_at LIMIT 1;

  SELECT id INTO student2_id FROM public.profiles
  WHERE full_name IN ('Emma Davis', 'student2') OR (role = 'student' AND id != COALESCE(student1_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY CASE WHEN full_name = 'Emma Davis' THEN 0 ELSE 1 END, created_at LIMIT 1;

  SELECT id INTO student3_id FROM public.profiles
  WHERE full_name IN ('Noah Brown', 'student3') OR (role = 'student' AND id NOT IN (COALESCE(student1_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(student2_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  ORDER BY CASE WHEN full_name = 'Noah Brown' THEN 0 ELSE 1 END, created_at LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin profile found. Create superadmin@lumen.edu in Auth first (see supabase/seeds.sql).';
  END IF;

  UPDATE public.profiles SET full_name = 'Admin User', role = 'super_admin', grade = NULL WHERE id = admin_id;
  IF teacher1_id IS NOT NULL THEN UPDATE public.profiles SET full_name = 'Dr. Sarah Chen', role = 'teacher', grade = NULL WHERE id = teacher1_id; END IF;
  IF teacher2_id IS NOT NULL THEN UPDATE public.profiles SET full_name = 'Mr. James Wilson', role = 'teacher', grade = NULL WHERE id = teacher2_id; END IF;
  IF student1_id IS NOT NULL THEN UPDATE public.profiles SET full_name = 'Alex Johnson', role = 'student', grade = NULL, teacher_id = teacher1_id WHERE id = student1_id; END IF;
  IF student2_id IS NOT NULL THEN UPDATE public.profiles SET full_name = 'Emma Davis', role = 'student', grade = NULL, teacher_id = teacher1_id WHERE id = student2_id; END IF;
  IF student3_id IS NOT NULL THEN UPDATE public.profiles SET full_name = 'Noah Brown', role = 'student', grade = NULL, teacher_id = teacher2_id WHERE id = student3_id; END IF;

  INSERT INTO public.courses (id, title, teacher_id, thumbnail, description)
  VALUES (public.uuid_generate_v4(), 'Introduction to Physics', teacher1_id,
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
    'Introduction to mechanics and thermodynamics.')
  RETURNING id INTO course_physics;

  INSERT INTO public.courses (title, teacher_id, thumbnail, description)
  VALUES ('Algebra Fundamentals', teacher1_id,
    'https://images.unsplash.com/photo-1635070041408-e5f23d4a3a6a?w=400', 'Algebra, geometry, and calculus fundamentals.')
  RETURNING id INTO course_math;

  INSERT INTO public.courses (title, teacher_id, thumbnail, description)
  VALUES ('Chemistry Basics', teacher2_id,
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400', 'Organic and inorganic chemistry basics.')
  RETURNING id INTO course_chemistry;

  INSERT INTO public.sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES (course_physics, 1, 'Introduction to Motion', 25, 'https://www.youtube.com/embed/6D05L3w9lVM', false)
  RETURNING id INTO session1_id;
  INSERT INTO public.sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES (course_physics, 2, 'Forces and Newton''s Laws', 30, 'https://www.youtube.com/embed/kKKM4Y6R0Tg', true)
  RETURNING id INTO session2_id;
  INSERT INTO public.sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES (course_physics, 3, 'Energy and Work', 28, 'https://www.youtube.com/embed/z2of0ROp4TE', true)
  RETURNING id INTO session3_id;

  INSERT INTO public.resources (session_id, name, file_url, type) VALUES
    (session1_id, 'Motion Lecture Notes', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf'),
    (session1_id, 'Practice Problems', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf');

  INSERT INTO public.sessions (course_id, order_no, title, duration_min, video_url, locked) VALUES
    (course_math, 1, 'Linear Equations', 20, 'https://www.youtube.com/embed/fNk_zzaMoSs', false),
    (course_math, 2, 'Quadratic Functions', 35, 'https://www.youtube.com/embed/HfRJgqxmZKk', true);
  INSERT INTO public.sessions (course_id, order_no, title, duration_min, video_url, locked) VALUES
    (course_chemistry, 1, 'Atomic Structure', 22, 'https://www.youtube.com/embed/FSyAehMdpyI', false),
    (course_chemistry, 2, 'Chemical Bonds', 27, 'https://www.youtube.com/embed/QXT4OVM4vXI', true);

  INSERT INTO public.quizzes (course_id, title, passing_score, time_limit_min, attempts)
  VALUES (course_physics, 'Motion & Forces Quiz', 70, 15, 3) RETURNING id INTO quiz1_id;

  INSERT INTO public.questions (quiz_id, text, type, options, correct_index, order_no) VALUES
    (quiz1_id, 'What is the SI unit of force?', 'multiple_choice', '["Joule", "Newton", "Watt", "Pascal"]', 1, 1),
    (quiz1_id, 'Which law states F = ma?', 'multiple_choice', '["First Law", "Second Law", "Third Law", "Law of Gravitation"]', 1, 2),
    (quiz1_id, 'What is velocity?', 'multiple_choice', '["Speed with direction", "Total distance", "Rate of acceleration", "Force per mass"]', 0, 3),
    (quiz1_id, 'Energy cannot be created or destroyed. This is the law of:', 'multiple_choice', '["Momentum", "Conservation of Energy", "Thermodynamics", "Gravity"]', 1, 4),
    (quiz1_id, 'What is the formula for kinetic energy?', 'multiple_choice', '["mgh", "½mv²", "Fd", "ma"]', 1, 5);

  INSERT INTO public.assignments (course_id, title, due_date, description) VALUES
    (course_physics, 'Lab Report: Motion Experiment', NOW() + INTERVAL '7 days', 'Submit your lab report on the motion experiment conducted in class.'),
    (course_math, 'Problem Set 3', NOW() + INTERVAL '5 days', 'Complete problems 1-20 from Chapter 4.');

  IF student1_id IS NOT NULL THEN
    INSERT INTO public.enrollments (student_id, course_id, progress)
    SELECT student1_id, id, 15 FROM public.courses WHERE teacher_id = teacher1_id ON CONFLICT DO NOTHING;
  END IF;
  IF student2_id IS NOT NULL THEN
    INSERT INTO public.enrollments (student_id, course_id, progress)
    SELECT student2_id, id, 30 FROM public.courses WHERE teacher_id = teacher1_id ON CONFLICT DO NOTHING;
    INSERT INTO public.enrollments (student_id, course_id, progress)
    VALUES (student2_id, course_chemistry, 20) ON CONFLICT DO NOTHING;
  END IF;
  IF student3_id IS NOT NULL THEN
    INSERT INTO public.enrollments (student_id, course_id, progress)
    SELECT student3_id, id, 10 FROM public.courses WHERE teacher_id = teacher2_id ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Seed data inserted successfully!';
END;
$$;

-- ---------------------------------------------------------------------------
-- Ownership & execute grants
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.get_user_role() OWNER TO postgres;
ALTER FUNCTION public.get_user_grade() OWNER TO postgres;
ALTER FUNCTION public.teacher_owns_course(uuid) OWNER TO postgres;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.confirm_user_email(text) OWNER TO postgres;
ALTER FUNCTION public.delete_user_account(uuid) OWNER TO postgres;
ALTER FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) OWNER TO postgres;
ALTER FUNCTION public.sync_demo_profiles() OWNER TO postgres;
ALTER FUNCTION public.seed_lumen_data() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.confirm_user_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_demo_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_lumen_data() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_grade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_owns_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_user_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_teacher_account(uuid, text, text, text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_demo_profiles() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.seed_lumen_data() TO postgres, service_role;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
