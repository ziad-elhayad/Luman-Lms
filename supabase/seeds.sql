-- Lumen LMS — Demo seed data
-- Prerequisites: run migrations 001 → 002 → 003, then create Auth users (see README).

-- Confirm demo users (skip if you checked "Auto Confirm User" when creating them)
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email IN (
  'superadmin@lumen.edu',
  'teacher1@lumen.edu',
  'teacher2@lumen.edu',
  'student1@lumen.edu',
  'student2@lumen.edu',
  'student3@lumen.edu'
);

-- Insert courses, sessions, quizzes, enrollments, etc.
SELECT public.seed_lumen_data();
