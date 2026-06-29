-- Run once on EXISTING Supabase projects (SQL Editor)
-- Adds admin delete-user RPC used by the admin dashboard

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
BEGIN
  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF public.get_user_role() = 'teacher' AND target_role <> 'student' THEN
    RAISE EXCEPTION 'Teachers are only authorized to delete student accounts';
  END IF;

  IF public.get_user_role() NOT IN ('super_admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized to delete users';
  END IF;

  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot delete super admin accounts';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

ALTER FUNCTION public.delete_user_account(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- Refresh API schema cache so RPC is available immediately
NOTIFY pgrst, 'reload schema';
