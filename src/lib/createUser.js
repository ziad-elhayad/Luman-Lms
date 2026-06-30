import { supabase } from '@/lib/supabase'

/**
 * Generic user creation function.
 * Creates an auth user and profile without logging out the current session.
 * 
 * @param {Object} config
 * @param {string} config.email - User email
 * @param {string} config.password - User password
 * @param {string} config.role - User role: 'super_admin', 'teacher', or 'student'
 * @param {Object} config.profileData - Additional profile fields (first_name, last_name, full_name, phone, grade, subjects, education_level, secondary_track)
 * @returns {Promise<Object>} The created auth user
 */
export async function createUserAccount({ email, password, role = 'student', profileData = {} }) {
  const { data: { session } } = await supabase.auth.getSession()

  // Create auth user with minimal metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { 
      data: { role }
    },
  })
  
  if (error) {
    const errorMsg = error?.message || error?.error_description || JSON.stringify(error)
    const err = new Error(errorMsg)
    err.originalError = error
    throw err
  }

  // Restore the original session (signUp can replace it)
  if (session?.access_token && session?.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (sessionError) {
      console.warn('Session restore error:', sessionError.message)
    }
  }

  // Create profile manually
  if (data.user?.id) {
    const profileRecord = {
      id: data.user.id,
      email: email.toLowerCase(),
      role,
      full_name: profileData.full_name || email.split('@')[0],
      first_name: profileData.first_name || null,
      last_name: profileData.last_name || null,
      phone: profileData.phone || null,
      grade: profileData.grade || null,
      subjects: profileData.subjects || [],
      education_level: profileData.education_level || null,
      secondary_track: profileData.secondary_track || null,
      teacher_id: profileData.teacher_id || null,
    }
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileRecord)
    
    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`)
    }
  }

  return data.user
}

/**
 * Create a student account
 */
export async function createStudent({
  email,
  password,
  firstName,
  lastName,
  fullName,
  phone,
  teacherId,
  grade,
  educationLevel,
  subjects,
}) {
  return createUserAccount({
    email,
    password,
    role: 'student',
    profileData: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName || `${firstName} ${lastName}`.trim(),
      phone,
      teacher_id: teacherId,
      grade: grade ?? null,
      education_level: educationLevel || null,
      subjects: subjects || [],
    },
  })
}

/**
 * Create a teacher account
 */
export async function createTeacher({ email, password, firstName, lastName, fullName, phone, educationLevel, secondaryTrack, subjects }) {
  return createUserAccount({
    email,
    password,
    role: 'teacher',
    profileData: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName || `${firstName} ${lastName}`.trim(),
      phone,
      education_level: educationLevel,
      secondary_track: secondaryTrack,
      subjects,
    },
  })
}

/**
 * Update teacher account (calls RPC function if available)
 */
export async function updateTeacher(userId, { firstName, lastName, email, phone, educationLevel, secondaryTrack, subjects, password }) {
  try {
    // Try to use the RPC function if it exists
    const { error } = await supabase.rpc('update_teacher_account', {
      p_user_id: userId,
      p_first_name: firstName?.trim() || null,
      p_last_name: lastName?.trim() || null,
      p_email: email?.trim().toLowerCase() || null,
      p_phone: phone?.trim() || null,
      p_education_level: educationLevel || null,
      p_secondary_track: secondaryTrack || null,
      p_subjects: subjects || [],
      p_password: password?.trim() || null,
    })
    if (error) throw error
  } catch (err) {
    // If RPC fails, fall back to manual update
    console.warn('RPC update failed, attempting manual update:', err.message)
    const updates = {
      first_name: firstName?.trim() || null,
      last_name: lastName?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      phone: phone?.trim() || null,
      education_level: educationLevel || null,
      secondary_track: secondaryTrack || null,
      subjects: subjects || [],
    }
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    if (updateError) throw updateError
  }
}

