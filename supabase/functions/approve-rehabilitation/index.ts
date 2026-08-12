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

  const { data: profile } = await userSb
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  if (!profile || (profile.role !== 'profesor' && profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return errorResponse('NO_AUTORIZADO', 'Solo personal', 403)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Body JSON inválido', 400)
  }

  const { requestId, approved, responseNote } = payload
  if (!requestId || approved === undefined) {
    return errorResponse('MISSING_FIELDS', 'Faltan requestId o approved', 400)
  }

  const admin = adminClient()

  // Obtener la solicitud
  const { data: rehabReq, error: reqErr } = await admin
    .from('exam_rehabilitation_requests')
    .select('*, attempt_id, exam_id, student_id')
    .eq('id', requestId)
    .single()

  if (reqErr || !rehabReq) {
    return errorResponse('REQUEST_NOT_FOUND', 'Solicitud no encontrada', 404)
  }

  // Actualizar la solicitud
  const { error: updateReqErr } = await admin
    .from('exam_rehabilitation_requests')
    .update({
      status: approved ? 'aprobada' : 'rechazada',
      responded_by: userData.user.id,
      responded_at: new Date().toISOString(),
      response_note: responseNote || null,
    })
    .eq('id', requestId)

  if (updateReqErr) {
    return errorResponse('DB_ERROR', 'No se pudo actualizar la solicitud', 500)
  }

  // Si se aprueba, rehabilitar el intento: volver a 'en_progreso' y limpiar submitted_at
  if (approved) {
    const { error: rehabErr } = await admin
      .from('exam_attempts')
      .update({
        status: 'en_progreso',
        submitted_at: null,
        total_score: null,
        graded_at: null,
      })
      .eq('id', rehabReq.attempt_id)

    if (rehabErr) {
      return errorResponse('DB_ERROR', 'No se pudo rehabilitar el examen', 500)
    }

    // Eliminar las respuestas previas para que el estudiante pueda volver a responder
    // (o dejarlas si se quiere conservar; según el usuario, se rehabilita para volver a intentar)
    // Según la regla: si el profesor acepta, el examen vuelve a estar disponible.
    // Dejaremos las respuestas existentes pero permitimos un nuevo intento si es necesario.
    // Según la especificación, el intento vuelve a 'en_progreso'.
  }

  return okResponse({
    ok: true,
    approved,
    message: approved
      ? 'Examen rehabilitado. El estudiante puede presentarlo de nuevo.'
      : 'Solicitud rechazada.',
  })
})
