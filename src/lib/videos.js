import { supabase } from '@/lib/supabase'
import { getAvailableSubjects, subjectLabel } from '@/lib/teacherSubjects'

export function getTeacherSubjectOptions(profile, educationLevel) {
  const assigned = new Set(profile?.subjects || [])
  const available = getAvailableSubjects(
    educationLevel === 'secondary' ? 'secondary' : 'middle',
    profile?.secondary_track,
  )
  return available.filter((s) => assigned.has(s.id))
}

export function getStudentVideoProfileIssues(profile) {
  const issues = []
  if (!profile?.teacher_id) issues.push('You are not linked to a teacher yet.')
  if (profile?.grade == null || profile.grade < 1 || profile.grade > 3) {
    issues.push('Your grade year is not set.')
  }
  if (!profile?.education_level || !['middle', 'secondary'].includes(profile.education_level)) {
    issues.push('Your education level is not set.')
  }
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects : []
  if (subjects.length === 0) issues.push('No subjects are assigned to your profile.')
  return issues
}

const VIDEO_SELECT_FIELDS = 'id, teacher_id, title, description, education_level, grade_year, subject, video_url, public_id, thumbnail_url, duration, created_at'

export async function fetchStudentVideos(profile) {
  const issues = getStudentVideoProfileIssues(profile)
  if (issues.length) {
    const err = new Error('Student profile is incomplete for video access.')
    err.code = 'PROFILE_INCOMPLETE'
    err.issues = issues
    throw err
  }

  const subjects = profile.subjects

  const { data, error } = await supabase
    .from('videos')
    .select(VIDEO_SELECT_FIELDS)
    .eq('teacher_id', profile.teacher_id)
    .eq('education_level', profile.education_level)
    .eq('grade_year', profile.grade)
    .in('subject', subjects)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data || []
  for (const row of rows) {
    if (!row.video_url?.trim()) {
      console.warn('[fetchStudentVideos] Missing video_url — will try public_id fallback:', {
        id: row.id,
        title: row.title,
        public_id: row.public_id,
      })
    }
  }
  return rows
}

export async function fetchTeacherVideos(teacherId) {
  const { data, error } = await supabase
    .from('videos')
    .select(VIDEO_SELECT_FIELDS)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createVideoRecord(teacherId, payload) {
  if (!payload.videoUrl?.trim()) {
    throw new Error('Cloudinary did not return a video URL.')
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      teacher_id: teacherId,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      education_level: payload.educationLevel,
      grade_year: payload.gradeYear,
      subject: payload.subject,
      video_url: payload.videoUrl?.trim(),
      public_id: payload.publicId,
      thumbnail_url: payload.thumbnailUrl,
      duration: payload.duration,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateVideoMetadata(videoId, payload) {
  const { data, error } = await supabase
    .from('videos')
    .update({
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      grade_year: payload.gradeYear,
      subject: payload.subject,
    })
    .eq('id', videoId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function replaceVideoAsset(videoId, asset) {
  if (!asset.videoUrl?.trim()) {
    throw new Error('Cloudinary did not return a video URL.')
  }

  const { data, error } = await supabase
    .from('videos')
    .update({
      video_url: asset.videoUrl.trim(),
      public_id: asset.publicId,
      thumbnail_url: asset.thumbnailUrl,
      duration: asset.duration,
    })
    .eq('id', videoId)
    .select()
    .single()

  if (error) throw error
  return data
}

export function videoSubjectLabel(subject) {
  return subjectLabel(subject)
}

export function videoGradeLabel(educationLevel, gradeYear) {
  const level = educationLevel === 'secondary' ? 'Secondary' : 'Middle'
  return `${level} — Grade ${gradeYear}`
}
