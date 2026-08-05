'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Boton } from '@/components/ui/Boton'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { Cargando } from '@/components/ui/Cargando'

interface Sesion {
  id: string
  cohort_name: string
  module_name: string
  session_date: string
  status: 'abierta' | 'cerrada' | 'pendiente'
  attendanceCount?: number
  enrollmentCount?: number
}

export default function Hoy() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        // Obtener sesiones de hoy para el profesor actual
        const hoy = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('class_sessions')
          .select(
            `
            id,
            cohort:cohort_id (name),
            module:module_id (name),
            session_date,
            status
          `
          )
          .gte('session_date', hoy)
          .lte('session_date', `${hoy}T23:59:59`)
          .order('session_date', { ascending: true })

        if (error) throw error

        const sesionesFormateadas = (data || []).map((s: any) => ({
          id: s.id,
          cohort_name: s.cohort?.name || 'Cohorte desconocida',
          module_name: s.module?.name || 'Módulo desconocido',
          session_date: s.session_date,
          status: s.status || 'pendiente',
        }))

        setSesiones(sesionesFormateadas)
      } catch (err) {
        console.error('Error cargando sesiones:', err)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [supabase])

  if (cargando) return <Cargando texto="Cargando sesiones de hoy..." />

  if (sesiones.length === 0) {
    return (
      <EstadoVacio
        titulo="No tienes clase hoy"
        explicacion="Regresa mañana para ver tus sesiones programadas."
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zr-navy">Sesiones de hoy</h1>

      {sesiones.map((sesion) => (
        <Tarjeta key={sesion.id}>
          <div className="space-y-3">
            <div>
              <h2 className="font-bold text-zr-navy">{sesion.cohort_name}</h2>
              <p className="text-sm text-zr-text-muted">{sesion.module_name}</p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zr-text-muted">
                {new Date(sesion.session_date).toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  sesion.status === 'abierta'
                    ? 'bg-zr-success text-white'
                    : sesion.status === 'cerrada'
                      ? 'bg-zr-border text-zr-text-muted'
                      : 'bg-zr-warning text-zr-navy'
                }`}
              >
                {sesion.status === 'abierta'
                  ? 'Abierta'
                  : sesion.status === 'cerrada'
                    ? 'Cerrada'
                    : 'Pendiente'}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              {sesion.status === 'abierta' && (
                <>
                  <Link
                    href={`/escanear/${sesion.id}`}
                    className="flex-1"
                  >
                    <Boton variante="principal" anchoCompleto>
                      📱 Escanear
                    </Boton>
                  </Link>
                  <Link
                    href={`/sesiones/${sesion.id}`}
                    className="flex-1"
                  >
                    <Boton variante="secundario" anchoCompleto>
                      📋 Detalles
                    </Boton>
                  </Link>
                </>
              )}
              {sesion.status !== 'abierta' && (
                <Link
                  href={`/sesiones/${sesion.id}`}
                  className="w-full"
                >
                  <Boton variante="secundario" anchoCompleto>
                    Ver detalles
                  </Boton>
                </Link>
              )}
            </div>
          </div>
        </Tarjeta>
      ))}
    </div>
  )
}
