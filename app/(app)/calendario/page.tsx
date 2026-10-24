'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Aula Virtual — calendario de unidades, exámenes y tareas del módulo del
 * estudiante. Se alimenta solo (migración 179); aquí solo se lee y se
 * ofrece exportar a .ics vía fn_calendar_ical.
 */

interface Evento {
  id: string
  source_type: 'unit_open' | 'unit_close' | 'exam' | 'assignment'
  title: string
  event_at: string
}

const ETIQUETA_TIPO: Record<Evento['source_type'], { texto: string; tono: 'exito' | 'neutro' | 'aviso' | 'info' }> = {
  unit_open: { texto: 'Se abre', tono: 'exito' },
  unit_close: { texto: 'Se cierra', tono: 'neutro' },
  exam: { texto: 'Examen', tono: 'aviso' },
  assignment: { texto: 'Tarea', tono: 'info' },
}

export default function Calendario() {
  const router = useRouter()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [cargando, setCargando] = useState(true)
  const [userId, setUserId] = useState('')
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('calendar_events')
        .select('id, source_type, title, event_at')
        .order('event_at', { ascending: true })

      setEventos((data ?? []) as Evento[])
      setCargando(false)
    }
    cargar()
  }, [router])

  async function exportarICal() {
    setExportando(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('fn_calendar_ical', { p_student_id: userId })
    if (data) {
      const blob = new Blob([data], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'zr-mecademy.ics'
      a.click()
      URL.revokeObjectURL(url)
    }
    setExportando(false)
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  // Agrupados por fecha para que se lea como agenda, no como tabla suelta.
  const porFecha = new Map<string, Evento[]>()
  for (const e of eventos) {
    const dia = new Date(e.event_at).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
    porFecha.set(dia, [...(porFecha.get(dia) ?? []), e])
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Aula Virtual"
          titulo="Calendario"
          descripcion="Fechas de apertura, cierre, exámenes y tareas de tu módulo."
          accion={
            <button
              onClick={exportarICal}
              disabled={exportando}
              className="rounded-lg border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text disabled:opacity-50"
            >
              {exportando ? 'Generando…' : 'Agregar a mi calendario'}
            </button>
          }
        />

        <Regla delay={60} />

        <Seccion numero={1} titulo="Próximas fechas" delay={100}>
          {eventos.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Todavía no hay fechas programadas.</p>
          ) : (
            <div className="space-y-6">
              {Array.from(porFecha.entries()).map(([dia, lista]) => (
                <div key={dia}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zr-text-muted">{dia}</p>
                  <div className="space-y-2">
                    {lista.map((e) => {
                      const et = ETIQUETA_TIPO[e.source_type]
                      return (
                        <div key={e.id} className="zr-card flex items-center justify-between gap-3 p-4">
                          <p className="truncate text-sm font-semibold text-zr-text">{e.title}</p>
                          <Etiqueta tono={et.tono}>{et.texto}</Etiqueta>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
