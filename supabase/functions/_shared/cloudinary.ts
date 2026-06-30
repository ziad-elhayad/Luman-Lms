import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function requireTeacher(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization', status: 401 as const }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Server configuration error', status: 500 as const }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'teacher') {
    return { error: 'Forbidden: teachers only', status: 403 as const }
  }

  return { user, profile, supabase }
}

export function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service configuration')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export function getCloudinaryConfig() {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing Cloudinary configuration')
  }
  return { cloudName, apiKey, apiSecret }
}

export async function signCloudinaryParams(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  const toSign = sorted + apiSecret
  const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function buildThumbnailUrl(cloudName: string, publicId: string) {
  const segments = publicId.split('/').map(encodeURIComponent).join('/')
  return `https://res.cloudinary.com/${cloudName}/video/upload/w_400,h_225,c_fill,so_0/${segments}.jpg`
}
