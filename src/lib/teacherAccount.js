/**
 * DEPRECATED: This module is kept for backward compatibility only.
 * Use createTeacher, updateTeacher, and createStudent from createUser.js instead.
 */

import { createTeacher, updateTeacher } from '@/lib/createUser'

// Re-export for backward compatibility
export async function createTeacherAccount(form) {
  const fullName = `${form.firstName} ${form.lastName}`.trim()
  return createTeacher({
    email: form.email,
    password: form.password,
    firstName: form.firstName,
    lastName: form.lastName,
    fullName,
    phone: form.phone,
    educationLevel: form.educationLevel,
    secondaryTrack: form.secondaryTrack,
    subjects: form.subjects,
  })
}

export async function updateTeacherAccount(form, userId) {
  return updateTeacher(userId, {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    educationLevel: form.educationLevel,
    secondaryTrack: form.secondaryTrack,
    subjects: form.subjects,
    password: form.password || null,
  })
}

