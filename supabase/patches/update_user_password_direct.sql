-- Add update_user_password_direct function to allow teachers/admins to sync student/teacher passwords in auth.users
CREATE OR REPLACE FUNCTION public.update_user_password_direct(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
  target_role text;
BEGIN
  caller_role := public.get_user_role();
  IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized to update user password';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF caller_role = 'teacher' AND target_role <> 'student' THEN
    RAISE EXCEPTION 'Teachers can only update student accounts';
  END IF;

  -- Update auth.users password
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

ALTER FUNCTION public.update_user_password_direct(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_user_password_direct(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_password_direct(uuid, text) TO authenticated;

-- Refresh API schema cache
NOTIFY pgrst, 'reload schema';
