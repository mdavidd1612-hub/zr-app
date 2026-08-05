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
    const { sessionId, qrCode } = await req.json()

    // 1-10: Idénticos a validate-scan
    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const { data: profile } = await user.from('profiles').select('role').eq('id', authUser.id).single()
    if (!['profesor', 'admin', 'super_admin'].includes(profile?.role)) {
      return errorResponse('NO_AUTORIZADO', 'Solo profesores pueden entregar refrigerio', 403)
    }

    const qrRegex = /^ZR1\|([VEJ])-(\d+)\|(\d{6})$/
    const match = qrCode.match(qrRegex)
    if (!match) {
      return errorResponse('QR_INVALIDO', 'Formato de código QR no válido')
    }

    const [, typeCode, cedNum] = match
    const cedula = `${typeCode}-${cedNum}`

    const { data: student } = await user.from('profiles').select('id, full_name').eq('cedula', cedula).single()
    if (!student) {
      return errorResponse('QR_INVALIDO', 'Estudiante no encontrado')
    }

    const { data: session } = await user.from('class_sessions').select('status, cohort_id').eq('id', sessionId).single()
    if (!session) {
      return errorResponse('SESION_NO_ENCONTRADA', 'Sesión no existe')
    }
    if (session.status !== 'abierta') {
      return errorResponse('SESION_NO_ABIERTA', 'La sesión no está abierta')
    }

    const { data: cohort } = await user.from('cohorts').select('teacher_id').eq('id', session.cohort_id).single()
    if (cohort?.teacher_id !== authUser.id && profile?.role === 'profesor') {
      return errorResponse('NO_AUTORIZADO', 'No eres profesor de esta cohorte', 403)
    }

    const { data: studentEnroll } = await user.from('students').select('cohort_id').eq('id', student.id).single()
    if (studentEnroll?.cohort_id !== session.cohort_id) {
      return errorResponse('ESTUDIANTE_OTRA_COHORTE', 'El estudiante no pertenece a esta cohorte')
    }

    // 11. Verificar que tiene asistencia
    const admin = adminClient()
    const { data: attendance } = await admin
      .from('attendance_events')
      .select('snack_claimed_at')
      .eq('session_id', sessionId)
      .eq('student_id', student.id)
      .single()

    if (!attendance) {
      return errorResponse('NO_AUTORIZADO', 'El estudiante no tiene asistencia registrada hoy')
    }

    // 12. Verificar que no ya se entregó
    if (attendance.snack_claimed_at) {
      return errorResponse('REFRIGERIO_YA_ENTREGADO', 'El refrigerio ya fue entregado')
    }

    // 13. Actualizar
    const { error: updateError } = await admin
      .from('attendance_events')
      .update({
        snack_claimed_at: new Date().toISOString(),
        snack_claimed_by: authUser.id,
      })
      .eq('session_id', sessionId)
      .eq('student_id', student.id)

    if (updateError) throw updateError

    return okResponse({
      ok: true,
      student: { fullName: student.full_name },
    })
  } catch (error) {
    console.error('claim-snack error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
