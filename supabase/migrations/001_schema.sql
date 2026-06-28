-- Lumen LMS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'teacher', 'student')),
  grade INTEGER,
  avatar_url TEXT,
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  thumbnail TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_min INTEGER DEFAULT 0,
  video_url TEXT,
  locked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  type TEXT DEFAULT 'pdf',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER DEFAULT 70,
  time_limit_min INTEGER DEFAULT 30,
  attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  order_no INTEGER DEFAULT 0
);

-- Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed_sessions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  score INTEGER,
  status TEXT DEFAULT 'pending',
  file_url TEXT,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session progress (tracks which sessions student completed)
CREATE TABLE IF NOT EXISTS session_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(student_id, session_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_grade ON courses(grade);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's grade
CREATE OR REPLACE FUNCTION get_user_grade()
RETURNS INTEGER AS $$
  SELECT grade FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_progress ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admin can view all profiles" ON profiles FOR SELECT USING (get_user_role() = 'super_admin');
CREATE POLICY "Super admin can update all profiles" ON profiles FOR UPDATE USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers can view student profiles" ON profiles FOR SELECT USING (get_user_role() = 'teacher' AND role = 'student');

-- Courses policies
CREATE POLICY "Super admin full access courses" ON courses FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage own courses" ON courses FOR ALL USING (get_user_role() = 'teacher' AND teacher_id = auth.uid());
CREATE POLICY "Students see grade-matched courses" ON courses FOR SELECT USING (
  get_user_role() = 'student' AND grade = get_user_grade()
);
CREATE POLICY "Teachers view all courses" ON courses FOR SELECT USING (get_user_role() = 'teacher');

-- Sessions policies
CREATE POLICY "Super admin full access sessions" ON sessions FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage course sessions" ON sessions FOR ALL USING (
  get_user_role() = 'teacher' AND course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid())
);
CREATE POLICY "Students view grade-matched sessions" ON sessions FOR SELECT USING (
  get_user_role() = 'student' AND course_id IN (
    SELECT id FROM courses WHERE grade = get_user_grade()
  )
);

-- Resources policies
CREATE POLICY "Super admin full access resources" ON resources FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage resources" ON resources FOR ALL USING (
  get_user_role() = 'teacher' AND session_id IN (
    SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE c.teacher_id = auth.uid()
  )
);
CREATE POLICY "Students view grade-matched resources" ON resources FOR SELECT USING (
  get_user_role() = 'student' AND session_id IN (
    SELECT s.id FROM sessions s JOIN courses c ON s.course_id = c.id WHERE c.grade = get_user_grade()
  )
);

-- Quizzes policies
CREATE POLICY "Super admin full access quizzes" ON quizzes FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage quizzes" ON quizzes FOR ALL USING (
  get_user_role() = 'teacher' AND course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid())
);
CREATE POLICY "Students view grade-matched quizzes" ON quizzes FOR SELECT USING (
  get_user_role() = 'student' AND course_id IN (
    SELECT id FROM courses WHERE grade = get_user_grade()
  )
);

-- Questions policies
CREATE POLICY "Super admin full access questions" ON questions FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage questions" ON questions FOR ALL USING (
  get_user_role() = 'teacher' AND quiz_id IN (
    SELECT q.id FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE c.teacher_id = auth.uid()
  )
);
CREATE POLICY "Students view grade-matched questions" ON questions FOR SELECT USING (
  get_user_role() = 'student' AND quiz_id IN (
    SELECT q.id FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE c.grade = get_user_grade()
  )
);

-- Enrollments policies
CREATE POLICY "Super admin full access enrollments" ON enrollments FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers view course enrollments" ON enrollments FOR SELECT USING (
  get_user_role() = 'teacher' AND course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid())
);
CREATE POLICY "Teachers manage enrollments" ON enrollments FOR ALL USING (get_user_role() = 'teacher');
CREATE POLICY "Students view own enrollments" ON enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students update own enrollments" ON enrollments FOR UPDATE USING (student_id = auth.uid());

-- Assignments policies
CREATE POLICY "Super admin full access assignments" ON assignments FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage assignments" ON assignments FOR ALL USING (
  get_user_role() = 'teacher' AND course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid())
);
CREATE POLICY "Students view grade-matched assignments" ON assignments FOR SELECT USING (
  get_user_role() = 'student' AND course_id IN (
    SELECT id FROM courses WHERE grade = get_user_grade()
  )
);

-- Submissions policies
CREATE POLICY "Super admin full access submissions" ON submissions FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers view course submissions" ON submissions FOR SELECT USING (get_user_role() = 'teacher');
CREATE POLICY "Teachers update submissions" ON submissions FOR UPDATE USING (get_user_role() = 'teacher');
CREATE POLICY "Students manage own submissions" ON submissions FOR ALL USING (student_id = auth.uid());

-- Announcements policies
CREATE POLICY "Super admin full access announcements" ON announcements FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Teachers manage announcements" ON announcements FOR ALL USING (
  get_user_role() = 'teacher' AND teacher_id = auth.uid()
);
CREATE POLICY "Students view grade-matched announcements" ON announcements FOR SELECT USING (
  get_user_role() = 'student' AND course_id IN (
    SELECT id FROM courses WHERE grade = get_user_grade()
  )
);

-- Session progress policies
CREATE POLICY "Super admin full access session_progress" ON session_progress FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "Students manage own progress" ON session_progress FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Teachers view session progress" ON session_progress FOR SELECT USING (get_user_role() = 'teacher');

-- Auto-create profile on signup
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
  v_role := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')), '');
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'teacher', 'student') THEN
    v_role := 'student';
  END IF;

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
END;
$$;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Table-level grants (RLS policies alone are not enough)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_grade() TO authenticated, anon;
