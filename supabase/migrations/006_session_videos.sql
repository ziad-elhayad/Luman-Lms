-- Lumen LMS — Cloudinary metadata on course sessions (video file stored in Cloudinary)
-- Run after 005_videos.sql

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS video_duration NUMERIC(10, 2);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_public_id ON public.sessions(public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON public.sessions(teacher_id)
  WHERE teacher_id IS NOT NULL;
