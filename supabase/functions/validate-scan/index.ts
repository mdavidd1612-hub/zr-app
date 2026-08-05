import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as OTPAuth from 'https://esm.sh/otpauth@9.2.2'

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId, qrCode, scannedAt, deviceId } = await req.json()

    // 1. Validar token
    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    // 2. Verificar que es profesor/admin/super_admin
    const { data: profile } = await user.from('profiles').select('role').eq('id', authUser.id).single()
    if (!['profesor', 'admin', 'super_admin'].includes(profile?.role)) {
      return errorResponse('NO_AUTORIZADO', 'Solo profesores pueden registrar asistencia', 403)
    }

    // 3. Validar formato QR
    const qrRegex = /^ZR1\|([VEJ])-(\d+)\|(\d{6})$/
    const match = qrCode.match(qrRegex)
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Formato de código QR no válido')
    }

    const [, typeCode, cedNum, totp] = match
    const cedula = `${typeCode}-${cedNum}`

    // 4. Buscar estudiante
    const { data: student } = await user.from('profiles').select('id, full_name, cedula').eq('cedula', cedula).single()
    if (!student) {
      return errorResponse('QR_INVALIDO', 'Estudiante no encontrado')
    }

    // 5. Obtener secreto
    const admin = adminClient()
    const { data: secret } = await admin.from('student_qr_secrets').select('secret').eq('student_id', student.id).single()
    if (!secret) {
      return errorResponse('QR_INVALIDO', 'No hay secreto configurado')
    }

    // 6. Leer configuración
    const { data: config } = await admin.from('system_config').select('value').eq('key', 'attendance.qr_window_seconds').single()
    const { data: drift } = await admin.from('system_config').select('value').eq('key', 'attendance.qr_drift_tolerance').single()
    const window = parseInt(config?.value || '30')
    const tolerance = parseInt(drift?.value || '1')

    // 7. Validar TOTP
    const t = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret.secret),
      digits: 6,
      period: 30,
    })

    let valid = false
    for (let i = -tolerance; i <= tolerance; i++) {
      const checkTime = new Date(scannedAt).getTime() + i * 30 * 1000
      if (t.validate({ time: checkTime })) {
        valid = true
        break
      }
    }
    if (!valid) {
      return errorResponse('QR_VENCIDO', 'Código QR expirado')
    }

    // 8. Leer sesión
    const { data: session } = await user.from('class_sessions').select('status, cohort_id').eq('id', sessionId).single()
    if (!session) {
      return errorResponse('SESION_NO_ENCONTRADA', 'Sesión no existe')
    }
    if (session.status !== 'abierta') {
      return errorResponse('SESION_NO_ABIERTA', 'La sesión no está abierta')
    }

    // 9. Verificar que profesor da clase en esa cohorte
    const { data: cohort } = await user.from('cohorts').select('teacher_id').eq('id', session.cohort_id).single()
    if (cohort?.teacher_id !== authUser.id && profile?.role === 'profesor') {
      return errorResponse('NO_AUTORIZADO', 'No eres profesor de esta cohorte', 403)
    }

    // 10. Verificar que estudiante está en la cohorte
    const { data: studentEnroll } = await user.from('students').select('cohort_id').eq('id', student.id).single()
    if (studentEnroll?.cohort_id !== session.cohort_id) {
      return errorResponse('ESTUDIANTE_OTRA_COHORTE', 'El estudiante no pertenece a esta cohorte')
    }

    // 11. Insertar asistencia
    const { data: attendance, error: insertError } = await admin.from('attendance_events').insert({
      session_id: sessionId,
      student_id: student.id,
      scanned_at: new Date(scannedAt).toISOString(),
      synced_at: new Date().toISOString(),
      scanned_by: authUser.id,
      method: 'qr',
    }).select().single()

    // 12. Si duplicado, no es error
    if (insertError) {
      if (insertError.code === '23505') {
        return okResponse({
          ok: true,
          student: { id: student.id, fullName: student.full_name, cedula: student.cedula },
          duplicate: true,
        })
      }
      throw insertError
    }

    return okResponse({
      ok: true,
      student: { id: student.id, fullName: student.full_name, cedula: student.cedula },
      attendanceId: attendance.id,
      duplicate: false,
    })
  } catch (error) {
    console.error('validate-scan error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
