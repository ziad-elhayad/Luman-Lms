-- Cloudinary metadata + lesson fields on course sessions
-- Run on existing databases

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS video_duration NUMERIC(10, 2);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_public_id ON public.sessions(public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON public.sessions(teacher_id)
  WHERE teacher_id IS NOT NULL;

-- Ensure teachers can INSERT lessons (explicit WITH CHECK)
DROP POLICY IF EXISTS "Teachers manage course sessions" ON public.sessions;

CREATE POLICY "Teachers manage course sessions" ON public.sessions
  FOR ALL
  USING (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );
