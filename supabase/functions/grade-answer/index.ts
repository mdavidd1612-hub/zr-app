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

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const userSupabase = userClient(req)
    const adminSupabase = adminClient()

    // Get current user
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return errorResponse('NO_AUTORIZADO', 'Usuario no autenticado', 401)
    }

    // Parse request body
    const { answerId, awardedPoints, feedback } = await req.json()
    if (!answerId || awardedPoints === undefined) {
      return errorResponse('DATOS_INVALIDOS', 'answerId y awardedPoints requeridos')
    }

    // Solo personal. Un estudiante con el token en la mano no califica nada.
    const { data: perfil } = await adminSupabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (!perfil || !['profesor', 'admin', 'super_admin'].includes(perfil.role)) {
      return errorResponse('NO_AUTORIZADO', 'Solo el personal docente califica', 403)
    }

    const { data: respuesta, error: answerErr } = await adminSupabase
      .from('exam_answers')
      .select('id, attempt_id, exam_questions(points), exam_attempts(id, exam_id)')
      .eq('id', answerId)
      .single()

    if (answerErr || !respuesta) {
      return errorResponse('NO_AUTORIZADO', 'Respuesta no encontrada', 403)
    }

    const answer = respuesta as unknown as {
      id: string
      attempt_id: string
      exam_questions: { points: number } | null
      exam_attempts: { id: string; exam_id: string } | null
    }

    const { data: exam, error: examErr } = await adminSupabase
      .from('exams')
      .select('cohort_id, teacher_id')
      .eq('id', answer.exam_attempts?.exam_id)
      .single()

    if (examErr || !exam) {
      return errorResponse('NO_AUTORIZADO', 'Examen no encontrado', 403)
    }

    // No existe una tabla teacher_cohorts: el vínculo docente-cohorte vive en
    // cohorts.teacher_id y en class_sessions.teacher_id. La función
    // teaches_cohort() de la migración 011 ya resuelve las dos, y es la misma
    // que usan las políticas de RLS — así la Edge Function y la base no pueden
    // discrepar sobre quién enseña dónde.
    let autorizado = exam.teacher_id === user.id || perfil.role !== 'profesor'

    if (!autorizado && exam.cohort_id) {
      const { data: ensena } = await userSupabase.rpc('teaches_cohort', {
        p_cohort: exam.cohort_id,
      })
      autorizado = ensena === true
    }

    if (!autorizado) {
      return errorResponse('NO_AUTORIZADO', 'No das clase en esta cohorte', 403)
    }

    // El puntaje no puede pasarse del máximo de la pregunta.
    const maxPoints = Number(answer.exam_questions?.points ?? 0)
    if (typeof awardedPoints !== 'number' || awardedPoints < 0 || awardedPoints > maxPoints) {
      return errorResponse('DATOS_INVALIDOS', `El puntaje debe estar entre 0 y ${maxPoints}`)
    }

    // Update the answer
    const { error: updateErr } = await adminSupabase
      .from('exam_answers')
      .update({
        awarded_points: awardedPoints,
        graded_by: user.id,
        graded_at: new Date().toISOString(),
        teacher_feedback: feedback,
      })
      .eq('id', answerId)

    if (updateErr) {
      console.error('Error grading answer:', updateErr)
      return errorResponse('ERROR_INTERNO', 'No se pudo calificar la respuesta')
    }

    // Quien cierra el intento es el disparador trg_close_attempt, no esta
    // función. Aquí solo se lee cómo quedó, para poder decírselo al profesor.
    const { data: intento } = await adminSupabase
      .from('exam_attempts')
      .select('status, total_score')
      .eq('id', answer.attempt_id)
      .single()

    return okResponse({
      ok: true,
      attemptClosed: intento?.status === 'calificado',
      totalScore: intento?.total_score ?? null,
    })
  } catch (error) {
    console.error('grade-answer error:', error)
    return errorResponse('ERROR_INTERNO', 'Error al procesar la calificación')
  }
})
