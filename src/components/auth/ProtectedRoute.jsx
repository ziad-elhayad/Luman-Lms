import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wait for profile before role-gated routes
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const routes = { super_admin: '/admin', teacher: '/teacher', student: '/student' }
    return <Navigate to={routes[profile.role] || '/login'} replace />
  }

  if (profile?.disabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-danger">Account Disabled</h1>
          <p className="mt-2 text-muted-foreground">Please contact your administrator.</p>
        </div>
      </div>
    )
  }

  return children
}

export function PublicRoute({ children }) {
  const { isAuthenticated, loading, getDashboardRoute } = useAuth()

  if (loading) return null

  if (isAuthenticated) {
    return <Navigate to={getDashboardRoute()} replace />
  }

  return children
}
