-- =============================================================================
-- Lumen LMS — Exam System Tables + RLS
-- Run this in Supabase SQL Editor (after 003_security.sql has been applied).
-- Safe to re-run: uses IF NOT EXISTS / DROP … IF EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exams_dates_check CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id       UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  order_no      INTEGER NOT NULL DEFAULT 0,
  type          TEXT NOT NULL CHECK (type IN ('mcq', 'written')),
  text          TEXT,
  image_url     TEXT,
  options       JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id        ON public.exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id  ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_order    ON public.exam_questions(exam_id, order_no);

-- Enable RLS
ALTER TABLE public.exams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS Policies — exams
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admin full access exams"        ON public.exams;
DROP POLICY IF EXISTS "Teachers manage own exams"            ON public.exams;
DROP POLICY IF EXISTS "Students can view exams"              ON public.exams;

CREATE POLICY "Super admin full access exams" ON public.exams
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage own exams" ON public.exams
  FOR ALL
  USING    (public.get_user_role() = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY "Students can view exams" ON public.exams
  FOR SELECT USING (public.get_user_role() = 'student');

-- ---------------------------------------------------------------------------
-- 3. RLS Policies — exam_questions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admin full access exam_questions"    ON public.exam_questions;
DROP POLICY IF EXISTS "Teachers manage own exam questions"        ON public.exam_questions;
DROP POLICY IF EXISTS "Students can view exam questions"          ON public.exam_questions;

CREATE POLICY "Super admin full access exam_questions" ON public.exam_questions
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage own exam questions" ON public.exam_questions
  FOR ALL
  USING (
    public.get_user_role() = 'teacher'
    AND exam_id IN (SELECT id FROM public.exams WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND exam_id IN (SELECT id FROM public.exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students can view exam questions" ON public.exam_questions
  FOR SELECT USING (public.get_user_role() = 'student');

-- ---------------------------------------------------------------------------
-- 4. Table grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
