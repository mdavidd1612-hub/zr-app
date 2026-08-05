'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PendingAnswer {
  id: string
  studentName: string
  examTitle: string
  questionText: string
  studentAnswer: string
  rubric?: string
  maxPoints: number
  answerId: string
}

export default function ProfessorGrading() {
  const supabase = createClient()
  const [pendingAnswers, setPendingAnswers] = useState<PendingAnswer[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [points, setPoints] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPendingAnswers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load pending answers (redaccion_abierta type with awarded_points = null)
      // This is simplified - normally would join with exam_questions and exams
      const { data: answers } = await supabase
        .from('exam_answers')
        .select(`
          id,
          answer,
          exam_attempts(
            id,
            exams(title, max_points),
            profiles(full_name)
          ),
          exam_questions(points, enunciado, rubric)
        `)
        .is('awarded_points', null)
        .eq('exam_questions.question_type', 'redaccion_abierta')
        .order('created_at', { ascending: true })

      if (answers) {
        // Mock data for now
        setPendingAnswers([
          {
            id: '1',
            studentName: 'Juan Carlos Pérez',
            examTitle: 'Electricidad Automotriz Básica',
            questionText: '¿Cuál es el rol del alternador en un vehículo?',
            studentAnswer:
              'El alternador es un dispositivo que convierte la energía mecánica del motor en energía eléctrica...',
            rubric: 'Debe mencionar la conversión de energía, el mantenimiento de carga y el funcionamiento básico',
            maxPoints: 5,
            answerId: '1',
          },
          {
            id: '2',
            studentName: 'María García López',
            examTitle: 'Electricidad Automotriz Básica',
            questionText: '¿Cuál es el rol del alternador en un vehículo?',
            studentAnswer: 'Es lo que produce electricidad para el carro',
            rubric: 'Debe mencionar la conversión de energía, el mantenimiento de carga y el funcionamiento básico',
            maxPoints: 5,
            answerId: '2',
          },
        ])
      }

      setLoading(false)
    }

    loadPendingAnswers()
  }, [])

  const currentAnswer = pendingAnswers[currentIndex]

  async function handleGradeAnswer() {
    if (!currentAnswer) return

    setSaving(true)

    const response = await fetch('/api/exam/grade-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answerId: currentAnswer.answerId,
        awardedPoints: points,
        feedback,
      }),
    })

    if (response.ok) {
      if (currentIndex < pendingAnswers.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setPoints(0)
        setFeedback('')
      } else {
        // All done
        alert('¡Calificación completada!')
      }
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando preguntas...</div>
      </div>
    )
  }

  if (pendingAnswers.length === 0) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <p className="text-2xl font-bold text-zr-text">✓ ¡Todo calificado!</p>
          <p className="text-zr-text-muted">No hay respuestas pendientes de calificar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      {/* Progress */}
      <div className="bg-zr-surface border-b border-zr-border px-5 py-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-zr-text-muted font-semibold">
            Respuesta {currentIndex + 1} de {pendingAnswers.length}
          </p>
          <p className="text-sm text-zr-blue font-semibold">
            {Math.round(((currentIndex + 1) / pendingAnswers.length) * 100)}%
          </p>
        </div>
        <div className="w-full bg-zr-border rounded-full h-2">
          <div
            className="bg-zr-blue h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / pendingAnswers.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="space-y-8">
          {/* Exam & Student Info */}
          <div className="bg-zr-surface border border-zr-border rounded-lg p-5">
            <p className="text-xs text-zr-blue-mid font-bold uppercase tracking-widest mb-2">Estudiante</p>
            <p className="text-lg font-bold text-zr-text">{currentAnswer.studentName}</p>
            <p className="text-sm text-zr-text-muted mt-3">{currentAnswer.examTitle}</p>
          </div>

          {/* Question */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-zr-text">{currentAnswer.questionText}</h2>
            <p className="text-sm text-zr-blue font-semibold">{currentAnswer.maxPoints} puntos</p>
          </div>

          {/* Rubric */}
          {currentAnswer.rubric && (
            <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-4">
              <p className="text-xs text-zr-blue-mid font-bold uppercase tracking-widest mb-2">Rúbrica</p>
              <p className="text-sm text-zr-text">{currentAnswer.rubric}</p>
            </div>
          )}

          {/* Student Answer */}
          <div className="bg-zr-surface border border-zr-border rounded-lg p-5">
            <p className="text-xs text-zr-text-muted font-bold uppercase tracking-widest mb-3">Respuesta del estudiante</p>
            <p className="text-zr-text leading-relaxed">{currentAnswer.studentAnswer}</p>
          </div>

          {/* Grading Form */}
          <div className="space-y-4 bg-zr-surface border border-zr-border rounded-lg p-5">
            <div>
              <label className="block text-sm font-semibold text-zr-text mb-2">
                Puntuación (0 - {currentAnswer.maxPoints})
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Math.min(currentAnswer.maxPoints, Math.max(0, parseInt(e.target.value) || 0)))}
                min="0"
                max={currentAnswer.maxPoints}
                className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none text-lg font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zr-text mb-2">Comentario (opcional)</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Escribe retroalimentación para el estudiante..."
                className="w-full min-h-24 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-zr-surface border-t border-zr-border px-5 py-4">
        <button
          onClick={handleGradeAnswer}
          disabled={saving}
          className="w-full px-4 py-3 bg-zr-success text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-zr-success/90 transition-all"
        >
          {saving ? 'Guardando...' : currentIndex < pendingAnswers.length - 1 ? 'Guardar y Siguiente' : 'Finalizar Calificación'}
        </button>
      </div>
    </div>
  )
}
