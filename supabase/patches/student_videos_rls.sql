-- Student read access for lesson videos (teacher + grade + level + subject match)
-- Run after videos_table.sql / 005_videos.sql

DROP POLICY IF EXISTS "Students view matching videos" ON public.videos;

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
