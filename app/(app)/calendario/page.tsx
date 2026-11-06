'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoChevron, IconoCalendario } from '@/components/ui/Iconos'

/**
 * Aula Virtual — calendario de unidades, exámenes y tareas del módulo del
 * estudiante. Se alimenta solo (migración 179); aquí solo se lee y se
 * ofrece exportar a .ics vía fn_calendar_ical.
 *
 * Bug real reportado por el coordinador (reunión 31-oct-2026): el evento se
 * veía pero no llevaba a ningún lado -- la consulta ni siquiera pedía
 * `source_id`, así que no había con qué armar el enlace. Ahora cada tarjeta
 * navega a su unidad/examen; si la unidad todavía no abrió, RLS la esconde y
 * el estudiante cae en "Todavía no hay unidades abiertas" -- no es un error,
 * es la misma regla de siempre explicada en vez de un enlace muerto.
 */

interface Evento {
  id: string
  source_type: 'unit_open' | 'unit_close' | 'exam' | 'assignment'
  source_id: string
  title: string
  event_at: string
}

const ETIQUETA_TIPO: Record<Evento['source_type'], { texto: string; tono: 'exito' | 'neutro' | 'aviso' | 'info' }> = {
  unit_open: { texto: 'Se abre', tono: 'exito' },
  unit_close: { texto: 'Se cierra', tono: 'neutro' },
  exam: { texto: 'Examen', tono: 'aviso' },
  assignment: { texto: 'Tarea', tono: 'info' },
}

// Punto de color por tipo: el mismo lenguaje de estado del resto del aula,
// para que la agenda se lea de un vistazo sin encerrar cada fecha en un cuadro.
const PUNTO_TIPO: Record<Evento['source_type'], string> = {
  unit_open: 'bg-zr-success',
  unit_close: 'bg-zr-text-muted',
  exam: 'bg-zr-warning',
  assignment: 'bg-zr-blue',
}

export default function Calendario() {
  const router = useRouter()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [cargando, setCargando] = useState(true)
  const [userId, setUserId] = useState('')
  const [exportando, setExportando] = useState(false)
  // Las tareas no tienen ruta propia -- se abren dentro de su unidad
  // (/unidades/[unitId]/tarea/[assignmentId]). assignment_id → unit_id.
  const [unidadDeTarea, setUnidadDeTarea] = useState<Record<string, string>>({})

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('calendar_events')
        .select('id, source_type, source_id, title, event_at')
        .order('event_at', { ascending: true })

      const filas = (data ?? []) as Evento[]
      setEventos(filas)

      const idsTareas = filas.filter((e) => e.source_type === 'assignment').map((e) => e.source_id)
      if (idsTareas.length > 0) {
        const { data: tareas } = await supabase.from('assignments').select('id, unit_id').in('id', idsTareas)
        setUnidadDeTarea(Object.fromEntries((tareas ?? []).map((t) => [t.id, t.unit_id])))
      }

      setCargando(false)
    }
    cargar()
  }, [router])

  function hrefDe(e: Evento): string | null {
    if (e.source_type === 'unit_open' || e.source_type === 'unit_close') return `/unidades/${e.source_id}`
    if (e.source_type === 'exam') return `/examenes/${e.source_id}`
    if (e.source_type === 'assignment') {
      const unitId = unidadDeTarea[e.source_id]
      return unitId ? `/unidades/${unitId}/tarea/${e.source_id}` : null
    }
    return null
  }

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
              className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40 disabled:opacity-50"
            >
              <IconoCalendario size={16} />
              {exportando ? 'Generando…' : 'Agregar a mi calendario'}
            </button>
          }
        />

        <Regla delay={60} />

        <Seccion numero={1} titulo="Próximas fechas" delay={100}>
          {eventos.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Todavía no hay fechas programadas.</p>
          ) : (
            <div className="space-y-7">
              {Array.from(porFecha.entries()).map(([dia, lista]) => (
                <div key={dia}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zr-blue-mid">
                    {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  </p>
                  <div className="divide-y divide-zr-border/60">
                    {lista.map((e) => {
                      const et = ETIQUETA_TIPO[e.source_type]
                      const href = hrefDe(e)
                      const contenido = (
                        <>
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_TIPO[e.source_type]}`} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zr-text">{e.title}</span>
                          <Etiqueta tono={et.tono}>{et.texto}</Etiqueta>
                          {href && <IconoChevron size={16} className="shrink-0 -rotate-90 text-zr-text-muted" />}
                        </>
                      )
                      return href ? (
                        <button
                          key={e.id}
                          onClick={() => router.push(href)}
                          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-zr-surface/60"
                        >
                          {contenido}
                        </button>
                      ) : (
                        <div key={e.id} className="flex items-center gap-3 px-0 py-3">
                          {contenido}
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
