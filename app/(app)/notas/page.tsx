'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GradeData {
  moduleId: string
  moduleName: string
  theory: number | null
  practice: number | null
  participation: number | null
  finalScore: number | null
  status: 'aprobado' | 'reprobado' | 'pendiente'
  passingScore: number
}

export default function StudentGrades() {
  const router = useRouter()
  const supabase = createClient()
  const [grades, setGrades] = useState<GradeData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadGrades() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Mock data for now
      setGrades([
        {
          moduleId: '1',
          moduleName: 'Módulo 1 - Electricidad Básica',
          theory: 15,
          practice: 14,
          participation: 9,
          finalScore: 14.5,
          status: 'aprobado',
          passingScore: 10,
        },
        {
          moduleId: '2',
          moduleName: 'Módulo 2 - Diagnóstico',
          theory: 12,
          practice: null,
          participation: 8,
          finalScore: null,
          status: 'pendiente',
          passingScore: 12,
        },
        {
          moduleId: '3',
          moduleName: 'Módulo 3 - Sistemas',
          theory: 9,
          practice: 8,
          participation: 7,
          finalScore: 8,
          status: 'reprobado',
          passingScore: 12,
        },
      ])

      setLoading(false)
    }

    loadGrades()
  }, [])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando calificaciones...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 py-8 pb-24">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zr-text">Mis Calificaciones</h1>
            <p className="text-sm text-zr-text-muted mt-2">Estado por módulo</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Grades by Module */}
          <div className="space-y-6">
            {grades.map((grade) => (
              <div key={grade.moduleId} className="space-y-4">
                {/* Module Header */}
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-zr-text">{grade.moduleName}</h2>
                  <div className="flex items-center gap-2">
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${
                        grade.status === 'aprobado'
                          ? 'bg-zr-success/10 border-zr-success/30 text-zr-success'
                          : grade.status === 'reprobado'
                          ? 'bg-zr-error/10 border-zr-error/30 text-zr-error'
                          : 'bg-zr-text-muted/10 border-zr-text-muted/30 text-zr-text-muted'
                      }`}
                    >
                      {grade.status === 'aprobado' && '✓ Aprobado'}
                      {grade.status === 'reprobado' && '✗ Reprobado'}
                      {grade.status === 'pendiente' && '○ Pendiente'}
                    </div>
                    <span className="text-xs text-zr-text-muted">
                      Aprueba con {grade.passingScore}
                    </span>
                  </div>
                </div>

                {/* Grade Components Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zr-surface border border-zr-border rounded-lg p-4">
                    <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-widest mb-2">
                      Teoría
                    </p>
                    <p className="text-3xl font-bold text-zr-blue">
                      {grade.theory !== null ? grade.theory : '—'}
                    </p>
                  </div>

                  <div className="bg-zr-surface border border-zr-border rounded-lg p-4">
                    <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-widest mb-2">
                      Práctica
                    </p>
                    <p className="text-3xl font-bold text-zr-blue-mid">
                      {grade.practice !== null ? grade.practice : '—'}
                    </p>
                  </div>

                  <div className="bg-zr-surface border border-zr-border rounded-lg p-4">
                    <p className="text-xs text-zr-text-muted font-semibold uppercase tracking-widest mb-2">
                      Participación
                    </p>
                    <p className="text-3xl font-bold text-zr-blue-light">
                      {grade.participation !== null ? grade.participation : '—'}
                    </p>
                  </div>
                </div>

                {/* Final Grade */}
                {grade.finalScore !== null && (
                  <div className="bg-gradient-to-r from-zr-blue-deep via-zr-blue to-zr-blue-mid rounded-lg p-5 space-y-2">
                    <p className="text-xs text-white/60 font-bold uppercase tracking-widest">
                      Calificación Final
                    </p>
                    <div className="flex justify-between items-center">
                      <p className="text-4xl font-bold text-white">{grade.finalScore}</p>
                      <div className="text-right">
                        <p className="text-sm text-white/80">
                          {grade.finalScore >= grade.passingScore ? '✓ Aprobado' : '✗ Reprobado'}
                        </p>
                        <p className="text-xs text-white/60 mt-1">
                          Mínimo requerido: {grade.passingScore}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
