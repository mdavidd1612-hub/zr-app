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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)
  }

  const userSb = userClient(req)
  const { data: userData, error: userError } = await userSb.auth.getUser()
  if (userError || !userData.user) {
    return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Body JSON inválido', 400)
  }

  const { attemptId, reason } = payload
  if (!attemptId || !reason) {
    return errorResponse('MISSING_FIELDS', 'Faltan attemptId o reason', 400)
  }

  const admin = adminClient()

  // Verificar que el intento pertenece al estudiante
  const { data: attempt, error: aErr } = await admin
    .from('exam_attempts')
    .select('id, exam_id, student_id, status')
    .eq('id', attemptId)
    .single()

  if (aErr || !attempt) {
    return errorResponse('ATTEMPT_NOT_FOUND', 'Intento no encontrado', 404)
  }
  if (attempt.student_id !== userData.user.id) {
    return errorResponse('NO_AUTORIZADO', 'Este intento no es tuyo', 403)
  }

  // Verificar que no haya una solicitud pendiente ya
  const { data: existingReq } = await admin
    .from('exam_rehabilitation_requests')
    .select('id')
    .eq('attempt_id', attemptId)
    .eq('status', 'pendiente')
    .maybeSingle()

  if (existingReq) {
    return errorResponse('PENDING_REQUEST', 'Ya tienes una solicitud pendiente', 400)
  }

  // Crear la solicitud
  const { data: reqData, error: reqErr } = await admin
    .from('exam_rehabilitation_requests')
    .insert({
      attempt_id: attemptId,
      student_id: userData.user.id,
      exam_id: attempt.exam_id,
      reason: reason,
      status: 'pendiente',
    })
    .select()
    .single()

  if (reqErr) {
    return errorResponse('DB_ERROR', 'No se pudo crear la solicitud', 500)
  }

  return okResponse({
    ok: true,
    requestId: reqData.id,
    status: 'pendiente',
    message: 'Solicitud enviada. Tu profesor la revisará.',
  })
})
