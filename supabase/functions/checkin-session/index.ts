import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * checkin-session · Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint F).
 *
 * Nueva regla de asistencia: administración muestra un código en pantalla,
 * el ESTUDIANTE lo escanea con su propia cámara y llama a esta función con
 * su propio token. Al revés de `validate-scan` (que sigue existiendo,
 * intacta, para cuando la academia vuelva al flujo profesor→estudiante).
 *
 * Todo lo que decide si la asistencia vale pasa aquí, en el servidor:
 *  - la sesión debe existir y estar abierta
 *  - el código debe coincidir con el vigente para esa sesión
 *  - el estudiante debe pertenecer a la cohorte de la sesión
 * El cliente nunca valida nada — regla 2 de AGENTS.md.
 */

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
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  )
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { qrText } = await req.json()

    // Formato del QR: ZRADM|<sessionId>|<code>
    const match = typeof qrText === 'string' ? qrText.match(/^ZRADM\|([0-9a-f-]{36})\|(\S+)$/) : null
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Este código no es de administración')
    }
    const [, sessionId, code] = match

    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const admin = adminClient()

    const { data: session } = await admin
      .from('class_sessions')
      .select('id, status, cohort_id')
      .eq('id', sessionId)
      .single()
    if (!session) return errorResponse('SESION_NO_ENCONTRADA', 'La sesión no existe')
    if (session.status !== 'abierta') return errorResponse('SESION_NO_ABIERTA', 'La sesión no está abierta')

    const { data: student } = await admin.from('students').select('cohort_id').eq('id', authUser.id).single()
    if (!student) return errorResponse('NO_AUTORIZADO', 'Solo estudiantes marcan asistencia así', 403)
    if (student.cohort_id !== session.cohort_id) {
      return errorResponse('OTRA_COHORTE', 'Este código no es de tu cohorte')
    }

    const { data: vigente } = await admin
      .from('session_checkin_codes')
      .select('code')
      .eq('session_id', sessionId)
      .single()
    if (!vigente || vigente.code !== code) {
      return errorResponse('QR_VENCIDO', 'Este código ya cambió — vuelve a escanear la pantalla')
    }

    const { data: attendance, error: insertError } = await admin.from('attendance_events').insert({
      session_id: sessionId,
      student_id: authUser.id,
      scanned_by: authUser.id,
      method: 'qr',
    }).select().single()

    // El código rota siempre que alguien lo use con éxito, sea nuevo o
    // duplicado — así nadie que lo vea de reojo puede reutilizarlo después.
    await admin
      .from('session_checkin_codes')
      .update({ code: nuevoCodigo(), rotated_at: new Date().toISOString() })
      .eq('session_id', sessionId)

    if (insertError) {
      if (insertError.code === '23505') {
        return okResponse({ ok: true, duplicate: true })
      }
      throw insertError
    }

    return okResponse({ ok: true, duplicate: false, attendanceId: attendance.id })
  } catch (error) {
    console.error('checkin-session error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
