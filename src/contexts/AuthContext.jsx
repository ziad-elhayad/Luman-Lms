import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

const ROLE_ROUTES = {
  super_admin: '/admin',
  teacher: '/teacher',
  student: '/student',
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
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const meta = authUser?.user_metadata || {}
    let needsUpdate = false
    const updates = {}

    // Sync role from auth metadata if profile has wrong/default role
    if (meta.role && meta.role !== data.role && ['super_admin', 'teacher', 'student'].includes(meta.role)) {
      updates.role = meta.role
      data.role = meta.role
      needsUpdate = true
    }

    // Sync grade for students
    if (data.role === 'student' && data.grade == null && meta.grade != null) {
      const grade = typeof meta.grade === 'number' ? meta.grade : parseInt(meta.grade, 10)
      if (!Number.isNaN(grade)) {
        updates.grade = grade
        data.grade = grade
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await supabase.from('profiles').update(updates).eq('id', userId)
    }

    return data
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
