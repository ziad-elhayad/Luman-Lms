-- Lumen LMS — Teacher invitation system (slug + student_teachers)
-- Run after 006_session_videos.sql on fresh projects.

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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_student_teachers_student ON public.student_teachers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_teachers_teacher ON public.student_teachers(teacher_id);

-- See supabase/patches/teacher_invitation_system.sql for functions and RLS updates.
-- Fresh installs should run the patch file after this migration for RPCs/policies.
