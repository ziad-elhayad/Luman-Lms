export const STUDENT_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
}

export function isStudentPending(profile) {
  return profile?.role === 'student' && profile?.status === STUDENT_STATUS.PENDING
}

export function isStudentActive(profile) {
  return profile?.role === 'student' && (profile?.status === STUDENT_STATUS.ACTIVE || !profile?.status)
}

export function isStudentRejected(profile) {
  return profile?.role === 'student' && profile?.status === STUDENT_STATUS.REJECTED
}

export function studentDashboardRoute(profile) {
  if (isStudentPending(profile)) return '/student/pending'
  if (isStudentRejected(profile)) return '/student/rejected'
  return '/student'
}
