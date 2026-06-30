export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/ogg',
]

export const VIDEO_EDUCATION_LEVELS = [
  { value: 'middle', label: 'Middle School' },
  { value: 'secondary', label: 'Secondary School' },
]

export const GRADE_YEARS = [
  { value: 1, label: 'Grade 1' },
  { value: 2, label: 'Grade 2' },
  { value: 3, label: 'Grade 3' },
]

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const total = Math.round(Number(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatUploadDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function validateVideoFile(file) {
  if (!file) return 'Please select a video file.'
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return 'Invalid file type. Please upload MP4, WebM, MOV, AVI, MKV, or OGG.'
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return `File is too large. Maximum size is ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB.`
  }
  return null
}
