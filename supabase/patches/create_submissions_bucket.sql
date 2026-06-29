-- Create the submissions storage bucket for assignment file uploads
-- Run in Supabase SQL Editor if uploads fail with "Bucket not found"

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('submissions', 'submissions', true, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Allow students to overwrite their own files (re-upload assignment)
DROP POLICY IF EXISTS "Students update own submission files" ON storage.objects;
CREATE POLICY "Students update own submission files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students delete own submission files" ON storage.objects;
CREATE POLICY "Students delete own submission files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
