'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'

type EstadoSesion = 'programada' | 'abierta' | 'cerrada' | 'reprogramada' | 'cancelada'

interface Sesion {
  id: string
  cohorteId: string
  fecha: string
  semana: number
  estado: EstadoSesion
  cohorte: string
  modulo: string
  presentes: number
}

const ESTADO: Record<EstadoSesion, { texto: string; tono: 'exito' | 'aviso' | 'error' | 'info' | 'neutro' }> = {
  programada:   { texto: 'Programada',   tono: 'info'   },
  abierta:      { texto: 'Abierta',      tono: 'exito'  },
  cerrada:      { texto: 'Cerrada',      tono: 'neutro' },
  reprogramada: { texto: 'Reprogramada', tono: 'aviso'  },
  cancelada:    { texto: 'Cancelada',    tono: 'error'  },
}

export default function Sesiones() {
  const router = useRouter()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('class_sessions')
        .select('id, cohort_id, session_date, week_number, status, cohorts(name), modules(name), attendance_events(id)')
        .eq('teacher_id', user.id)
        .order('session_date', { ascending: false })

      if (!vigente) return

      const filas = data as unknown as {
        id: string; cohort_id: string; session_date: string; week_number: number; status: EstadoSesion
        cohorts: { name: string } | null
        modules: { name: string } | null
        attendance_events: { id: string }[] | null
      }[] | null

      setSesiones(
        (filas ?? []).map((s) => ({
          id: s.id,
          cohorteId: s.cohort_id,
          fecha: s.session_date,
          semana: s.week_number,
          estado: s.status,
          cohorte: s.cohorts?.name ?? 'Cohorte',
          modulo: s.modules?.name ?? 'Módulo',
          presentes: s.attendance_events?.length ?? 0,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function cambiarEstado(id: string, estado: 'abierta' | 'cerrada') {
    setOcupada(id)
    await createClient().from('class_sessions').update({ status: estado }).eq('id', id)
    setVersion((v) => v + 1)
    setOcupada(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando sesiones…</p>
      </div>
    )
  }

  const hoy = new Date().toISOString().split('T')[0]
  const proximas = sesiones.filter((s) => s.fecha >= hoy)
  const pasadas = sesiones.filter((s) => s.fecha < hoy)

  const fechaLarga = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

  const Tarjeta = ({ s }: { s: Sesion }) => (
    <div className="zr-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-zr-text">{fechaLarga(s.fecha)}</p>
            <p className="mt-1.5 truncate text-sm text-zr-text-muted">{s.cohorte}</p>
            <p className="mt-0.5 text-sm text-zr-text-muted">
              Semana {s.semana} · {s.modulo}
            </p>
          </div>
          <Etiqueta tono={ESTADO[s.estado].tono}>{ESTADO[s.estado].texto}</Etiqueta>
        </div>

        {s.presentes > 0 && (
          <p className="mt-4 text-sm text-zr-text-muted">
            <span className="zr-metric text-lg text-zr-success">{s.presentes}</span> asistencias
            registradas
          </p>
        )}
      </div>

      {/* Una sesión cancelada o reprogramada no tiene acción: se arregla desde
          administración, no aquí. */}
      {(s.estado === 'programada' || s.estado === 'abierta' || s.estado === 'cerrada') && (
        <div className="flex flex-col gap-2 border-t border-zr-border bg-zr-bg/40 p-4">
          {s.estado === 'programada' && (
            <button
              onClick={() => cambiarEstado(s.id, 'abierta')}
              disabled={ocupada === s.id}
              className="min-h-14 w-full rounded-lg bg-zr-blue px-4 text-base font-bold text-white transition-colors active:bg-zr-blue-deep disabled:opacity-50"
            >
              {ocupada === s.id ? 'Abriendo…' : 'Abrir clase'}
            </button>
          )}

          {s.estado === 'abierta' && (
            <>
              <button
                onClick={() => router.push(`/escanear/${s.id}`)}
                className="min-h-14 w-full rounded-lg bg-zr-blue px-4 text-base font-bold text-white transition-colors active:bg-zr-blue-deep"
              >
                Pasar asistencia
              </button>
              <button
                onClick={() => cambiarEstado(s.id, 'cerrada')}
                disabled={ocupada === s.id}
                className="min-h-14 w-full rounded-lg border border-zr-border px-4 text-base font-semibold text-zr-text disabled:opacity-50"
              >
                {ocupada === s.id ? 'Cerrando…' : 'Cerrar clase'}
              </button>
            </>
          )}

          {/* Se marca dominio después de la práctica: tiene sentido tanto en
              una clase que sigue abierta como en una ya cerrada. */}
          {(s.estado === 'abierta' || s.estado === 'cerrada') && (
            <button
              onClick={() => router.push(`/dominio/${s.cohorteId}`)}
              className="min-h-14 w-full rounded-lg border border-zr-border px-4 text-base font-semibold text-zr-text disabled:opacity-50"
            >
              Marcar dominio
            </button>
          )}

          {s.estado === 'cerrada' && (
            <button
              onClick={() => router.push(`/feedback-clase/${s.id}`)}
              className="min-h-14 w-full rounded-lg border border-zr-border px-4 text-base font-semibold text-zr-text disabled:opacity-50"
            >
              Ver feedback
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-11 px-5 pt-14">
      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Docencia
        </p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">Mis sesiones</h1>
        <p className="mt-3 text-base text-zr-text-muted">
          Abrir la clase es lo que habilita el escaneo de asistencia.
        </p>
      </header>

      <Regla delay={60} />

      {sesiones.length === 0 && (
        <div className="zr-card animate-rise p-8" style={{ animationDelay: '120ms' }}>
          <p className="text-base font-semibold text-zr-text">No tienes sesiones</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Administración programa las sesiones de cada cohorte. Habla con ellos si falta
            algún sábado.
          </p>
        </div>
      )}

      {proximas.length > 0 && (
        <Seccion numero={1} titulo="Próximas" delay={120}>
          <div className="space-y-3">
            {proximas.map((s) => <Tarjeta key={s.id} s={s} />)}
          </div>
        </Seccion>
      )}

      {pasadas.length > 0 && (
        <Seccion
          numero={proximas.length > 0 ? 2 : 1}
          titulo="Anteriores"
          delay={proximas.length > 0 ? 220 : 120}
        >
          <div className="space-y-3">
            {pasadas.map((s) => <Tarjeta key={s.id} s={s} />)}
          </div>
        </Seccion>
      )}
    </div>
  )
}
