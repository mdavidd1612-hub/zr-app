'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Question {
  id: string
  type: 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'
  enunciado: string
  options?: Array<{ key: string; text: string }>
  points: number
}

/**
 * Las tres formas que puede tomar una respuesta. Son las de
 * spec/02_CONTRATOS.md §1 y las que espera la Edge Function submit-attempt
 * al comparar contra correct_answer: si aquí se guardara otra forma, la
 * autocalificación daría cero a todo el mundo sin avisar.
 */
type RespuestaValor =
  | { key: string }      // opción múltiple
  | { value: boolean }   // verdadero / falso
  | { text: string }     // redacción abierta

interface Answer {
  questionId: string
  value: RespuestaValor
}

// Lectores que estrechan la unión. Evitan tener que repetir el `in` en cada
// sitio del JSX y dejan claro qué forma espera cada tipo de pregunta.
const opcionElegida = (v?: RespuestaValor) => (v && 'key' in v ? v.key : null)
const valorElegido  = (v?: RespuestaValor) => (v && 'value' in v ? v.value : null)
const textoEscrito  = (v?: RespuestaValor) => (v && 'text' in v ? v.text : '')

interface Examen {
  title: string
  duration_minutes: number | null
}

export default function ExamenPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string
  const supabase = createClient()

  const [exam, setExam] = useState<Examen | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptId, setAttemptId] = useState<string>('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmandoSalir, setConfirmandoSalir] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    async function initExam() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Load exam data
      const { data: examData } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()

      if (!examData) {
        router.push('/examenes')
        return
      }

      setExam(examData)

      // Las preguntas SIEMPRE salen de v_exam_questions_student. Esa vista no
      // tiene correct_answer ni rubric: si se consultara exam_questions, la
      // respuesta correcta viajaría al navegador y se vería en la pestaña Red.
      const { data: questionsData } = await supabase
        .from('v_exam_questions_student')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true })

      if (questionsData) {
        setQuestions(
          questionsData.map((q) => ({
            id: q.id!,
            type: q.type as Question['type'],
            enunciado: q.statement!,
            points: Number(q.points),
            // options es jsonb: llega ya como objeto, no como texto.
            options: (q.options as Question['options']) ?? undefined,
          })),
        )
      }

      // Get or create attempt
      let { data: attempt } = await supabase
        .from('exam_attempts')
        .select('id, status, started_at')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (!attempt) {
        const { data: newAttempt } = await supabase
          .from('exam_attempts')
          .insert({
            exam_id: examId,
            student_id: user.id,
            status: 'en_progreso',
            started_at: new Date().toISOString(),
          })
          .select()
          .single()

        attempt = newAttempt
      }

      if (attempt) {
        setAttemptId(attempt.id)

        // Load existing answers
        const { data: existingAnswers } = await supabase
          .from('exam_answers')
          .select('question_id, answer')
          .eq('attempt_id', attempt.id)

        if (existingAnswers) {
          setAnswers(
            existingAnswers
              .filter((a) => a.answer !== null)
              .map((a) => ({
                questionId: a.question_id,
                value: a.answer as RespuestaValor,
              })),
          )
        }
      }

      // El tiempo restante se calcula contra started_at, NUNCA se reinicia a
      // la duración completa. Antes se ponía siempre `duration_minutes * 60`
      // sin importar cuánto tiempo ya había pasado: salir del examen y
      // volver a entrar (por ejemplo desde el enlace de una notificación)
      // le regalaba al estudiante un cronómetro nuevo cada vez.
      if (examData.duration_minutes && attempt?.started_at) {
        const finLimite = new Date(attempt.started_at).getTime() + examData.duration_minutes * 60_000
        const restante = Math.max(0, Math.round((finLimite - Date.now()) / 1000))
        setTimeLeft(restante)
      }

      setLoading(false)
    }

    initExam()
  }, [examId])

  // Timer effect
  useEffect(() => {
    if (!timeLeft) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLeft])

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers.find((a) => a.questionId === currentQuestion?.id)

  function handleAnswerChange(value: RespuestaValor) {
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, value },
    ])

    // Se guarda al vuelo, no al cambiar de pregunta: si el teléfono se apaga
    // o el estudiante cierra la pestaña, lo respondido ya está en la base.
    saveAnswer(currentQuestion.id, value)
  }

  async function saveAnswer(questionId: string, value: RespuestaValor) {
    if (!attemptId) return

    // Un upsert, no un select + insert/update. La tabla tiene la restricción
    // única (attempt_id, question_id), así que la base resuelve el conflicto:
    // dos toques rápidos en la misma opción no crean dos filas ni pierden la
    // segunda respuesta por carrera entre el select y el insert.
    //
    // Y se ESPERA el resultado. Un `void supabase.from(...)` no envía nada:
    // el constructor de consultas de supabase-js solo dispara la petición
    // cuando alguien llama a .then(). Así se perdían todas las respuestas.
    const { error } = await supabase
      .from('exam_answers')
      .upsert(
        { attempt_id: attemptId, question_id: questionId, answer: value },
        { onConflict: 'attempt_id,question_id' },
      )

    if (error) {
      console.error('No se pudo guardar la respuesta:', error.message)
      setSubmitError('No se pudo guardar tu última respuesta. Revisa tu conexión.')
      return
    }

    setSubmitError(null)
  }

  async function handleSubmit() {
    if (!attemptId || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    // La calificación NUNCA se calcula aquí. La Edge Function es la única que
    // ve correct_answer, y el disparador trg_close_attempt es el que cierra el
    // intento cuando ya no quedan respuestas sin puntaje.
    const { data, error } = await supabase.functions.invoke('submit-attempt', {
      body: { attemptId },
    })

    if (error) {
      // El mensaje genérico ("revisa tu conexión") culpaba a la red incluso
      // cuando el problema era otro — un examen ya entregado, un permiso,
      // un fallo real del servidor. El cuerpo del error viaja en
      // error.context (FunctionsHttpError) con el {code, message} real que
      // manda la Edge Function; se muestra ese en vez de inventar uno.
      let mensaje = 'No se pudo entregar. Inténtalo otra vez.'
      const contexto = (error as { context?: Response }).context
      if (contexto) {
        try {
          const cuerpo = await contexto.json()
          if (cuerpo?.error?.message) mensaje = cuerpo.error.message
        } catch {
          // sin cuerpo legible: se queda el mensaje genérico
        }
      }

      // Se cierra el modal de confirmación: si se queda abierto, el aviso
      // de error (que vive en la barra de abajo) queda tapado detrás y
      // parece que el botón "no hizo nada" hasta que el estudiante sale.
      setConfirmando(false)
      setSubmitError(mensaje)
      setSubmitting(false)
      return
    }

    if (data?.status === 'entregado' || data?.status === 'calificado') {
      router.push('/examenes')
      return
    }

    setConfirmando(false)
    setSubmitting(false)
  }

  if (loading || !currentQuestion) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando examen...</div>
      </div>
    )
  }

  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const progress = Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
  const sinResponder = questions.filter(
    (q) => !answers.some((a) => a.questionId === q.id),
  ).length

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      {/* Salir a medias es seguro: cada respuesta ya se guardó al tocarla. Se
          pide confirmación solo para que no se salga por un toque accidental. */}
      {confirmandoSalir && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-5 sm:items-center">
          <div className="zr-card w-full max-w-sm animate-rise p-6">
            <p className="zr-display text-xl text-zr-text">¿Salir del examen?</p>
            <p className="mt-3 text-sm text-zr-text-muted">
              Tus respuestas ya están guardadas. Puedes volver a entrar más tarde y seguir
              donde lo dejaste.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmandoSalir(false)}
                className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text"
              >
                Seguir presentando
              </button>
              <button
                onClick={() => router.push('/examenes')}
                className="flex-1 rounded-lg bg-zr-blue px-4 py-3 text-sm font-bold text-white"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-zr-surface border-b border-zr-border px-5 py-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="min-w-0">
              <button
                onClick={() => setConfirmandoSalir(true)}
                className="mb-1 text-xs font-semibold text-zr-text-muted active:text-zr-text"
              >
                ← Salir
              </button>
              <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-widest">
                Pregunta {currentQuestionIndex + 1} de {questions.length}
              </p>
              <h1 className="text-2xl font-bold text-zr-text mt-1 truncate">{exam?.title}</h1>
            </div>
            {timeLeft !== null && (
              <div className={`text-right ${timeLeft < 300 ? 'text-zr-error' : 'text-zr-text'}`}>
                <p className="text-xs font-semibold">Tiempo</p>
                <p className="text-lg font-bold">
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zr-border rounded-full h-2">
            <div
              className="bg-zr-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8 pb-32">
        <div className="space-y-8 animate-fade-in">
          {/* Question Text */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-zr-text leading-relaxed">{currentQuestion.enunciado}</h2>
            <p className="text-sm text-zr-blue font-semibold">{currentQuestion.points} punto{currentQuestion.points > 1 ? 's' : ''}</p>
          </div>

          {/* Answer Input based on type */}
          {currentQuestion.type === 'opcion_multiple' && (
            <div className="space-y-3">
              {currentQuestion.options?.map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleAnswerChange({ key: option.key })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    opcionElegida(currentAnswer?.value) === option.key
                      ? 'border-zr-blue bg-zr-blue/10'
                      : 'border-zr-border bg-zr-surface hover:border-zr-blue/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        opcionElegida(currentAnswer?.value) === option.key
                          ? 'border-zr-blue bg-zr-blue'
                          : 'border-zr-text-muted'
                      }`}
                    >
                      {opcionElegida(currentAnswer?.value) === option.key && (
                        <span className="text-white text-sm font-bold">✓</span>
                      )}
                    </div>
                    <span className="text-zr-text font-medium">{option.text}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'verdadero_falso' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: true, label: 'Verdadero' },
                { value: false, label: 'Falso' },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => handleAnswerChange({ value: option.value })}
                  className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                    valorElegido(currentAnswer?.value) === option.value
                      ? 'border-zr-blue bg-zr-blue text-white'
                      : 'border-zr-border bg-zr-surface text-zr-text hover:border-zr-blue/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Sin bloque de rúbrica: la vista v_exam_questions_student no la
              expone a propósito. La rúbrica es la guía de corrección del
              profesor; enseñársela al estudiante es darle el patrón de respuesta. */}
          {currentQuestion.type === 'redaccion_abierta' && (
            <div className="space-y-2">
              <textarea
                value={textoEscrito(currentAnswer?.value)}
                onChange={(e) => handleAnswerChange({ text: e.target.value })}
                placeholder="Escribe tu respuesta aquí..."
                className="w-full min-h-40 p-4 rounded-lg bg-zr-surface border border-zr-border text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirmación de entrega. Entregar es irreversible: el intento pasa a
          'entregado' y ya no se puede volver a abrir. */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-5 sm:items-center">
          <div className="zr-card w-full max-w-sm animate-rise p-6">
            <p className="zr-display text-xl text-zr-text">¿Entregar el examen?</p>
            <p className="mt-3 text-sm leading-relaxed text-zr-text-muted">
              {sinResponder > 0
                ? `Te quedan ${sinResponder} pregunta${sinResponder > 1 ? 's' : ''} sin responder. Cuentan como cero.`
                : 'Respondiste todas las preguntas.'}{' '}
              Una vez entregado no podrás cambiar tus respuestas.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text"
              >
                Seguir revisando
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-zr-success px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? 'Entregando…' : 'Sí, entregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-zr-surface border-t border-zr-border px-5 py-4 space-y-3">
        {submitError && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
            {submitError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex-1 px-4 py-3 bg-zr-border text-zr-text rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zr-border/80 transition-all"
          >
            Anterior
          </button>

          {!isLastQuestion ? (
            <button
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="flex-1 px-4 py-3 bg-zr-blue text-white rounded-lg font-semibold hover:bg-zr-blue-deep transition-all"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-zr-success text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-zr-success/90 transition-all"
            >
              {submitting ? 'Entregando...' : 'Entregar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
