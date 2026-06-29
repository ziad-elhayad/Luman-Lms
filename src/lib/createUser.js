import { supabase } from '@/lib/supabase'

/**
 * Create an auth user without logging out the current admin/teacher session.
 * Also confirms the email so the new user can sign in immediately.
 */
export async function createUserAccount({ email, password, metadata }) {
  const { data: { session } } = await supabase.auth.getSession()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })
  if (error) throw error

  // signUp can replace the active session with the new user when confirmations are off
  if (session?.access_token && session?.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (sessionError) throw sessionError
  }

  const { error: confirmError } = await supabase.rpc('confirm_user_email', {
    p_email: email,
  })
  if (confirmError) throw confirmError

  return data.user
}
