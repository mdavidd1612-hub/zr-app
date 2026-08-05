'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Question {
  id: string
  type: 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'
  enunciado: string
  options?: Array<{ key: string; text: string }>
  points: number
  rubric?: string
}

interface Answer {
  questionId: string
  value: any
}

export default function ExamenPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string
  const supabase = createClient()

  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptId, setAttemptId] = useState<string>('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

      // Load questions using v_exam_questions_student (NEVER the base table)
      const { data: questionsData } = await supabase
        .from('v_exam_questions_student')
        .select('*')
        .eq('exam_id', examId)
        .order('order', { ascending: true })

      if (questionsData) {
        const parsedQuestions = questionsData.map((q: any) => ({
          id: q.id,
          type: q.question_type,
          enunciado: q.enunciado,
          points: q.points,
          rubric: q.rubric,
          options: q.options ? JSON.parse(q.options) : undefined,
        }))
        setQuestions(parsedQuestions)
      }

      // Get or create attempt
      let { data: attempt } = await supabase
        .from('exam_attempts')
        .select('id, status')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .single()

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
            existingAnswers.map((a: any) => ({
              questionId: a.question_id,
              value: typeof a.answer === 'string' ? JSON.parse(a.answer) : a.answer,
            }))
          )
        }
      }

      // Set timer if exam has duration
      if (examData.duration_minutes) {
        setTimeLeft(examData.duration_minutes * 60)
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

  const handleAnswerChange = useCallback(
    (value: any) => {
      const newAnswers = answers.filter((a) => a.questionId !== currentQuestion.id)
      newAnswers.push({ questionId: currentQuestion.id, value })
      setAnswers(newAnswers)

      // Auto-save answer
      saveAnswer(currentQuestion.id, value)
    },
    [answers, currentQuestion]
  )

  async function saveAnswer(questionId: string, value: any) {
    if (!attemptId) return

    const { data: existing } = await supabase
      .from('exam_answers')
      .select('id')
      .eq('attempt_id', attemptId)
      .eq('question_id', questionId)
      .single()

    if (existing) {
      void supabase
        .from('exam_answers')
        .update({ answer: value })
        .eq('id', existing.id)
    } else {
      void supabase.from('exam_answers').insert({
        attempt_id: attemptId,
        question_id: questionId,
        answer: value,
      })
    }
  }

  async function handleSubmit() {
    setSubmitting(true)

    const response = await fetch('/api/exam/submit-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId }),
    })

    if (response.ok) {
      router.push('/examenes')
    } else {
      setSubmitting(false)
    }
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

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      {/* Header */}
      <div className="bg-zr-surface border-b border-zr-border px-5 py-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-widest">
                Pregunta {currentQuestionIndex + 1} de {questions.length}
              </p>
              <h1 className="text-2xl font-bold text-zr-text mt-1">{exam?.title}</h1>
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
                    currentAnswer?.value?.key === option.key
                      ? 'border-zr-blue bg-zr-blue/10'
                      : 'border-zr-border bg-zr-surface hover:border-zr-blue/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        currentAnswer?.value?.key === option.key
                          ? 'border-zr-blue bg-zr-blue'
                          : 'border-zr-text-muted'
                      }`}
                    >
                      {currentAnswer?.value?.key === option.key && (
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
                    currentAnswer?.value?.value === option.value
                      ? 'border-zr-blue bg-zr-blue text-white'
                      : 'border-zr-border bg-zr-surface text-zr-text hover:border-zr-blue/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'redaccion_abierta' && (
            <div className="space-y-2">
              {currentQuestion.rubric && (
                <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-4">
                  <p className="text-xs text-zr-blue-mid font-semibold uppercase tracking-widest mb-2">Rúbrica</p>
                  <p className="text-sm text-zr-text">{currentQuestion.rubric}</p>
                </div>
              )}
              <textarea
                value={currentAnswer?.value?.text || ''}
                onChange={(e) => handleAnswerChange({ text: e.target.value })}
                placeholder="Escribe tu respuesta aquí..."
                className="w-full min-h-40 p-4 rounded-lg bg-zr-surface border border-zr-border text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-zr-surface border-t border-zr-border px-5 py-4 space-y-3">
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
              onClick={handleSubmit}
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
