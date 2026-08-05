'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ExamItem {
  id: string
  title: string
  module: string
  status: 'habilitado' | 'cerrado' | 'calificado'
  attemptStatus?: 'no_iniciado' | 'en_progreso' | 'entregado' | 'calificado'
  score?: number | null
  maxScore: number
  dueDate?: string
}

export default function Examenes() {
  const router = useRouter()
  const supabase = createClient()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadExams() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Load exams that are published (habilitado, cerrado, or calificado)
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('id, title, max_points, status, close_date, module_id')
          .in('status', ['habilitado', 'cerrado', 'calificado'])
          .order('close_date', { ascending: true })

        if (examError) {
          console.error('Error loading exams:', examError)
          setExams([])
          setLoading(false)
          return
        }

        if (!examData || examData.length === 0) {
          setExams([])
          setLoading(false)
          return
        }

        // For each exam, load the student's attempt status
        const examsWithAttempts = await Promise.all(
          examData.map(async (exam: any) => {
            const { data: attempt } = await supabase
              .from('exam_attempts')
              .select('status, total_score')
              .eq('exam_id', exam.id)
              .eq('student_id', user.id)
              .single()

            return {
              id: exam.id,
              title: exam.title,
              module: 'Módulo',
              status: exam.status as ExamItem['status'],
              attemptStatus: (attempt?.status || 'no_iniciado') as ExamItem['attemptStatus'],
              score: attempt?.total_score,
              maxScore: exam.max_points,
              dueDate: exam.close_date,
            }
          })
        )

        setExams(examsWithAttempts)
      } catch (error) {
        console.error('Exception loading exams:', error)
        setExams([])
      } finally {
        setLoading(false)
      }
    }

    loadExams()
  }, [])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando exámenes...</div>
      </div>
    )
  }

  const canTakeExam = (exam: ExamItem) => {
    return exam.status === 'habilitado' && exam.attemptStatus !== 'entregado' && exam.attemptStatus !== 'calificado'
  }

  const getAttemptStatusBadge = (attemptStatus?: string) => {
    switch (attemptStatus) {
      case 'no_iniciado':
        return { label: 'Sin iniciar', color: 'bg-zr-text-muted/10 border-zr-text-muted/30 text-zr-text-muted' }
      case 'en_progreso':
        return { label: 'En progreso', color: 'bg-zr-blue/10 border-zr-blue/30 text-zr-blue' }
      case 'entregado':
        return { label: 'Entregado', color: 'bg-zr-warning/10 border-zr-warning/30 text-zr-warning' }
      case 'calificado':
        return { label: 'Calificado', color: 'bg-zr-success/10 border-zr-success/30 text-zr-success' }
      default:
        return { label: 'Sin iniciar', color: 'bg-zr-text-muted/10 border-zr-text-muted/30 text-zr-text-muted' }
    }
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-12">
          {/* Header */}
          <div className="space-y-1 animate-fade-in" style={{ animationDelay: '0ms' }}>
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">Mis Exámenes</h1>
            <p className="text-sm text-zr-text-muted font-medium">{exams.length} evaluaciones</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border animate-fade-in" style={{ animationDelay: '100ms' }} />

          {/* Exams Section */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">01 — EVALUACIONES</span>
            </div>

            {exams.length === 0 ? (
              <div className="bg-zr-surface border border-zr-border rounded-lg p-8 text-center">
                <p className="text-zr-text-muted text-sm">No hay exámenes disponibles en este momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exams.map((exam, idx) => {
                  const canTake = canTakeExam(exam)
                  const badge = getAttemptStatusBadge(exam.attemptStatus)

                  return (
                    <button
                      key={exam.id}
                      onClick={() => {
                        if (canTake) {
                          router.push(`/examenes/${exam.id}`)
                        }
                      }}
                      className={`w-full group text-left transition-all duration-300 animate-fade-in ${
                        canTake ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                      style={{ animationDelay: `${200 + idx * 100}ms` }}
                      disabled={!canTake}
                    >
                      <div
                        className={`bg-zr-surface border border-zr-border rounded-lg p-5 transition-all ${
                          canTake
                            ? 'hover:border-zr-blue/50 group-hover:shadow-md group-hover:translate-y-[-2px]'
                            : 'opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-zr-text group-hover:text-zr-blue transition-colors">
                              {exam.title}
                            </h3>
                            <p className="text-xs text-zr-text-muted mt-2">{exam.module}</p>
                            {exam.score !== undefined && exam.attemptStatus === 'calificado' && (
                              <p className="text-sm text-zr-blue font-semibold mt-2">
                                Puntuación: {exam.score}/{exam.maxScore}
                              </p>
                            )}
                          </div>

                          <div className="flex-shrink-0">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full border font-semibold text-xs ${badge.color}`}>
                              {badge.label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-5 space-y-2 animate-fade-in" style={{ animationDelay: '250ms' }}>
            <p className="text-sm font-semibold text-zr-text">📝 Recuerda</p>
            <p className="text-sm text-zr-text-muted">
              Consulta el material de apoyo antes de cada examen. Las preguntas abiertas serán calificadas por tu profesor.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
