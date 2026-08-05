'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QuestionEditor } from '@/components/QuestionEditor'

interface Question {
  id: string
  type: 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'
  statement: string
  points: number
  options?: Array<{ key: string; text: string }>
  correct_answer?: any
  rubric?: string | null
}

export default function NuevoExamen() {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [module, setModule] = useState('1')
  const [maxPoints, setMaxPoints] = useState(20)
  const [duration, setDuration] = useState(90)
  const [questions, setQuestions] = useState<Question[]>([])
  const [showQuestionEditor, setShowQuestionEditor] = useState<
    'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta' | null
  >(null)
  const [submitting, setSubmitting] = useState(false)

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  const pointsMatch = totalPoints === maxPoints
  const canPublish = questions.length > 0 && pointsMatch && title.trim() !== ''

  function handleAddQuestion(questionData: any) {
    const newQuestion: Question = {
      id: `q${Date.now()}`,
      type: questionData.type,
      statement: questionData.statement,
      points: questionData.points,
      options: questionData.options,
      correct_answer: questionData.correct_answer,
      rubric: questionData.rubric,
    }
    setQuestions([...questions, newQuestion])
    setShowQuestionEditor(null)
  }

  function handleDeleteQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  async function handleCreateExam() {
    if (!canPublish) return

    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { data: newExam, error: examError } = await supabase
      .from('exams')
      .insert({
        title,
        module_id: module,
        teacher_id: user.id,
        max_score: maxPoints,
        duration_minutes: duration,
        status: 'oculto',
      })
      .select()
      .single()

    if (examError || !newExam) {
      console.error('Error creating exam:', examError)
      alert('Error al crear el examen')
      setSubmitting(false)
      return
    }

    // Insert questions
    const questionInserts = questions.map((q, idx) => ({
      exam_id: newExam.id,
      type: q.type,
      statement: q.statement,
      points: q.points,
      order_index: idx,
      options: q.options ? JSON.stringify(q.options) : null,
      correct_answer: q.correct_answer ? JSON.stringify(q.correct_answer) : null,
      rubric: q.rubric || null,
    }))

    const { error: questionsError } = await supabase.from('exam_questions').insert(questionInserts)

    if (questionsError) {
      console.error('Error inserting questions:', questionsError)
      alert('Error al guardar las preguntas')
      setSubmitting(false)
      return
    }

    router.push('/crear-examen')
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-zr-text">Crear Examen</h1>
            <p className="text-sm text-zr-text-muted mt-2">Configura los datos y agrega preguntas</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Exam Details Form */}
          <div className="space-y-4 bg-zr-surface border border-zr-border rounded-lg p-5">
            <div>
              <label className="block text-sm font-semibold text-zr-text mb-2">Título del Examen</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Electricidad Automotriz Básica"
                className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-zr-text mb-2">Módulo</label>
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none"
                >
                  <option value="1">Módulo 1</option>
                  <option value="2">Módulo 2</option>
                  <option value="3">Módulo 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zr-text mb-2">Puntos Máximos</label>
                <input
                  type="number"
                  value={maxPoints}
                  onChange={(e) => setMaxPoints(parseInt(e.target.value))}
                  min="1"
                  className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zr-text mb-2">Duración (minutos)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                min="1"
                className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Points Indicator */}
          <div
            className={`p-4 rounded-lg border ${
              pointsMatch
                ? 'bg-zr-success/10 border-zr-success/30 text-zr-success'
                : 'bg-zr-error/10 border-zr-error/30 text-zr-error'
            }`}
          >
            <p className="font-semibold text-sm">
              Puntos asignados: {totalPoints} / {maxPoints}
            </p>
          </div>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-zr-text">Preguntas ({questions.length})</h2>
              {!showQuestionEditor && (
                <button
                  onClick={() => setShowQuestionEditor('opcion_multiple')}
                  className="px-4 py-2 bg-zr-blue text-white rounded-lg font-semibold hover:bg-zr-blue-deep transition-all text-sm"
                >
                  + Agregar Pregunta
                </button>
              )}
            </div>

            {/* Question Type Selector */}
            {showQuestionEditor && !showQuestionEditor && (
              <div className="bg-zr-surface border border-zr-border rounded-lg p-5">
                <p className="text-sm text-zr-text-muted mb-4">Selecciona el tipo de pregunta</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setShowQuestionEditor('opcion_multiple')}
                    className="text-left p-4 bg-zr-background border border-zr-border rounded-lg hover:border-zr-blue/50 hover:bg-zr-blue/5 transition-all"
                  >
                    <p className="font-semibold text-zr-text">Opción Múltiple</p>
                    <p className="text-xs text-zr-text-muted mt-1">2-6 opciones, marcar la correcta</p>
                  </button>
                  <button
                    onClick={() => setShowQuestionEditor('verdadero_falso')}
                    className="text-left p-4 bg-zr-background border border-zr-border rounded-lg hover:border-zr-blue/50 hover:bg-zr-blue/5 transition-all"
                  >
                    <p className="font-semibold text-zr-text">Verdadero / Falso</p>
                    <p className="text-xs text-zr-text-muted mt-1">Una respuesta correcta</p>
                  </button>
                  <button
                    onClick={() => setShowQuestionEditor('redaccion_abierta')}
                    className="text-left p-4 bg-zr-background border border-zr-border rounded-lg hover:border-zr-blue/50 hover:bg-zr-blue/5 transition-all"
                  >
                    <p className="font-semibold text-zr-text">Redacción Abierta</p>
                    <p className="text-xs text-zr-text-muted mt-1">El profesor califica la respuesta</p>
                  </button>
                </div>
              </div>
            )}

            {/* Question Editor */}
            {showQuestionEditor && (
              <QuestionEditor
                type={showQuestionEditor}
                onSave={handleAddQuestion}
                onCancel={() => setShowQuestionEditor(null)}
              />
            )}

            {/* Questions List */}
            {questions.length > 0 && !showQuestionEditor && (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-zr-surface border border-zr-border rounded-lg p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zr-text-muted">Pregunta {idx + 1}</p>
                        <p className="text-base font-semibold text-zr-text mt-1 line-clamp-2">{q.statement}</p>
                        <div className="flex gap-2 mt-2 text-xs text-zr-text-muted">
                          <span>{q.type === 'opcion_multiple' ? '⭕ Opción múltiple' : q.type === 'verdadero_falso' ? '✓ V/F' : '📝 Redacción'}</span>
                          <span>•</span>
                          <span className="text-zr-blue font-semibold">{q.points} pts</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-zr-error hover:text-zr-error/80 font-semibold text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 px-4 py-3 bg-zr-border text-zr-text rounded-lg font-semibold hover:bg-zr-border/80 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateExam}
              disabled={!canPublish || submitting}
              className="flex-1 px-4 py-3 bg-zr-blue text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zr-blue-deep transition-all"
            >
              {submitting ? 'Guardando...' : 'Guardar Examen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
