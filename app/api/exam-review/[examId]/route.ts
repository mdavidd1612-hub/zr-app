import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { examId: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

  const { examId } = params

  // Verify the attempt belongs to this student and is graded
  const { data: intento } = await supabase
    .from('exam_attempts')
    .select('id, total_score, graded_at')
    .eq('exam_id', examId)
    .eq('student_id', user.id)
    .eq('status', 'calificado')
    .maybeSingle()

  if (!intento) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const admin = adminClient()

  // Fetch questions WITH correct_answer — safe because student already submitted
  const { data: preguntas } = await admin
    .from('exam_questions')
    .select('id, order_index, type, statement, options, correct_answer, points, rubric')
    .eq('exam_id', examId)
    .order('order_index')

  // Fetch student answers for this attempt
  const { data: respuestas } = await admin
    .from('exam_answers')
    .select('question_id, answer, awarded_points, auto_graded, teacher_feedback')
    .eq('attempt_id', intento.id)

  const respuestasPorPregunta = Object.fromEntries(
    (respuestas ?? []).map((r) => [r.question_id, r]),
  )

  return NextResponse.json({
    totalScore: intento.total_score,
    gradedAt: intento.graded_at,
    preguntas: (preguntas ?? []).map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      type: q.type,
      statement: q.statement,
      options: q.options,
      correctAnswer: q.correct_answer,
      points: q.points,
      rubric: q.rubric,
      respuesta: respuestasPorPregunta[q.id] ?? null,
    })),
  })
}
