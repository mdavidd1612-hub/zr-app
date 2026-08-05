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

    // Get current user
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return errorResponse('NO_AUTORIZADO', 'Usuario no autenticado', 401)
    }

    // Parse request body
    const { attemptId } = await req.json()
    if (!attemptId) {
      return errorResponse('DATOS_INVALIDOS', 'attemptId requerido')
    }

    // Get attempt with auth check
    const { data: attempt, error: attemptErr } = await userSupabase
      .from('exam_attempts')
      .select('*, exams(*, exam_questions(*))')
      .eq('id', attemptId)
      .eq('student_id', user.id)
      .single()

    if (attemptErr || !attempt) {
      return errorResponse('NO_AUTORIZADO', 'El intento no pertenece a este estudiante', 403)
    }

    if (attempt.status !== 'en_progreso') {
      return errorResponse('INTENTO_YA_ENTREGADO', 'El intento ya fue entregado')
    }

    // Get all exam questions with correct answers (admin access)
    const adminSupabase = adminClient()
    const { data: questionsWithAnswers, error: questionsErr } = await adminSupabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', attempt.exam_id)

    if (questionsErr || !questionsWithAnswers) {
      console.error('Error fetching questions:', questionsErr)
      return errorResponse('ERROR_INTERNO', 'No se pudieron cargar las preguntas')
    }

    // Get student answers
    const { data: studentAnswers, error: answersErr } = await userSupabase
      .from('exam_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    if (answersErr) {
      console.error('Error fetching answers:', answersErr)
      return errorResponse('ERROR_INTERNO', 'No se pudieron cargar las respuestas')
    }

    // Grade each answer
    let autoGradedPoints = 0
    let pendingManualQuestions = 0

    for (const question of questionsWithAnswers) {
      const studentAnswer = studentAnswers?.find(a => a.question_id === question.id)

      // Parse JSON fields
      const correctAnswer = typeof question.correct_answer === 'string'
        ? JSON.parse(question.correct_answer)
        : question.correct_answer
      const answerData = studentAnswer?.answer
        ? (typeof studentAnswer.answer === 'string' ? JSON.parse(studentAnswer.answer) : studentAnswer.answer)
        : null

      let awardedPoints = 0
      let autoGraded = false

      if (question.question_type === 'opcion_multiple') {
        autoGraded = true
        if (answerData?.key === correctAnswer?.key) {
          awardedPoints = question.points
        }
      } else if (question.question_type === 'verdadero_falso') {
        autoGraded = true
        if (answerData?.value === correctAnswer?.value) {
          awardedPoints = question.points
        }
      } else if (question.question_type === 'redaccion_abierta') {
        pendingManualQuestions++
        awardedPoints = null
      }

      // Update answer record
      if (studentAnswer) {
        await adminSupabase
          .from('exam_answers')
          .update({
            awarded_points: awardedPoints,
            auto_graded: autoGraded,
          })
          .eq('id', studentAnswer.id)
      }

      if (autoGraded && awardedPoints !== null) {
        autoGradedPoints += awardedPoints
      }
    }

    // Update attempt status to entregado
    const { error: updateErr } = await adminSupabase
      .from('exam_attempts')
      .update({
        status: 'entregado',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', attemptId)

    if (updateErr) {
      console.error('Error updating attempt:', updateErr)
      return errorResponse('ERROR_INTERNO', 'No se pudo actualizar el intento')
    }

    return okResponse({
      ok: true,
      autoGradedPoints,
      pendingManualQuestions,
      status: 'entregado',
    })
  } catch (error) {
    console.error('submit-attempt error:', error)
    return errorResponse('ERROR_INTERNO', 'Error al procesar la entrega')
  }
})
