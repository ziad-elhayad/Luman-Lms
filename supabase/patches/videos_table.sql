-- =============================================================================
-- Lumen LMS — Teacher lesson videos (Cloudinary metadata)
-- Run in Supabase SQL Editor on existing databases.
-- Safe to re-run: uses IF NOT EXISTS / DROP … IF EXISTS guards.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.videos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  education_level TEXT NOT NULL CHECK (education_level IN ('middle', 'secondary')),
  grade_year      INTEGER NOT NULL CHECK (grade_year BETWEEN 1 AND 3),
  subject         TEXT NOT NULL,
  video_url       TEXT NOT NULL,
  public_id       TEXT NOT NULL,
  thumbnail_url   TEXT,
  duration        NUMERIC(10, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_teacher_id ON public.videos(teacher_id);
CREATE INDEX IF NOT EXISTS idx_videos_subject ON public.videos(subject);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access videos" ON public.videos;
DROP POLICY IF EXISTS "Teachers manage own videos" ON public.videos;

CREATE POLICY "Super admin full access videos" ON public.videos
  FOR ALL USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Teachers manage own videos" ON public.videos
  FOR ALL
  USING    (public.get_user_role() = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY "Students view matching videos" ON public.videos
  FOR SELECT USING (
    public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'student'
        AND p.teacher_id IS NOT NULL
        AND p.grade IS NOT NULL
        AND p.education_level IN ('middle', 'secondary')
        AND jsonb_typeof(p.subjects) = 'array'
        AND jsonb_array_length(p.subjects) > 0
        AND videos.teacher_id = p.teacher_id
        AND videos.grade_year = p.grade
        AND videos.education_level = p.education_level
        AND p.subjects @> to_jsonb(videos.subject)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
