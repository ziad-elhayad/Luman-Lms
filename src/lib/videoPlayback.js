/**
 * Resolve the Cloudinary secure_url for HTML5 playback.
 * Accepts snake_case (DB: video_url) or camelCase (upload: videoUrl).
 */
export function getVideoPlaybackUrl(video) {
  if (!video) return null

  const direct = (video.video_url || video.videoUrl || '').trim()
  if (direct) return direct

  if (video.public_id) {
    return buildUrlFromPublicId(video.public_id, direct)
  }

  return null
}

function extractCloudName(url) {
  const match = url?.match(/res\.cloudinary\.com\/([^/]+)\//)
  return match?.[1] || null
}

function buildUrlFromPublicId(publicId, hintUrl = '') {
  const cloudName = extractCloudName(hintUrl) || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return null

  const segments = publicId.split('/').map(encodeURIComponent).join('/')
  return `https://res.cloudinary.com/${cloudName}/video/upload/f_auto,q_auto/${segments}`
}

export function isYouTubeEmbedUrl(url) {
  if (!url) return false
  return /youtube\.com|youtu\.be/i.test(url)
}

export function getMediaErrorMessage(mediaError) {
  if (!mediaError) return 'Unknown playback error'
  switch (mediaError.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted.'
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Network error while loading the video.'
    case MediaError.MEDIA_ERR_DECODE:
      return 'The video could not be decoded.'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'This video format or URL is not supported.'
    default:
      return mediaError.message || 'Playback failed.'
  }
}

export function logVideoPlaybackError(video, context, details = {}) {
  console.error('[VideoPlayback]', {
    context,
    videoId: video?.id,
    title: video?.title,
    video_url: video?.video_url ?? null,
    videoUrl: video?.videoUrl ?? null,
    public_id: video?.public_id ?? null,
    resolvedUrl: getVideoPlaybackUrl(video),
    ...details,
  })
}

/** Diagnostic HEAD request — logs only, never blocks playback. */
export async function checkVideoUrlAccessible(url) {
  if (!url) return { ok: false, status: 0, error: 'No URL' }

  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'cors' })
    return {
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network error',
    }
  }
}
