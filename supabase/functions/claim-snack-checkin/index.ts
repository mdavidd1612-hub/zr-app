import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * claim-snack-checkin -- corrección explícita del coordinador (sept. 2026)
 * sobre `claim-snack-cantina` (migración 104): el flujo estaba al revés. Es
 * la cantina (ZR Coffee) la que MUESTRA el QR, y el ESTUDIANTE lo escanea
 * con su propia cámara -- mismo patrón que `checkin-session` (asistencia).
 *
 * `claim-snack-cantina` queda sin usar (nadie la llama), no se borra por si
 * el patrón anterior hiciera falta de nuevo.
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

    // Formato del QR de la cantina: ZRSNACK|<code>
    const match = typeof qrText === 'string' ? qrText.match(/^ZRSNACK\|(\S+)$/) : null
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Este código no es de la cantina')
    }
    const [, code] = match

    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const admin = adminClient()
    const hoy = new Date().toISOString().slice(0, 10)

    // Ventana de horario -- se activa sola.
    const { data: cfgInicio } = await admin.from('system_config').select('value').eq('key', 'attendance.refrigerio_hora_inicio').single()
    const { data: cfgFin } = await admin.from('system_config').select('value').eq('key', 'attendance.refrigerio_hora_fin').single()
    const horaInicio = (cfgInicio?.value as string) ?? '11:00'
    const horaFin = (cfgFin?.value as string) ?? '11:30'
    const horaActual = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false,
    })
    if (horaActual < horaInicio || horaActual > horaFin) {
      return errorResponse('FUERA_DE_HORARIO', `El refrigerio se escanea entre las ${horaInicio} y las ${horaFin}.`)
    }

    const { data: vigente } = await admin
      .from('daily_snack_codes').select('code').eq('checkin_date', hoy).maybeSingle()
    if (!vigente || vigente.code !== code) {
      return errorResponse('QR_VENCIDO', 'Este código ya cambió — vuelve a escanear la pantalla')
    }

    const { data: student } = await admin.from('students').select('cohort_id').eq('id', authUser.id).single()
    if (!student) return errorResponse('NO_AUTORIZADO', 'Solo estudiantes reclaman refrigerio así', 403)
    if (!student.cohort_id) return errorResponse('SIN_COHORTE', 'Todavía no tienes cohorte asignada')

    const { data: session } = await admin
      .from('class_sessions')
      .select('id')
      .eq('cohort_id', student.cohort_id)
      .eq('session_date', hoy)
      .maybeSingle()
    if (!session) return errorResponse('SIN_CLASE_HOY', 'No tienes clase programada hoy')

    const { data: attendance } = await admin
      .from('attendance_events')
      .select('snack_claimed_at')
      .eq('session_id', session.id)
      .eq('student_id', authUser.id)
      .maybeSingle()
    if (!attendance) return errorResponse('NO_AUTORIZADO', 'Todavía no tienes asistencia registrada hoy')
    if (attendance.snack_claimed_at) return errorResponse('REFRIGERIO_YA_ENTREGADO', 'Ya reclamaste tu refrigerio hoy')

    const { error: updateError } = await admin
      .from('attendance_events')
      .update({ snack_claimed_at: new Date().toISOString(), snack_claimed_by: authUser.id })
      .eq('session_id', session.id)
      .eq('student_id', authUser.id)
    if (updateError) throw updateError

    // El código rota siempre que alguien lo use con éxito -- fotografiarlo
    // no sirve para nadie más después.
    await admin
      .from('daily_snack_codes')
      .update({ code: nuevoCodigo(), rotated_at: new Date().toISOString() })
      .eq('checkin_date', hoy)

    return okResponse({ ok: true })
  } catch (error) {
    console.error('claim-snack-checkin error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
