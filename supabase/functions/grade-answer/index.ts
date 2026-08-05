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

    // Get the answer with exam info
    const { data: answer, error: answerErr } = await adminSupabase
      .from('exam_answers')
      .select('*, exam_questions(points), exam_attempts(exam_id, exams(id))')
      .eq('id', answerId)
      .single()

    if (answerErr || !answer) {
      return errorResponse('NO_AUTORIZADO', 'Respuesta no encontrada', 403)
    }

    // Verify teacher teaches this cohort
    const { data: exam, error: examErr } = await adminSupabase
      .from('exams')
      .select('cohort_id')
      .eq('id', answer.exam_attempts?.exam_id)
      .single()

    if (examErr || !exam) {
      return errorResponse('NO_AUTORIZADO', 'Examen no encontrado', 403)
    }

    const { data: teacherCohorts } = await adminSupabase
      .from('teacher_cohorts')
      .select('cohort_id')
      .eq('teacher_id', user.id)

    const teacherHasCohort = teacherCohorts?.some(tc => tc.cohort_id === exam.cohort_id)
    if (!teacherHasCohort) {
      return errorResponse('NO_AUTORIZADO', 'No enseñas en esta cohorte', 403)
    }

    // Validate points within question max
    const maxPoints = answer.exam_questions?.points || 0
    if (awardedPoints < 0 || awardedPoints > maxPoints) {
      return errorResponse('DATOS_INVALIDOS', `Puntos debe estar entre 0 y ${maxPoints}`)
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

    // Check if attempt is now closed (all answers graded)
    const { data: allAnswers } = await adminSupabase
      .from('exam_answers')
      .select('awarded_points')
      .eq('attempt_id', answer.exam_attempts?.id)

    const allGraded = allAnswers?.every(a => a.awarded_points !== null) || false

    // Calculate total score if all graded
    let totalScore = 0
    if (allGraded) {
      const { data: gradedAnswers } = await adminSupabase
        .from('exam_answers')
        .select('awarded_points')
        .eq('attempt_id', answer.exam_attempts?.id)

      totalScore = gradedAnswers?.reduce((sum, a) => sum + (a.awarded_points || 0), 0) || 0
    }

    return okResponse({
      ok: true,
      attemptClosed: allGraded,
      totalScore: allGraded ? totalScore : null,
    })
  } catch (error) {
    console.error('grade-answer error:', error)
    return errorResponse('ERROR_INTERNO', 'Error al procesar la calificación')
  }
})
