import { supabase } from '@/lib/supabase'
import { validateVideoFile } from '@/lib/videoConstants'

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) {
    throw new Error('You must be signed in to upload videos.')
  }
  return session.access_token
}

async function callEdgeFunction(name, body) {
  const token = await getAccessToken()
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export function buildThumbnailUrl(cloudName, publicId) {
  const segments = publicId.split('/').map(encodeURIComponent).join('/')
  return `https://res.cloudinary.com/${cloudName}/video/upload/w_400,h_225,c_fill,so_0/${segments}.jpg`
}

export async function getUploadSignature(courseId = null) {
  return callEdgeFunction('cloudinary-sign', courseId ? { courseId } : {})
}

export function uploadVideoToCloudinary(file, credentials, onProgress) {
  const validationError = validateVideoFile(file)
  if (validationError) {
    return Promise.reject(new Error(validationError))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', credentials.apiKey)
    formData.append('timestamp', credentials.timestamp)
    formData.append('signature', credentials.signature)
    formData.append('folder', credentials.folder)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const result = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(result)
        } else {
          reject(new Error(result?.error?.message || 'Cloudinary upload failed'))
        }
      } catch {
        reject(new Error('Invalid response from Cloudinary'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${credentials.cloudName}/video/upload`)
    xhr.send(formData)
  })
}

export async function deleteVideoFromCloudinary(videoId, publicId) {
  return callEdgeFunction('cloudinary-delete', { videoId, publicId, resourceType: 'video' })
}

export async function destroyCloudinaryAsset(videoId, publicId) {
  return callEdgeFunction('cloudinary-delete', {
    videoId,
    publicId,
    resourceType: 'video',
    destroyOnly: true,
  })
}

export async function deleteSessionFromCloudinary(sessionId, publicId) {
  return callEdgeFunction('cloudinary-delete', {
    sessionId,
    publicId,
    resourceType: 'session',
  })
}

export async function destroySessionCloudinaryAsset(sessionId, publicId) {
  return callEdgeFunction('cloudinary-delete', {
    sessionId,
    publicId,
    resourceType: 'session',
    destroyOnly: true,
  })
}

export async function uploadTeacherVideo(file, onProgress, courseId = null) {
  const credentials = await getUploadSignature(courseId)
  const result = await uploadVideoToCloudinary(file, credentials, onProgress)

  const thumbnailUrl = buildThumbnailUrl(credentials.cloudName, result.public_id)

  return {
    videoUrl: result.secure_url,
    publicId: result.public_id,
    duration: result.duration ?? null,
    thumbnailUrl,
  }
}

/** Upload a video for a course session lesson */
export async function uploadSessionVideo(file, courseId, onProgress) {
  return uploadTeacherVideo(file, onProgress, courseId)
}
