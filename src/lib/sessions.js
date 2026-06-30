import { supabase } from '@/lib/supabase'

export function sessionHasVideo(session) {
  return Boolean(session?.video_url?.trim())
}

export function sessionToPlayerVideo(session) {
  if (!session) return null
  return {
    id: session.id,
    title: session.title,
    video_url: session.video_url,
    public_id: session.public_id,
    thumbnail_url: session.thumbnail_url,
    duration: session.video_duration,
  }
}

/** Build DB row from form + Cloudinary asset (call only after upload succeeds). */
export function buildSessionFromUpload(form, asset) {
  if (!asset?.videoUrl?.trim()) {
    throw new Error('Cloudinary upload did not return a video URL.')
  }
  if (!asset.publicId) {
    throw new Error('Cloudinary upload did not return a public ID.')
  }

  const durationMin = Number(form.duration_min) || 0
  const videoSeconds = asset.duration != null ? Number(asset.duration) : null

  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    duration_min: videoSeconds
      ? Math.max(durationMin, Math.ceil(videoSeconds / 60))
      : (durationMin || 1),
    order_no: Number(form.order_no) || 1,
    locked: Boolean(form.locked),
    video_url: asset.videoUrl.trim(),
    public_id: asset.publicId,
    thumbnail_url: asset.thumbnailUrl || null,
    video_duration: videoSeconds,
  }
}

export function buildSessionFromUrl(form) {
  if (!form.video_url?.trim()) {
    throw new Error('Video URL is required.')
  }
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    duration_min: Number(form.duration_min) || 1,
    order_no: Number(form.order_no) || 1,
    locked: Boolean(form.locked),
    video_url: form.video_url.trim(),
    public_id: null,
    thumbnail_url: null,
    video_duration: null,
  }
}

export function buildSessionMetadataOnly(form, existingSession) {
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    duration_min: Number(form.duration_min) || existingSession.duration_min || 1,
    order_no: Number(form.order_no) || existingSession.order_no || 1,
    locked: Boolean(form.locked),
    video_url: existingSession.video_url,
    public_id: existingSession.public_id,
    thumbnail_url: existingSession.thumbnail_url,
    video_duration: existingSession.video_duration,
  }
}

/**
 * Insert lesson row — must be called only after Cloudinary upload succeeds.
 */
export async function insertSession(courseId, teacherId, payload) {
  const row = {
    course_id: courseId,
    teacher_id: teacherId,
    ...payload,
  }

  console.info('[sessions] inserting lesson', {
    courseId,
    teacherId,
    title: row.title,
    publicId: row.public_id,
  })

  const { data, error } = await supabase
    .from('sessions')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('[sessions] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      row,
    })
    throw new Error(error.message || 'Failed to save lesson to the database.')
  }

  console.info('[sessions] insert succeeded', { id: data.id, courseId: data.course_id })
  return data
}

export async function updateSessionRecord(sessionId, teacherId, payload) {
  console.info('[sessions] updating lesson', { sessionId, title: payload.title })

  const { data, error } = await supabase
    .from('sessions')
    .update({ ...payload, teacher_id: teacherId })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) {
    console.error('[sessions] update failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      sessionId,
    })
    throw new Error(error.message || 'Failed to update lesson.')
  }

  console.info('[sessions] update succeeded', { id: data.id })
  return data
}

export function mergeSessionIntoList(sessions, saved) {
  const list = [...(sessions || [])]
  const index = list.findIndex((s) => s.id === saved.id)
  if (index >= 0) {
    list[index] = saved
  } else {
    list.push(saved)
  }
  list.sort((a, b) => a.order_no - b.order_no)
  return list
}

export async function deleteSessionRecord(sessionId) {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) throw error
}
