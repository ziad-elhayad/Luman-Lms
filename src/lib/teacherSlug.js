/** Normalize user input into a URL-safe teacher slug. */
export function normalizeTeacherSlug(value) {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Validate slug format. Returns error message or null if valid. */
export function validateTeacherSlug(slug) {
  const normalized = normalizeTeacherSlug(slug)
  if (!normalized) return 'Teacher slug is required'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized)) {
    return 'Use only lowercase letters, numbers, and hyphens (e.g. ahmed-math)'
  }
  return null
}

/** Build the full invitation URL for a teacher slug. */
export function buildInvitationUrl(slug) {
  const normalized = normalizeTeacherSlug(slug)
  if (!normalized) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join/${normalized}`
}

/** Copy text to clipboard with fallback. */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
