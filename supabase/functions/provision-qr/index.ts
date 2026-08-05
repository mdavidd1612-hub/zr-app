// T-106: Provision QR Secret · Edge Function
// Genera y entrega el secreto TOTP del estudiante, una sola vez.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function okResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function userClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Genera un secreto TOTP aleatorio en base32 (20 bytes = 32 caracteres en base32)
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  const randomValues = new Uint8Array(20)
  crypto.getRandomValues(randomValues)
  for (const byte of randomValues) {
    secret += chars[byte % 32]
  }
  return secret
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)
  }

  const userSb = userClient(req)

  // 1. Obtener el usuario del token
  const { data: userData, error: userError } = await userSb.auth.getUser()
  if (userError || !userData.user) {
    return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)
  }

  const userId = userData.user.id

  // 2. Verificar que es estudiante (su role en profiles)
  const { data: profile, error: profileError } = await userSb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profileError || profile?.role !== 'estudiante') {
    return errorResponse('NO_AUTORIZADO', 'Solo estudiantes', 403)
  }

  const admin = adminClient()

  // 3. Buscar el secreto existente
  const { data: existing } = await admin
    .from('student_qr_secrets')
    .select('secret')
    .eq('student_id', userId)
    .single()

  let secret = existing?.secret

  // 4. Si no existe, generar e insertar uno nuevo
  if (!secret) {
    secret = generateSecret()

    const { error: insertError } = await admin
      .from('student_qr_secrets')
      .insert({ student_id: userId, secret })

    if (insertError) {
      return errorResponse('ERROR_INTERNO', 'No se pudo guardar el secreto', 500)
    }
  }

  // 5. Devolver con el formato de OTPAUTH
  // El cliente usará esto para derivar el formato completo y guardarlo en IndexedDB
  return okResponse({
    secret,
    issuer: 'ZR Mecademy',
    label: userData.user.user_metadata?.cedula || userId,
    periodSeconds: 30,
  })
})
