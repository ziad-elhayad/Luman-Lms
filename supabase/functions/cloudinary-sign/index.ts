import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  getCloudinaryConfig,
  requireTeacher,
  signCloudinaryParams,
} from '../_shared/cloudinary.ts'

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

    const body = await req.json().catch(() => ({}))
    const courseId = body?.courseId

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const folder = courseId
      ? `lumen-sessions/${auth.user.id}/${courseId}`
      : `lumen-videos/${auth.user.id}`

    const paramsToSign = { folder, timestamp }
    const signature = await signCloudinaryParams(paramsToSign, apiSecret)

    return jsonResponse({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
    })
  } catch (err) {
    console.error('cloudinary-sign error:', err)
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500)
  }
})
