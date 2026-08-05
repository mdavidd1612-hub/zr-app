'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Boton } from '@/components/ui/Boton'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Cargando } from '@/components/ui/Cargando'

interface Competencia {
  id: string
  name: string
  weekNumber: number
  status: 'dominado' | 'en_progreso' | 'no_iniciado'
  dominatedVia?: string
}

export default function Progreso() {
  const [cargando, setCargando] = useState(true)
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [moduleName, setModuleName] = useState('Módulo actual')
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Obtener competencias del estudiante
        const { data } = await supabase
          .from('v_mi_dominio')
          .select('*')
          .eq('student_id', user.id)

        if (data) {
          const grouped = data.map((c: any) => ({
            id: c.id,
            name: c.sub_competency_name,
            weekNumber: c.week_number,
            status: c.status || 'no_iniciado',
            dominatedVia: c.dominated_via,
          }))
          setCompetencias(grouped)

          // Obtener nombre del módulo
          const { data: moduleData } = await supabase
            .from('students')
            .select('cohorts(current_module_id), modules(name)')
            .eq('id', user.id)
            .single()

          if (moduleData?.modules) {
            setModuleName((moduleData.modules as any).name)
          }
        }

        setCargando(false)
      } catch (error) {
        console.error('Error cargando progreso:', error)
        setCargando(false)
      }
    }

    cargar()
  }, [])

  if (cargando) return <Cargando texto="Cargando tu progreso..." />

  const dominadas = competencias.filter(c => c.status === 'dominado').length
  const enProgreso = competencias.filter(c => c.status === 'en_progreso').length
  const noIniciadas = competencias.filter(c => c.status === 'no_iniciado').length

  const groupedByWeek = competencias.reduce((acc, c) => {
    const week = c.weekNumber
    if (!acc[week]) acc[week] = []
    acc[week].push(c)
    return acc
  }, {} as Record<number, Competencia[]>)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'dominado': return 'bg-zr-success/20 text-zr-success border-zr-success/30'
      case 'en_progreso': return 'bg-zr-blue-mid/20 text-zr-blue-mid border-zr-blue-mid/30'
      default: return 'bg-zr-border/20 text-zr-text-muted border-zr-border'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'dominado': return '✓'
      case 'en_progreso': return '◐'
      default: return '◯'
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-2">
        <Link href="/carnet">
          <Boton variante="texto" className="mb-4">
            ← Volver
          </Boton>
        </Link>
        <h1 className="text-3xl font-bold text-zr-navy">📊 Mi Progreso</h1>
        <p className="text-sm text-zr-text-muted">{moduleName}</p>
      </header>

      {/* Resumen */}
      <Tarjeta>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-3xl font-bold text-zr-success">{dominadas}</p>
            <p className="text-xs text-zr-text-muted mt-1">Dominadas</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-zr-blue-mid">{enProgreso}</p>
            <p className="text-xs text-zr-text-muted mt-1">En progreso</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-zr-text-muted">{noIniciadas}</p>
            <p className="text-xs text-zr-text-muted mt-1">Pendientes</p>
          </div>
        </div>
      </Tarjeta>

      {/* Por semana */}
      <div className="space-y-4">
        {Object.entries(groupedByWeek)
          .sort(([w1], [w2]) => parseInt(w1) - parseInt(w2))
          .map(([week, comps]) => (
            <div key={week} className="space-y-2">
              <h3 className="font-bold text-sm text-zr-text-muted px-1">SEMANA {week}</h3>
              <div className="space-y-2">
                {comps.map((comp) => (
                  <div key={comp.id} className={`glass rounded-xl p-4 border ${getStatusColor(comp.status)}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-1">{getStatusIcon(comp.status)}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{comp.name}</p>
                        {comp.dominatedVia && (
                          <p className="text-xs text-zr-text-muted mt-1">
                            Verificado en {comp.dominatedVia}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
