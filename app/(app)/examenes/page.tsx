'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Examen {
  id: string
  titulo: string
  fecha: string
  estado: 'disponible' | 'completado' | 'no-disponible'
  puntuacion?: number
  maxima: number
}

export default function Examenes() {
  const router = useRouter()
  const supabase = createClient()
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadExamenes() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Mock data
      setExamenes([
        {
          id: '1',
          titulo: 'Evaluación 1 - Electricidad Automotriz',
          fecha: 'Disponible ahora',
          estado: 'disponible',
          maxima: 20,
        },
        {
          id: '2',
          titulo: 'Evaluación 2 - Diagnóstico de Sistemas',
          fecha: '16 de Agosto',
          estado: 'no-disponible',
          maxima: 20,
        },
        {
          id: '3',
          titulo: 'Evaluación 3 - Práctico Integral',
          fecha: '23 de Agosto',
          estado: 'no-disponible',
          maxima: 20,
        },
      ])

      setLoading(false)
    }

    loadExamenes()
  }, [])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="h-12" />

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-6 animate-fade-in">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">Mis Exámenes</h1>
            <p className="text-sm text-zr-text-muted font-medium">{examenes.length} evaluaciones</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Exams Section */}
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">01 — EVALUACIONES</span>
            </div>

            <div className="space-y-3">
              {examenes.map((examen, idx) => (
                <button
                  key={examen.id}
                  onClick={() => examen.estado === 'disponible' && alert('Examen abierto')}
                  className={`w-full group text-left transition-all duration-300 animate-fade-in ${
                    examen.estado === 'disponible' ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                  disabled={examen.estado !== 'disponible'}
                >
                  <div className={`bg-zr-surface border border-zr-border rounded-lg p-5 transition-all ${
                    examen.estado === 'disponible'
                      ? 'hover:border-zr-blue/50 group-hover:shadow-md group-hover:translate-y-[-2px]'
                      : 'opacity-60'
                  }`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-zr-text group-hover:text-zr-blue transition-colors">
                          {examen.titulo}
                        </h3>
                        <p className="text-xs text-zr-text-muted mt-2">{examen.fecha}</p>
                      </div>

                      <div className="flex-shrink-0">
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full border font-semibold text-xs ${
                            examen.estado === 'disponible'
                              ? 'bg-zr-blue/10 border-zr-blue/30 text-zr-blue'
                              : examen.estado === 'completado'
                              ? 'bg-zr-success/10 border-zr-success/30 text-zr-success'
                              : 'bg-zr-text-muted/10 border-zr-text-muted/30 text-zr-text-muted'
                          }`}
                        >
                          {examen.estado === 'disponible' && '✓ Disponible'}
                          {examen.estado === 'completado' && '✓ Completado'}
                          {examen.estado === 'no-disponible' && '○ Próximo'}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-5 space-y-2">
            <p className="text-sm font-semibold text-zr-text">📝 Recuerda</p>
            <p className="text-sm text-zr-text-muted">
              Las evaluaciones son parte integral de tu formación. Planifica tu tiempo y consulta el material de apoyo antes de cada examen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
