import { createUserAccount } from '@/lib/createUser'
import { supabase } from '@/lib/supabase'

function teacherPayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    educationLevel: form.educationLevel,
    secondaryTrack: form.secondaryTrack || null,
    subjects: form.subjects || [],
    password: form.password?.trim() || null,
  }
}

export async function updateTeacherAccount(form, userId) {
  const p = teacherPayload(form)
  const { error } = await supabase.rpc('update_teacher_account', {
    p_user_id: userId,
    p_first_name: p.firstName,
    p_last_name: p.lastName,
    p_email: p.email,
    p_phone: p.phone,
    p_education_level: p.educationLevel,
    p_secondary_track: p.secondaryTrack,
    p_subjects: p.subjects,
    p_password: p.password,
  })
  if (error) throw error
}

export async function createTeacherAccount(form) {
  const p = teacherPayload(form)
  const fullName = `${p.firstName} ${p.lastName}`

  const user = await createUserAccount({
    email: p.email,
    password: form.password,
    metadata: {
      first_name: p.firstName,
      last_name: p.lastName,
      full_name: fullName,
      phone: p.phone,
      education_level: p.educationLevel,
      secondary_track: p.secondaryTrack,
      subjects: p.subjects,
      role: 'teacher',
    },
  })

  if (user?.id) {
    const { error } = await supabase.from('profiles').update({
      first_name: p.firstName,
      last_name: p.lastName,
      full_name: fullName,
      phone: p.phone,
      email: p.email,
      education_level: p.educationLevel,
      secondary_track: p.secondaryTrack,
      subjects: p.subjects,
    }).eq('id', user.id)
    if (error) throw error
  }

  return user
}
