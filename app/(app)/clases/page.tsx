'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Clase {
  id: string
  titulo: string
  fecha: string
  modulo: string
  estado: 'proxima' | 'completada' | 'cancelada'
}

export default function Clases() {
  const router = useRouter()
  const supabase = createClient()
  const [clases, setClases] = useState<Clase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClases() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Mock data for now
      setClases([
        {
          id: '1',
          titulo: 'Introducción a Electricidad Automotriz',
          fecha: 'Sábado, 9 de Agosto',
          modulo: 'Módulo 3 · Semana 1',
          estado: 'proxima',
        },
        {
          id: '2',
          titulo: 'Diagnóstico de Batería',
          fecha: 'Sábado, 16 de Agosto',
          modulo: 'Módulo 3 · Semana 2',
          estado: 'proxima',
        },
        {
          id: '3',
          titulo: 'Sistemas de Carga',
          fecha: 'Sábado, 23 de Agosto',
          modulo: 'Módulo 3 · Semana 3',
          estado: 'proxima',
        },
      ])

      setLoading(false)
    }

    loadClases()
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
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">Mis Clases</h1>
            <p className="text-sm text-zr-text-muted font-medium">{clases.length} sesiones programadas</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Classes Section */}
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">01 — PRÓXIMAS</span>
            </div>

            <div className="space-y-3">
              {clases.map((clase, idx) => (
                <div
                  key={clase.id}
                  className="group bg-zr-surface border border-zr-border rounded-lg p-5 hover:border-zr-blue/50 transition-all duration-300 cursor-pointer hover:shadow-md hover:translate-y-[-2px] animate-fade-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                  onClick={() => {}}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-zr-text group-hover:text-zr-blue transition-colors">
                        {clase.titulo}
                      </h3>
                      <p className="text-xs text-zr-text-muted mt-2">{clase.fecha}</p>
                      <p className="text-xs text-zr-blue-mid font-medium mt-1">{clase.modulo}</p>
                    </div>

                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-zr-blue/10 border border-zr-blue/30">
                        <span className="text-xs font-semibold text-zr-blue">Próxima</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-5 space-y-2">
            <p className="text-sm font-semibold text-zr-text">💡 Tip</p>
            <p className="text-sm text-zr-text-muted">
              Prepárate con el material de estudio disponible en la sección de Material. Revisa los temas a tratar cada semana.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
