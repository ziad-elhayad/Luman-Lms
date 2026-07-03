-- Re-run if you already applied teacher_invitation_system.sql before subject fields were added.
-- Extends public teacher lookup with education_level + secondary_track for registration form.

CREATE OR REPLACE FUNCTION public.get_public_teacher_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  subjects jsonb,
  education_level text,
  secondary_track text,
  bio text,
  academy text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := public.normalize_teacher_slug(p_slug);
  IF NOT public.is_valid_teacher_slug(v_slug) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.subjects,
    p.education_level,
    p.secondary_track,
    p.bio,
    p.academy
  FROM public.profiles p
  WHERE p.slug = v_slug
    AND p.role = 'teacher'
    AND COALESCE(p.disabled, false) = false;
END;
$$;

ALTER FUNCTION public.get_public_teacher_by_slug(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_by_slug(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
