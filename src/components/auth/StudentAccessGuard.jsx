import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isStudentPending, isStudentRejected, studentDashboardRoute } from '@/lib/studentStatus'

/**
 * Guards student dashboard routes — pending/rejected students cannot access courses.
 */
export function StudentAccessGuard({ children }) {
  const { profile } = useAuth()
  const location = useLocation()

  if (isStudentPending(profile)) {
    return <Navigate to="/student/pending" replace />
  }

  if (isStudentRejected(profile)) {
    return <Navigate to="/student/rejected" replace />
  }

  if (profile?.role === 'student' && location.pathname === '/student/pending') {
    return <Navigate to={studentDashboardRoute(profile)} replace />
  }

  return children
}
