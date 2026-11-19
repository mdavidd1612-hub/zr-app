'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarAgenda, type ItemAgenda, type TipoAgenda } from '@/lib/agenda'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoChevron, IconoCalendario } from '@/components/ui/Iconos'

/**
 * Aula Virtual — calendario del estudiante: clases del sábado con su salón
 * (migración 216), aperturas, exámenes y tareas del módulo. Dos vistas (18-nov-2026):
 * "Mes", un calendario normal para ver todo de un vistazo, y "Lista", la agenda
 * por fecha. Los datos vienen de `lib/agenda.ts`, la misma fuente del calendario
 * flotante. La exportación a .ics sigue siendo fn_calendar_ical.
 */

const ETIQUETA_TIPO: Record<TipoAgenda, { texto: string; tono: 'exito' | 'neutro' | 'aviso' | 'info' }> = {
  clase: { texto: 'Clase', tono: 'info' },
  unit_open: { texto: 'Se abre', tono: 'exito' },
  unit_close: { texto: 'Se cierra', tono: 'neutro' },
  exam: { texto: 'Examen', tono: 'aviso' },
  assignment: { texto: 'Tarea', tono: 'info' },
}

const PUNTO_TIPO: Record<TipoAgenda, string> = {
  clase: 'bg-zr-blue-mid',
  unit_open: 'bg-zr-success',
  unit_close: 'bg-zr-text-muted',
  exam: 'bg-zr-warning',
  assignment: 'bg-zr-blue',
}

const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function Calendario() {
  const router = useRouter()
  const [items, setItems] = useState<ItemAgenda[]>([])
  const [cargando, setCargando] = useState(true)
  const [userId, setUserId] = useState('')
  const [exportando, setExportando] = useState(false)
  const [vista, setVista] = useState<'mes' | 'lista'>('mes')
  const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [dia, setDia] = useState(() => clave(new Date()))

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)
      const agenda = await cargarAgenda(supabase)
      setItems(agenda.items)
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

  const porDia = new Map<string, ItemAgenda[]>()
  for (const e of items) {
    const k = clave(new Date(e.fecha))
    porDia.set(k, [...(porDia.get(k) ?? []), e])
  }

  function Fila({ e }: { e: ItemAgenda }) {
    const et = ETIQUETA_TIPO[e.tipo]
    const contenido = (
      <>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_TIPO[e.tipo]}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zr-text">{e.titulo}</span>
          {e.detalle && <span className="block truncate text-xs text-zr-text-muted">{e.detalle}</span>}
        </span>
        <Etiqueta tono={et.tono}>{et.texto}</Etiqueta>
        {e.href && <IconoChevron size={16} className="shrink-0 -rotate-90 text-zr-text-muted" />}
      </>
    )
    return e.href ? (
      <button
        onClick={() => router.push(e.href!)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-zr-surface/60"
      >
        {contenido}
      </button>
    ) : (
      <div className="flex items-center gap-3 py-3">{contenido}</div>
    )
  }

  // Cuadrícula del mes (semana empieza en lunes)
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const huecos = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas: (Date | null)[] = [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ]
  const hoy = clave(new Date())
  const delDia = porDia.get(dia) ?? []

  const porFecha = new Map<string, ItemAgenda[]>()
  for (const e of items) {
    const f = new Date(e.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
    porFecha.set(f, [...(porFecha.get(f) ?? []), e])
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-8">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Aula Virtual"
          titulo="Calendario"
          descripcion="Tus clases con su salón, exámenes, tareas y fechas del módulo."
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

        <div className="flex gap-2 rounded-full bg-zr-surface p-1">
          {(['mes', 'lista'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`min-h-11 flex-1 rounded-full text-sm font-bold transition-colors ${vista === v ? 'bg-zr-blue text-white' : 'text-zr-text-muted'}`}
            >
              {v === 'mes' ? 'Mes' : 'Lista'}
            </button>
          ))}
        </div>

        <Regla delay={60} />

        {vista === 'mes' ? (
          <Seccion numero={1} titulo="Mes" delay={100}>
            <div className="zr-card space-y-4 p-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior" className="flex h-11 w-11 items-center justify-center rounded-xl bg-zr-surface text-zr-text">
                  <IconoChevron size={18} className="rotate-90" />
                </button>
                <p className="text-sm font-bold capitalize text-zr-text">{mes.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}</p>
                <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente" className="flex h-11 w-11 items-center justify-center rounded-xl bg-zr-surface text-zr-text">
                  <IconoChevron size={18} className="-rotate-90" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {DIAS.map((d, i) => <span key={i} className="text-[11px] font-bold text-zr-text-muted">{d}</span>)}
                {celdas.map((d, i) => {
                  if (!d) return <span key={i} />
                  const k = clave(d)
                  const lista = porDia.get(k) ?? []
                  const sel = k === dia
                  return (
                    <button
                      key={i}
                      onClick={() => setDia(k)}
                      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-colors ${
                        sel ? 'bg-zr-blue text-white' : k === hoy ? 'bg-zr-surface text-zr-blue-mid' : 'text-zr-text'
                      }`}
                    >
                      {d.getDate()}
                      <span className="flex h-1.5 gap-0.5">
                        {Array.from(new Set(lista.map((e) => e.tipo))).slice(0, 3).map((t) => (
                          <span key={t} className={`h-1.5 w-1.5 rounded-full ${sel ? 'bg-white' : PUNTO_TIPO[t]}`} />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zr-blue-mid">
                {new Date(`${dia}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {delDia.length === 0 ? (
                <p className="py-3 text-sm text-zr-text-muted">No hay nada este día.</p>
              ) : (
                <div className="divide-y divide-zr-border/60">{delDia.map((e) => <Fila key={e.id} e={e} />)}</div>
              )}
            </div>
          </Seccion>
        ) : (
          <Seccion numero={1} titulo="Próximas fechas" delay={100}>
            {items.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Todavía no hay fechas programadas.</p>
            ) : (
              <div className="space-y-7">
                {Array.from(porFecha.entries()).map(([f, lista]) => (
                  <div key={f}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zr-blue-mid">{f.charAt(0).toUpperCase() + f.slice(1)}</p>
                    <div className="divide-y divide-zr-border/60">{lista.map((e) => <Fila key={e.id} e={e} />)}</div>
                  </div>
                ))}
              </div>
            )}
          </Seccion>
        )}
      </div>
    </div>
  )
}
