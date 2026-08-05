'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ExamData {
  id: string
  title: string
  status: 'oculto' | 'habilitado' | 'cerrado' | 'calificado'
  module: string
  questionCount: number
  points: number
  createdAt: string
}

export default function ProfessorExams() {
  const router = useRouter()
  const supabase = createClient()
  const [exams, setExams] = useState<ExamData[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  useEffect(() => {
    async function loadExams() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Mock data for now - professor exams list
      setExams([
        {
          id: '1',
          title: 'Electricidad Automotriz Básica',
          status: 'habilitado',
          module: 'Módulo 1',
          questionCount: 8,
          points: 20,
          createdAt: '2026-08-01',
        },
        {
          id: '2',
          title: 'Diagnóstico de Sistemas',
          status: 'oculto',
          module: 'Módulo 2',
          questionCount: 10,
          points: 20,
          createdAt: '2026-08-03',
        },
      ])

      setLoading(false)
    }

    loadExams()
  }, [])

  async function handlePublishExam(examId: string) {
    setPublishing(examId)

    const { error } = await supabase
      .from('exams')
      .update({ status: 'habilitado', published_at: new Date().toISOString() })
      .eq('id', examId)

    if (error) {
      alert('Error al publicar: ' + error.message)
    } else {
      setExams(exams.map((e) => (e.id === examId ? { ...e, status: 'habilitado' } : e)))
    }

    setPublishing(null)
  }

  async function handleDuplicateExam(examId: string) {
    setDuplicating(examId)

    const sourceExam = exams.find((e) => e.id === examId)
    if (!sourceExam) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create new exam
    const { data: newExam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `${sourceExam.title} (copia)`,
        module_id: sourceExam.module,
        teacher_id: user.id,
        max_score: sourceExam.points,
        status: 'oculto',
      })
      .select()
      .single()

    if (examError || !newExam) {
      alert('Error al duplicar examen')
      setDuplicating(null)
      return
    }

    // Copy questions
    const { data: sourceQuestions } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)

    if (sourceQuestions && sourceQuestions.length > 0) {
      const questionInserts = sourceQuestions.map((q: any) => ({
        exam_id: newExam.id,
        type: q.type,
        statement: q.statement,
        points: q.points,
        order_index: q.order_index,
        options: q.options,
        correct_answer: q.correct_answer,
        rubric: q.rubric,
      }))

      await supabase.from('exam_questions').insert(questionInserts)
    }

    // Add to list
    setExams([
      ...exams,
      {
        id: newExam.id,
        title: newExam.title,
        status: 'oculto',
        module: sourceExam.module,
        questionCount: sourceQuestions?.length || 0,
        points: newExam.max_score,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ])

    setDuplicating(null)
  }

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando exámenes...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-4xl font-bold text-zr-text">Mis Exámenes</h1>
                <p className="text-base text-zr-text-muted mt-2">
                  {exams.length} {exams.length === 1 ? 'examen' : 'exámenes'} creados
                </p>
              </div>
              <button
                onClick={() => router.push('/crear-examen/nuevo')}
                className="px-6 py-3 bg-gradient-to-r from-zr-blue to-zr-blue-deep text-white rounded-lg font-bold hover:shadow-lg hover:shadow-zr-blue/30 transition-all whitespace-nowrap"
              >
                ✏️ Crear Examen
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Exams List */}
          {exams.length === 0 ? (
            <div className="bg-zr-surface border border-zr-border rounded-xl p-12 text-center space-y-4">
              <div className="text-5xl">📝</div>
              <p className="text-lg text-zr-text font-semibold">No has creado exámenes aún</p>
              <p className="text-sm text-zr-text-muted">
                Comienza a crear tu primer examen para que tus estudiantes puedan practicar
              </p>
              <button
                onClick={() => router.push('/crear-examen/nuevo')}
                className="mt-4 px-6 py-3 bg-zr-blue text-white rounded-lg font-semibold hover:bg-zr-blue-deep transition-all inline-block"
              >
                Crear Primer Examen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="group bg-gradient-to-br from-zr-surface to-zr-background border border-zr-border rounded-xl p-6 hover:border-zr-blue/50 hover:shadow-lg transition-all"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-zr-text group-hover:text-zr-blue transition-colors">
                        {exam.title}
                      </h3>
                      <p className="text-sm text-zr-text-muted mt-1">{exam.module}</p>
                    </div>

                    <div
                      className={`flex-shrink-0 px-4 py-2 rounded-full font-semibold text-sm border ${
                        exam.status === 'habilitado'
                          ? 'bg-zr-success/15 border-zr-success/30 text-zr-success'
                          : exam.status === 'oculto'
                          ? 'bg-zr-text-muted/10 border-zr-text-muted/30 text-zr-text-muted'
                          : 'bg-zr-blue/10 border-zr-blue/30 text-zr-blue'
                      }`}
                    >
                      {exam.status === 'habilitado' && '✓ Publicado'}
                      {exam.status === 'oculto' && '○ Borrador'}
                      {exam.status === 'cerrado' && '🔒 Cerrado'}
                      {exam.status === 'calificado' && '✓ Calificado'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-5 pb-5 border-b border-zr-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📋</span>
                      <div className="min-w-0">
                        <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-wide">
                          Preguntas
                        </p>
                        <p className="text-lg font-bold text-zr-text">{exam.questionCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      <div className="min-w-0">
                        <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-wide">
                          Puntos
                        </p>
                        <p className="text-lg font-bold text-zr-blue">{exam.points}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📅</span>
                      <div className="min-w-0">
                        <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-wide">
                          Creado
                        </p>
                        <p className="text-lg font-bold text-zr-text">{exam.createdAt}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => router.push(`/crear-examen/${exam.id}/editar`)}
                      className="flex-1 min-w-32 px-4 py-3 text-sm bg-zr-blue text-white rounded-lg font-bold hover:bg-zr-blue-deep transition-all"
                    >
                      ✏️ Editar
                    </button>

                    {exam.status === 'oculto' && (
                      <>
                        <button
                          onClick={() => handlePublishExam(exam.id)}
                          disabled={publishing === exam.id}
                          className="flex-1 min-w-32 px-4 py-3 text-sm bg-zr-success/15 border border-zr-success/30 text-zr-success rounded-lg font-bold hover:bg-zr-success/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {publishing === exam.id ? '⏳ Publicando...' : '🚀 Publicar'}
                        </button>

                        <button
                          onClick={() => handleDuplicateExam(exam.id)}
                          disabled={duplicating === exam.id}
                          className="flex-1 min-w-32 px-4 py-3 text-sm bg-zr-blue/15 border border-zr-blue/30 text-zr-blue rounded-lg font-bold hover:bg-zr-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {duplicating === exam.id ? '⏳ Duplicando...' : '📋 Duplicar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
