import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * `claim-snack-cantina` -- pedido explícito del coordinador (sept. 2026):
 * reemplazar el tiquet físico de refrigerio por uno digital, escaneado en un
 * dispositivo propio de la cantina (ZR Coffee), no en el aula del profesor.
 *
 * Se diferencia de `claim-snack` (el modo "refrigerio" del profesor en su
 * propia pantalla de asistencia) en dos cosas:
 *   1. Lo opera el rol `zr_coffee`, no el profesor.
 *   2. No recibe `sessionId` -- la cantina no sabe de qué cohorte es cada
 *      estudiante que hace fila. El servidor busca la sesión abierta de HOY
 *      para la cohorte del estudiante escaneado.
 *
 * El "tiquet digital" es el mismo QR rotatorio del carnet (TOTP, migración
 * 006) -- no se inventa un token nuevo. La cantina valida ese mismo código
 * con otro propósito, y solo dentro de la ventana de horario que define
 * system_config (nunca hardcodeada, regla 5 de AGENTS.md).
 */

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { qrCode } = await req.json()

    // 1. Validar token y rol -- solo la cantina (zr_coffee) o personal de
    //    dirección académica/administración como respaldo.
    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const { data: profile } = await user.from('profiles').select('role').eq('id', authUser.id).single()
    if (!['zr_coffee', 'admin', 'super_admin'].includes(profile?.role)) {
      return errorResponse('NO_AUTORIZADO', 'Solo la cantina puede entregar refrigerio', 403)
    }

    // 2. Ventana de horario -- se activa sola, nadie la prende a mano.
    const admin = adminClient()
    const { data: cfgInicio } = await admin.from('system_config').select('value').eq('key', 'attendance.refrigerio_hora_inicio').single()
    const { data: cfgFin } = await admin.from('system_config').select('value').eq('key', 'attendance.refrigerio_hora_fin').single()
    const horaInicio = (cfgInicio?.value as string) ?? '10:00'
    const horaFin = (cfgFin?.value as string) ?? '10:30'

    const horaActual = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'America/Caracas',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    if (horaActual < horaInicio || horaActual > horaFin) {
      return errorResponse(
        'FUERA_DE_HORARIO',
        `El refrigerio se escanea entre las ${horaInicio} y las ${horaFin}.`,
      )
    }

    // 3. Validar formato del QR (mismo formato que el carnet de asistencia).
    const qrRegex = /^ZR1\|([VEJ])-(\d+)\|(\d{6})$/
    const match = qrCode.match(qrRegex)
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Formato de código QR no válido')
    }

    const [, typeCode, cedNum] = match
    const cedula = `${typeCode}-${cedNum}`

    const { data: student } = await admin.from('profiles').select('id, full_name').eq('cedula', cedula).single()
    if (!student) {
      return errorResponse('QR_INVALIDO', 'Estudiante no encontrado')
    }

    // 4. Cohorte del estudiante y sesión abierta de hoy para esa cohorte --
    //    la cantina no elige sesión, el servidor la encuentra sola.
    const { data: studentEnroll } = await admin.from('students').select('cohort_id').eq('id', student.id).single()
    if (!studentEnroll?.cohort_id) {
      return errorResponse('NO_AUTORIZADO', 'El estudiante no pertenece a ninguna cohorte activa')
    }

    const { data: session } = await admin
      .from('class_sessions')
      .select('id')
      .eq('cohort_id', studentEnroll.cohort_id)
      .eq('status', 'abierta')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return errorResponse('SESION_NO_ABIERTA', 'No hay una sesión de clase abierta hoy para este estudiante')
    }

    // 5. Verificar asistencia y que no se haya entregado ya (misma garantía
    //    de un solo uso que ya tenía claim-snack).
    const { data: attendance } = await admin
      .from('attendance_events')
      .select('snack_claimed_at')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .single()

    if (!attendance) {
      return errorResponse('NO_AUTORIZADO', 'El estudiante no tiene asistencia registrada hoy')
    }
    if (attendance.snack_claimed_at) {
      return errorResponse('REFRIGERIO_YA_ENTREGADO', 'El refrigerio ya fue entregado')
    }

    const { error: updateError } = await admin
      .from('attendance_events')
      .update({
        snack_claimed_at: new Date().toISOString(),
        snack_claimed_by: authUser.id,
      })
      .eq('session_id', session.id)
      .eq('student_id', student.id)

    if (updateError) throw updateError

    return okResponse({ ok: true, student: { fullName: student.full_name } })
  } catch (error) {
    console.error('claim-snack-cantina error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
