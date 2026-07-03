export const EMPTY_STUDENT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  educationLevel: 'middle',
  gradeYear: '1',
  subjects: [],
  courseIds: [],
  password: '',
  confirmPassword: '',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function studentDisplayName(profile) {
  if (profile?.first_name || profile?.last_name) {
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  }
  return profile?.full_name || ''
}

export function profileToStudentForm(profile, courseIds = []) {
  let firstName = profile?.first_name || ''
  let lastName = profile?.last_name || ''
  if (!firstName && profile?.full_name) {
    const parts = profile.full_name.trim().split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  return {
    firstName,
    lastName,
    email: profile?.email || '',
    phone: profile?.phone || '',
    educationLevel: profile?.education_level || 'middle',
    gradeYear: profile?.grade ? String(profile.grade) : '1',
    subjects: Array.isArray(profile?.subjects) ? profile.subjects : [],
    courseIds,
    password: '',
    confirmPassword: '',
  }
}

export function applyStudentFormChange(form, patch) {
  const next = { ...form, ...patch }
  if ('educationLevel' in patch) {
    next.subjects = []
  }
  return next
}

/**
 * @param {object} form
 * @param {object} options
 * @param {boolean} [options.isEdit]
 * @param {boolean} [options.requirePassword]
 * @param {boolean} [options.requireCourses]
 */
export function validateStudentForm(form, options = {}) {
  const {
    isEdit = false,
    requirePassword = !isEdit,
    requireCourses = false,
  } = options

  const errors = {}

  if (!form.firstName?.trim()) errors.firstName = 'First name is required'
  if (!form.lastName?.trim()) errors.lastName = 'Last name is required'

  if (!form.email?.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (form.phone?.trim() && !/^[\d\s+\-().]{7,20}$/.test(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number'
  }

  if (!form.educationLevel) errors.educationLevel = 'Education level is required'
  if (!form.gradeYear) errors.gradeYear = 'Grade year is required'
  if (!form.subjects?.length) errors.subjects = 'Select at least one subject'

  if (requireCourses && !form.courseIds?.length) {
    errors.courseIds = 'Assign at least one course'
  }

  const changingPassword = Boolean(form.password || form.confirmPassword)

  if (requirePassword) {
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

export function studentFormToPayload(form) {
  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    fullName,
    email: form.email.trim().toLowerCase(),
    phone: form.phone?.trim() || null,
    grade: Number(form.gradeYear),
    educationLevel: form.educationLevel,
    subjects: form.subjects || [],
    password: form.password,
  }
}
