'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Boton } from '@/components/ui/Boton'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { Cargando } from '@/components/ui/Cargando'

/** Forma real que devuelve el select con relaciones anidadas. */
interface FilaSesion {
  id: string
  session_date: string
  week_number: number
  status: Sesion['status']
  modules: { name: string } | null
  cohorts: { name: string } | null
}

interface Sesion {
  id: string
  sessionDate: string
  weekNumber: number
  moduleName: string
  status: 'programada' | 'abierta' | 'cerrada' | 'reprogramada' | 'cancelada'
  cohortName: string
}

export default function Sesiones() {
  const [cargando, setCargando] = useState(true)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('class_sessions')
          .select(`
            id, session_date, week_number, status,
            cohorts(name),
            modules(name)
          `)
          .eq('teacher_id', user.id)
          .order('session_date', { ascending: false })

        if (data) {
          setSesiones(
            (data as unknown as FilaSesion[]).map((s) => ({
              id: s.id,
              sessionDate: new Date(s.session_date).toLocaleDateString('es-VE'),
              weekNumber: s.week_number,
              moduleName: s.modules?.name || 'Módulo',
              status: s.status,
              cohortName: s.cohorts?.name || 'Cohorte',
            }))
          )
        }

        setCargando(false)
      } catch (error) {
        console.error('Error cargando sesiones:', error)
        setCargando(false)
      }
    }

    cargar()
  }, [])

  const handleAbrir = async (sesionId: string) => {
    await supabase.from('class_sessions').update({ status: 'abierta' }).eq('id', sesionId)
    setSesiones(sesiones.map(s => s.id === sesionId ? { ...s, status: 'abierta' } : s))
  }

  const handleCerrar = async (sesionId: string) => {
    await supabase.from('class_sessions').update({ status: 'cerrada' }).eq('id', sesionId)
    setSesiones(sesiones.map(s => s.id === sesionId ? { ...s, status: 'cerrada' } : s))
  }

  if (cargando) return <Cargando texto="Cargando sesiones..." />

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zr-navy">📅 Mis sesiones</h1>
        <p className="text-sm text-zr-text-muted">Gestión de clases y asistencia</p>
      </header>

      {sesiones.length === 0 ? (
        <EstadoVacio
          titulo="No hay sesiones"
          explicacion="Contacta con administración para que asigne sesiones a tu cohorte."
          icono="📭"
        />
      ) : (
        <div className="space-y-3">
          {sesiones.map((sesion) => (
            <Tarjeta key={sesion.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-zr-navy">{sesion.cohortName}</h3>
                    <p className="text-sm text-zr-text-muted">
                      {sesion.sessionDate} · Semana {sesion.weekNumber}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    sesion.status === 'abierta'
                      ? 'bg-zr-success/20 text-zr-success'
                      : sesion.status === 'cerrada'
                      ? 'bg-zr-error/20 text-zr-error'
                      : 'bg-zr-border text-zr-text-muted'
                  }`}>
                    {sesion.status}
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {sesion.status === 'programada' && (
                    <Boton
                      onClick={() => handleAbrir(sesion.id)}
                      variante="principal"
                      tamano="normal"
                      className="text-sm"
                    >
                      Abrir clase
                    </Boton>
                  )}
                  {sesion.status === 'abierta' && (
                    <Boton
                      onClick={() => handleCerrar(sesion.id)}
                      variante="secundario"
                      tamano="normal"
                      className="text-sm"
                    >
                      Cerrar
                    </Boton>
                  )}
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  )
}
