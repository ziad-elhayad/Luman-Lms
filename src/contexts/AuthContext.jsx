import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { studentDashboardRoute } from '@/lib/studentStatus'

const AuthContext = createContext(null)

const ROLE_ROUTES = {
  super_admin: '/admin',
  teacher: '/teacher',
  student: '/student',
}

const VALID_ROLES = ['super_admin', 'teacher', 'student']

async function bootstrapProfile(userId) {
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
  if (userError || !authUser || authUser.id !== userId) return null

  const meta = authUser.user_metadata || {}
  const role = VALID_ROLES.includes(meta.role) ? meta.role : 'student'
  const fullName = meta.full_name || authUser.email?.split('@')[0] || 'User'

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: authUser.email?.toLowerCase() || null,
      role,
      full_name: fullName,
    }, { onConflict: 'id' })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error bootstrapping profile:', error)
    const { data: retry } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    return retry
  }

  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    let profileData = data
    if (!profileData) {
      profileData = await bootstrapProfile(userId)
      if (!profileData) return null
    }

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const meta = authUser?.user_metadata || {}
    let needsUpdate = false
    const updates = {}

    if (meta.role && meta.role !== profileData.role && VALID_ROLES.includes(meta.role)) {
      updates.role = meta.role
      profileData.role = meta.role
      needsUpdate = true
    }

    if (needsUpdate) {
      await supabase.from('profiles').update(updates).eq('id', userId)
    }

    return profileData
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const p = await fetchProfile(data.user.id)

    // Block disabled accounts (rejected students can still sign in to see rejection page)
    if (p?.disabled && p?.status !== 'rejected') {
      await supabase.auth.signOut()
      throw new Error('Your account has been disabled. Please contact your teacher or administrator.')
    }

    setProfile(p)
    return { user: data.user, profile: p }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw error
  }

  const getDashboardRoute = () => {
    if (!profile?.role) return '/login'
    if (profile.role === 'student') return studentDashboardRoute(profile)
    return ROLE_ROUTES[profile.role] || '/login'
  }

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id)
      setProfile(p)
      return p
    }
    return null
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        resetPassword,
        getDashboardRoute,
        refreshProfile,
        isAuthenticated: !!user,
        role: profile?.role,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ROLE_ROUTES }
