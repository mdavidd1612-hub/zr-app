'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FeedbackQuestion {
  id: string
  question: string
}

const QUESTIONS: FeedbackQuestion[] = [
  { id: '1', question: '¿Cuánto aprendiste hoy?' },
  { id: '2', question: '¿Qué tan claro fue el profesor?' },
  { id: '3', question: '¿Cuánto disfrutaste la clase?' },
]

const TIME_LIMIT = 20 // segundos

export default function FeedbackPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Timer effect
  useEffect(() => {
    if (submitted || currentQuestion >= QUESTIONS.length) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentQuestion, submitted])

  async function handleSubmit() {
    setSubmitting(true)

    // Format answers as JSON array
    const feedbackAnswers = QUESTIONS.map((q) => ({
      q: q.question,
      a: answers[q.id] || 0,
    }))

    // In a real app, this would save to the database
    // For now, just show confirmation
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSubmitted(true)
  }

  function handleSelectRating(rating: number) {
    setAnswers({
      ...answers,
      [QUESTIONS[currentQuestion].id]: rating,
    })

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setTimeLeft(TIME_LIMIT)
    } else {
      handleSubmit()
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-zr-background flex flex-col items-center justify-center p-5">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-6xl">✨</div>
          <h1 className="text-3xl font-bold text-zr-text">¡Gracias!</h1>
          <p className="text-zr-text-muted text-base leading-relaxed">
            Tu respuesta es completamente anónima para tu profesor.
          </p>
          <p className="text-sm text-zr-text-muted mt-6">
            Puedes cerrar esta ventana o volver a la app
          </p>

          <button
            onClick={() => router.push('/')}
            className="mt-8 px-6 py-3 bg-zr-blue text-white rounded-lg font-semibold hover:bg-zr-blue-deep transition-all"
          >
            Volver a Inicio
          </button>
        </div>
      </div>
    )
  }

  const question = QUESTIONS[currentQuestion]
  const progress = ((currentQuestion) / QUESTIONS.length) * 100

  return (
    <div className="min-h-dvh bg-zr-background flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zr-text">Tu Opinión Importa</h1>
          <p className="text-sm text-zr-text-muted">Pregunta {currentQuestion + 1} de {QUESTIONS.length}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-zr-border rounded-full h-2">
            <div
              className="bg-zr-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Timer */}
          <div
            className={`text-center text-sm font-bold ${
              timeLeft <= 5 ? 'text-zr-error' : 'text-zr-text-muted'
            }`}
          >
            ⏱️ {timeLeft}s
          </div>
        </div>

        {/* Question */}
        <div className="bg-zr-surface border border-zr-border rounded-lg p-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-zr-text">{question.question}</h2>

          {/* Rating Buttons (1-5 with emojis) */}
          <div className="space-y-4">
            <div className="flex justify-between gap-2">
              <button
                onClick={() => handleSelectRating(1)}
                className={`flex-1 aspect-square rounded-lg font-bold text-3xl transition-all ${
                  answers[question.id] === 1
                    ? 'bg-zr-error/20 border-2 border-zr-error scale-110'
                    : 'bg-zr-background border-2 border-zr-border hover:border-zr-error/50'
                }`}
              >
                😞
              </button>
              <button
                onClick={() => handleSelectRating(2)}
                className={`flex-1 aspect-square rounded-lg font-bold text-3xl transition-all ${
                  answers[question.id] === 2
                    ? 'bg-zr-warning/20 border-2 border-zr-warning scale-110'
                    : 'bg-zr-background border-2 border-zr-border hover:border-zr-warning/50'
                }`}
              >
                😐
              </button>
              <button
                onClick={() => handleSelectRating(3)}
                className={`flex-1 aspect-square rounded-lg font-bold text-3xl transition-all ${
                  answers[question.id] === 3
                    ? 'bg-zr-blue/20 border-2 border-zr-blue scale-110'
                    : 'bg-zr-background border-2 border-zr-border hover:border-zr-blue/50'
                }`}
              >
                😊
              </button>
              <button
                onClick={() => handleSelectRating(4)}
                className={`flex-1 aspect-square rounded-lg font-bold text-3xl transition-all ${
                  answers[question.id] === 4
                    ? 'bg-zr-success/20 border-2 border-zr-success scale-110'
                    : 'bg-zr-background border-2 border-zr-border hover:border-zr-success/50'
                }`}
              >
                😄
              </button>
              <button
                onClick={() => handleSelectRating(5)}
                className={`flex-1 aspect-square rounded-lg font-bold text-3xl transition-all ${
                  answers[question.id] === 5
                    ? 'bg-zr-blue-light/20 border-2 border-zr-blue-light scale-110'
                    : 'bg-zr-background border-2 border-zr-border hover:border-zr-blue-light/50'
                }`}
              >
                🤩
              </button>
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-zr-text-muted font-semibold">
              <span>Muy poco</span>
              <span>Excelente</span>
            </div>
          </div>
        </div>

        {/* Skip/Next Info */}
        <p className="text-center text-xs text-zr-text-muted">
          Responde rápido — tienes {TIME_LIMIT} segundos por pregunta
        </p>
      </div>
    </div>
  )
}
