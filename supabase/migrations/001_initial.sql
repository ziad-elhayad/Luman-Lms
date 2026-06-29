-- Lumen LMS — Schema, indexes, constraints
-- Run first in Supabase SQL Editor (fresh project).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  education_level TEXT CHECK (education_level IS NULL OR education_level IN ('middle', 'secondary', 'both')),
  secondary_track TEXT CHECK (secondary_track IS NULL OR secondary_track IN ('science', 'math', 'literature')),
  subjects JSONB NOT NULL DEFAULT '[]',
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'teacher', 'student')),
  grade INTEGER,
  avatar_url TEXT,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  thumbnail TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  video_url TEXT,
  locked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pdf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 70,
  time_limit_min INTEGER NOT NULL DEFAULT 30,
  attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  order_no INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_sessions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, session_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_courses_grade ON public.courses(grade);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON public.sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course_order ON public.sessions(course_id, order_no);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON public.enrollments(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_grade ON public.profiles(role, grade);
CREATE INDEX IF NOT EXISTS idx_resources_session_id ON public.resources(session_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON public.quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_order ON public.questions(quiz_id, order_no);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_quiz ON public.submissions(student_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_announcements_course_id ON public.announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_teacher_id ON public.announcements(teacher_id);
CREATE INDEX IF NOT EXISTS idx_session_progress_session_id ON public.session_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_session_progress_student_session ON public.session_progress(student_id, session_id);

-- ---------------------------------------------------------------------------
-- Integrity constraints (NOT VALID — safe for existing rows; validate later)
-- ---------------------------------------------------------------------------

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_course_id_not_null;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_course_id_not_null
  CHECK (course_id IS NOT NULL) NOT VALID;

ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_session_id_not_null;
ALTER TABLE public.resources ADD CONSTRAINT resources_session_id_not_null
  CHECK (session_id IS NOT NULL) NOT VALID;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_quiz_id_not_null;
ALTER TABLE public.questions ADD CONSTRAINT questions_quiz_id_not_null
  CHECK (quiz_id IS NOT NULL) NOT VALID;

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('pending', 'submitted', 'graded', 'passed', 'failed')) NOT VALID;

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_target_xor;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_target_xor
  CHECK (
    (quiz_id IS NOT NULL AND assignment_id IS NULL) OR
    (quiz_id IS NULL AND assignment_id IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_student_grade_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_student_grade_check
  CHECK (role <> 'student' OR grade IS NOT NULL) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_non_student_grade_null;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_non_student_grade_null
  CHECK (role = 'student' OR grade IS NULL) NOT VALID;

-- ---------------------------------------------------------------------------
-- Enable RLS (policies applied in 003_security.sql)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_progress ENABLE ROW LEVEL SECURITY;
