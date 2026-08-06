'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'

interface StudentGrade {
  studentId: string
  studentName: string
  cedula: string
  theory: number
  practice: number
  participation: number
  finalScore: number
  status: 'aprobado' | 'reprobado' | 'pendiente'
}

export default function CohortGrades() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string
  const supabase = createClient()

  const [students, setStudents] = useState<StudentGrade[]>([])
  const [participationWeight, setParticipationWeight] = useState(15)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const minParticipation = 5
  const maxParticipation = 30

  useEffect(() => {
    async function loadGrades() {
      // Mock data
      setStudents([
        {
          studentId: '1',
          studentName: 'Juan Carlos Pérez',
          cedula: 'V-30000001',
          theory: 16,
          practice: 15,
          participation: 9,
          finalScore: 13.4,
          status: 'aprobado',
        },
        {
          studentId: '2',
          studentName: 'María García López',
          cedula: 'V-30000002',
          theory: 14,
          practice: 12,
          participation: 8,
          finalScore: 11.6,
          status: 'aprobado',
        },
        {
          studentId: '3',
          studentName: 'Carlos Rodríguez',
          cedula: 'V-30000003',
          theory: 9,
          practice: 8,
          participation: 6,
          finalScore: 7.8,
          status: 'reprobado',
        },
      ])

      setLoading(false)
    }

    loadGrades()
  }, [cohortId])

  function handleUpdateScore(studentId: string, field: 'theory' | 'practice' | 'participation', value: number) {
    setStudents(
      students.map((s) => {
        if (s.studentId === studentId) {
          const updated = { ...s, [field]: Math.max(0, value) }
          // Recalculate final score
          updated.finalScore =
            updated.theory * 0.35 + updated.practice * 0.5 + updated.participation * (participationWeight / 100)
          updated.status = updated.finalScore >= 10 ? 'aprobado' : 'reprobado'
          return updated
        }
        return s
      })
    )
  }

  async function handleSaveGrades() {
    setSaving(true)

    // In a real app, this would save to the database
    // For now, just show a confirmation
    alert('Calificaciones guardadas correctamente')

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando calificaciones...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-x-auto overflow-y-auto px-5 pt-14 pb-8">
        <div className="space-y-8">
          <BotonVolver href="/sesiones" />

          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-zr-text">Registro de Calificaciones</h1>

            {/* Participation Weight Control */}
            <div className="bg-zr-surface border border-zr-border rounded-lg p-5 max-w-md">
              <label className="block text-sm font-semibold text-zr-text mb-3">
                Peso de Participación: {participationWeight}%
              </label>
              <input
                type="range"
                min={minParticipation}
                max={maxParticipation}
                value={participationWeight}
                onChange={(e) => setParticipationWeight(parseInt(e.target.value))}
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-zr-text-muted mt-2">
                Mínimo {minParticipation}% • Máximo {maxParticipation}%
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Grades Table */}
          <div className="min-w-full">
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.studentId}
                  className="bg-zr-surface border border-zr-border rounded-lg p-5 space-y-4"
                >
                  {/* Student Header */}
                  <div>
                    <h3 className="text-base font-semibold text-zr-text">{student.studentName}</h3>
                    <p className="text-xs text-zr-text-muted">{student.cedula}</p>
                  </div>

                  {/* Grade Inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zr-text-muted uppercase mb-2">
                        Teoría (35%)
                      </label>
                      <input
                        type="number"
                        value={student.theory}
                        onChange={(e) =>
                          handleUpdateScore(student.studentId, 'theory', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        max="20"
                        className="w-full px-3 py-2 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none text-center font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zr-text-muted uppercase mb-2">
                        Práctica (50%)
                      </label>
                      <input
                        type="number"
                        value={student.practice}
                        onChange={(e) =>
                          handleUpdateScore(student.studentId, 'practice', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        max="20"
                        className="w-full px-3 py-2 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none text-center font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zr-text-muted uppercase mb-2">
                        Participación
                      </label>
                      <input
                        type="number"
                        value={student.participation}
                        onChange={(e) =>
                          handleUpdateScore(student.studentId, 'participation', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        max="20"
                        className="w-full px-3 py-2 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none text-center font-semibold"
                      />
                    </div>
                  </div>

                  {/* Final Score (Read-only) */}
                  <div className="border-t border-zr-border pt-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-zr-text-muted font-semibold uppercase">Nota Final</p>
                      <p className="text-2xl font-bold text-zr-blue mt-1">{student.finalScore.toFixed(1)}</p>
                    </div>

                    <div
                      className={`inline-flex items-center px-4 py-2 rounded-full border font-semibold text-sm ${
                        student.status === 'aprobado'
                          ? 'bg-zr-success/10 border-zr-success/30 text-zr-success'
                          : 'bg-zr-error/10 border-zr-error/30 text-zr-error'
                      }`}
                    >
                      {student.status === 'aprobado' ? '✓ Aprobado' : '✗ Reprobado'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 px-4 py-3 bg-zr-border text-zr-text rounded-lg font-semibold hover:bg-zr-border/80 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveGrades}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-zr-success text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-zr-success/90 transition-all"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
