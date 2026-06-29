-- Add teacher_id column to profiles table for teacher-scoped students
-- This field links a student to their primary teacher for management purposes

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster queries when filtering students by teacher
CREATE INDEX IF NOT EXISTS idx_profiles_teacher_id ON public.profiles(teacher_id)
WHERE role = 'student';

CREATE INDEX IF NOT EXISTS idx_profiles_teacher_id_role ON public.profiles(teacher_id, role);
