import {
  getAvailableSubjects,
  needsSecondaryTrack,
  pruneSubjects,
} from '@/lib/teacherSubjects'

export const EMPTY_TEACHER_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  educationLevel: '',
  secondaryTrack: '',
  subjects: [],
}

export function profileToTeacherForm(profile) {
  let firstName = profile?.first_name || ''
  let lastName = profile?.last_name || ''
  if (!firstName && profile?.full_name) {
    const parts = profile.full_name.trim().split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  const educationLevel = profile?.education_level || ''
  const secondaryTrack = profile?.secondary_track || ''
  const rawSubjects = Array.isArray(profile?.subjects) ? profile.subjects : []

  return {
    firstName,
    lastName,
    email: profile?.email || '',
    phone: profile?.phone || '',
    password: '',
    confirmPassword: '',
    educationLevel,
    secondaryTrack,
    subjects: pruneSubjects(rawSubjects, educationLevel, secondaryTrack),
  }
}

export function applyTeacherFormChange(form, patch) {
  const next = { ...form, ...patch }

  if ('educationLevel' in patch) {
    if (!needsSecondaryTrack(next.educationLevel)) {
      next.secondaryTrack = ''
    }
    next.subjects = pruneSubjects(next.subjects, next.educationLevel, next.secondaryTrack)
  }

  if ('secondaryTrack' in patch) {
    next.subjects = pruneSubjects(next.subjects, next.educationLevel, next.secondaryTrack)
  }

  return next
}

export function validateTeacherForm(form, isEdit) {
  const errors = {}

  if (!form.firstName.trim()) errors.firstName = 'First name is required'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required'

  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone is required'
  } else if (!/^[\d\s+\-().]{7,20}$/.test(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number'
  }

  if (!form.educationLevel) {
    errors.educationLevel = 'Education level is required'
  }

  if (needsSecondaryTrack(form.educationLevel) && !form.secondaryTrack) {
    errors.secondaryTrack = 'Secondary track is required'
  }

  const available = getAvailableSubjects(form.educationLevel, form.secondaryTrack)
  if (!form.subjects?.length) {
    errors.subjects = 'Select at least one subject'
  } else if (form.subjects.some((id) => !available.find((s) => s.id === id))) {
    errors.subjects = 'Some selected subjects are not valid for this level and track'
  }

  const changingPassword = Boolean(form.password || form.confirmPassword)

  if (!isEdit) {
    if (!form.password) errors.password = 'Password is required'
    else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters'
    if (!form.confirmPassword) errors.confirmPassword = 'Please confirm the password'
    else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  } else if (changingPassword) {
    if (!form.password) errors.password = 'Password is required when confirming'
    else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  }

  return errors
}

export function teacherDisplayName(profile) {
  if (profile?.first_name || profile?.last_name) {
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  }
  return profile?.full_name || ''
}
