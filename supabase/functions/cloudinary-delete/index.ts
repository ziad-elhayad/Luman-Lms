import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  getCloudinaryConfig,
  getServiceClient,
  requireTeacher,
  signCloudinaryParams,
} from '../_shared/cloudinary.ts'

async function destroyCloudinaryVideo(publicId: string) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const paramsToSign = { public_id: publicId, timestamp }
  const signature = await signCloudinaryParams(paramsToSign, apiSecret)

  const destroyUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`
  const form = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp,
    signature,
  })

  const destroyRes = await fetch(destroyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const destroyData = await destroyRes.json()
  if (!destroyRes.ok && destroyData?.result !== 'not found') {
    console.error('Cloudinary destroy failed:', destroyData)
    throw new Error(destroyData?.error?.message || 'Failed to delete video from Cloudinary')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const auth = await requireTeacher(req)
    if ('error' in auth) {
      return errorResponse(auth.error, auth.status)
    }

    const body = await req.json()
    const publicId = body?.publicId
    const destroyOnly = body?.destroyOnly === true
    const resourceType = body?.resourceType || 'video'

    if (!publicId) {
      return errorResponse('publicId is required')
    }

    const service = getServiceClient()

    if (resourceType === 'session') {
      const sessionId = body?.sessionId
      if (!sessionId) {
        return errorResponse('sessionId is required for session resources')
      }

      const { data: session, error: fetchError } = await service
        .from('sessions')
        .select('id, public_id, course_id')
        .eq('id', sessionId)
        .single()

      if (fetchError || !session) {
        return errorResponse('Session not found', 404)
      }

      const { data: course, error: courseError } = await service
        .from('courses')
        .select('teacher_id')
        .eq('id', session.course_id)
        .single()

      if (courseError || !course || course.teacher_id !== auth.user.id) {
        return errorResponse('Forbidden', 403)
      }

      if (!destroyOnly && session.public_id && session.public_id !== publicId) {
        return errorResponse('publicId mismatch', 400)
      }

      await destroyCloudinaryVideo(publicId)

      if (!destroyOnly) {
        const { error: deleteError } = await service
          .from('sessions')
          .delete()
          .eq('id', sessionId)

        if (deleteError) {
          return errorResponse('Video removed from Cloudinary but session delete failed', 500)
        }
      }

      return jsonResponse({ success: true })
    }

    // Default: standalone lesson videos table
    const videoId = body?.videoId
    if (!videoId) {
      return errorResponse('videoId is required')
    }

    const { data: video, error: fetchError } = await service
      .from('videos')
      .select('id, teacher_id, public_id')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      return errorResponse('Video not found', 404)
    }

    if (video.teacher_id !== auth.user.id) {
      return errorResponse('Forbidden', 403)
    }

    if (!destroyOnly && video.public_id !== publicId) {
      return errorResponse('publicId mismatch', 400)
    }

    await destroyCloudinaryVideo(publicId)

    if (!destroyOnly) {
      const { error: deleteError } = await service
        .from('videos')
        .delete()
        .eq('id', videoId)

      if (deleteError) {
        return errorResponse('Video removed from Cloudinary but database delete failed', 500)
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('cloudinary-delete error:', err)
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500)
  }
})
