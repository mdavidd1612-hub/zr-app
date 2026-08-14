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

function okResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminSupabase = adminClient()
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)

    const { data: perfil } = await adminSupabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (!perfil || !['profesor', 'admin', 'super_admin', 'direccion_academica'].includes(perfil.role)) {
      return errorResponse('NO_AUTORIZADO', 'Solo el personal docente puede responder solicitudes', 403)
    }

    const { requestId, accion, responseNote } = await req.json()
    if (!requestId || !['aprobada', 'rechazada'].includes(accion)) {
      return errorResponse('DATOS_INVALIDOS', 'requestId y accion (aprobada|rechazada) son requeridos')
    }

    // Cargar la solicitud
    const { data: solicitud, error: solicitudErr } = await adminSupabase
      .from('exam_rehabilitation_requests')
      .select('id, attempt_id, student_id, exam_id, status')
      .eq('id', requestId)
      .single()

    if (solicitudErr || !solicitud) {
      return errorResponse('NO_ENCONTRADO', 'Solicitud no encontrada', 404)
    }
    if (solicitud.status !== 'pendiente') {
      return errorResponse('YA_RESPONDIDA', 'Esta solicitud ya fue respondida')
    }

    // Marcar solicitud como respondida
    await adminSupabase
      .from('exam_rehabilitation_requests')
      .update({
        status: accion,
        responded_by: user.id,
        responded_at: new Date().toISOString(),
        response_note: responseNote ?? null,
      })
      .eq('id', requestId)

    if (accion === 'aprobada') {
      // Borrar todas las respuestas del intento abandonado
      await adminSupabase
        .from('exam_answers')
        .delete()
        .eq('attempt_id', solicitud.attempt_id)

      // Resetear el intento a 'en_progreso' con nuevo started_at
      await adminSupabase
        .from('exam_attempts')
        .update({
          status: 'en_progreso',
          started_at: new Date().toISOString(),
          submitted_at: null,
          total_score: null,
          graded_at: null,
        })
        .eq('id', solicitud.attempt_id)
    }

    return okResponse({ ok: true, accion })
  } catch (err) {
    console.error('respond-rehabilitation error:', err)
    return errorResponse('ERROR_INTERNO', 'Error al procesar la solicitud')
  }
})
