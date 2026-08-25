import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * checkin-session · Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste post-Sprint F).
 *
 * El QR que muestra administración es UNIVERSAL — uno solo por día, no por
 * cohorte. El estudiante lo escanea con su propia cámara y llama a esta
 * función con su propio token; la función decide a qué sesión pertenece
 * según la cohorte del ESTUDIANTE, nunca según lo que venga del cliente.
 *
 * Todo lo que decide si la asistencia vale pasa aquí, en el servidor:
 *  - el código debe coincidir con el vigente de hoy
 *  - el estudiante debe tener una sesión de clase abierta hoy, en su cohorte
 * El cliente nunca valida nada — regla 2 de AGENTS.md.
 *
 * `validate-scan` (profesor→estudiante) sigue existiendo intacta, para
 * cuando la academia vuelva a ese flujo.
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

    // Formato del QR universal: ZRADM|<code>
    const match = typeof qrText === 'string' ? qrText.match(/^ZRADM\|(\S+)$/) : null
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Este código no es de administración')
    }
    const [, code] = match

    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const admin = adminClient()
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: vigente } = await admin
      .from('daily_checkin_codes')
      .select('code')
      .eq('checkin_date', hoy)
      .maybeSingle()
    if (!vigente || vigente.code !== code) {
      return errorResponse('QR_VENCIDO', 'Este código ya cambió — vuelve a escanear la pantalla')
    }

    const { data: student } = await admin.from('students').select('cohort_id').eq('id', authUser.id).single()
    if (!student) return errorResponse('NO_AUTORIZADO', 'Solo estudiantes marcan asistencia así', 403)
    if (!student.cohort_id) return errorResponse('SIN_COHORTE', 'Todavía no tienes cohorte asignada')

    const { data: session } = await admin
      .from('class_sessions')
      .select('id, status')
      .eq('cohort_id', student.cohort_id)
      .eq('session_date', hoy)
      .maybeSingle()
    if (!session) return errorResponse('SIN_CLASE_HOY', 'No tienes clase programada hoy')
    if (session.status !== 'abierta') return errorResponse('SESION_NO_ABIERTA', 'Tu clase todavía no está abierta')

    const { data: attendance, error: insertError } = await admin.from('attendance_events').insert({
      session_id: session.id,
      student_id: authUser.id,
      scanned_by: authUser.id,
      method: 'qr',
    }).select().single()

    // El código rota siempre que alguien lo use con éxito, sea nuevo o
    // duplicado — así nadie que lo vea de reojo puede reutilizarlo después.
    await admin
      .from('daily_checkin_codes')
      .update({ code: nuevoCodigo(), rotated_at: new Date().toISOString() })
      .eq('checkin_date', hoy)

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
