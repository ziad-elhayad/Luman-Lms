import { supabase } from '@/lib/supabase'
import { normalizeTeacherSlug } from '@/lib/teacherSlug'

/**
 * Fetch public teacher profile for invitation landing page.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function getPublicTeacherBySlug(slug) {
  const normalized = normalizeTeacherSlug(slug)
  if (!normalized) return null

  const { data, error } = await supabase.rpc('get_public_teacher_by_slug', {
    p_slug: normalized,
  })

  if (error) throw error
  return data?.[0] ?? null
}

/**
 * Check if a teacher slug is available (super_admin only).
 * @param {string} slug
 * @param {string|null} excludeUserId
 */
export async function isTeacherSlugAvailable(slug, excludeUserId = null) {
  const normalized = normalizeTeacherSlug(slug)
  const { data, error } = await supabase.rpc('is_teacher_slug_available', {
    p_slug: normalized,
    p_exclude_user_id: excludeUserId,
  })
  if (error) throw error
  return Boolean(data)
}

/**
 * Link the authenticated student to a teacher via slug (backend-validated).
 * @param {string} teacherSlug
 * @returns {Promise<string>} teacher id
 */
export async function joinTeacherBySlug(teacherSlug) {
  const normalized = normalizeTeacherSlug(teacherSlug)
  const { data, error } = await supabase.rpc('join_teacher_by_slug', {
    p_teacher_slug: normalized,
  })
  if (error) throw error
  return data
}

/**
 * Approve a pending student (teacher only).
 * @param {string} studentId
 */
export async function approveStudent(studentId) {
  const { error } = await supabase.rpc('approve_student', { p_student_id: studentId })
  if (error) throw error
}

/**
 * Reject a pending student (teacher only).
 * @param {string} studentId
 */
export async function rejectStudent(studentId) {
  const { error } = await supabase.rpc('reject_student', { p_student_id: studentId })
  if (error) throw error
}

/**
 * Sync grade-matched enrollments for a student.
 * @param {string} studentId
 */
export async function syncGradeEnrollments(studentId) {
  const { error } = await supabase.rpc('sync_grade_enrollments', { p_student_id: studentId })
  if (error) throw error
}

/**
 * Sync enrollments for all active students when a course is created/updated.
 * @param {string} teacherId
 * @param {number} grade
 */
export async function syncTeacherGradeEnrollments(teacherId, grade) {
  const { error } = await supabase.rpc('sync_teacher_grade_enrollments', {
    p_teacher_id: teacherId,
    p_grade: grade,
  })
  if (error) throw error
}
