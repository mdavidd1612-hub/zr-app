'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cargarAgenda, type ItemAgenda, type TipoAgenda } from '@/lib/agenda'
import { descargarVariosICS, rangoDeHora } from '@/lib/ics'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoChevron, IconoCalendario, IconoCerrar } from '@/components/ui/Iconos'

/**
 * Calendario completo (estudiante y profesor). Cuadrícula de mes como un
 * calendario normal: cada día muestra sus eventos (puntos en el teléfono,
 * etiquetas en pantallas anchas). Al tocar un día se abre una pantalla con todo
 * el detalle (clase, módulo, profesor, hora, salón) y, abajo, "Agregar a tu
 * calendario". Los datos vienen de `lib/agenda.ts`.
 */

const NOMBRE_TIPO: Record<TipoAgenda, string> = {
  clase: 'Clase',
  unit_open: 'Se abre una unidad',
  unit_close: 'Se cierra una unidad',
  exam: 'Examen',
  assignment: 'Tarea',
}

const COLOR: Record<TipoAgenda, { punto: string; chip: string }> = {
  clase: { punto: 'bg-zr-blue-mid', chip: 'bg-zr-blue-mid/20 text-zr-blue-mid' },
  unit_open: { punto: 'bg-zr-success', chip: 'bg-zr-success/20 text-zr-success' },
  unit_close: { punto: 'bg-zr-text-muted', chip: 'bg-zr-surface text-zr-text-muted' },
  exam: { punto: 'bg-zr-warning', chip: 'bg-zr-warning/20 text-zr-warning' },
  assignment: { punto: 'bg-zr-blue', chip: 'bg-zr-blue/20 text-zr-blue' },
}

const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function horaDe(e: ItemAgenda): string | null {
  if (e.tipo === 'clase') return e.clase?.hora ?? null
  return new Date(e.fecha).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })
}

function paraCalendario(e: ItemAgenda) {
  const { inicio, fin } = e.tipo === 'clase' ? rangoDeHora(e.fecha, e.clase?.hora) : { inicio: new Date(e.fecha), fin: undefined }
  const partes = e.clase
    ? [e.clase.modulo && `Módulo: ${e.clase.modulo}`, e.clase.profesor && `Profesor: ${e.clase.profesor}`, e.clase.salon ? `Salón: ${e.clase.salon}` : null]
    : [e.detalle]
  return { titulo: e.titulo, descripcion: partes.filter(Boolean).join('\n'), inicio, fin }
}

function PantallaDia({ dia, items, alCerrar, alAbrir }: { dia: string; items: ItemAgenda[]; alCerrar: () => void; alAbrir: (href: string) => void }) {
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar() }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [alCerrar])

  const titulo = new Date(`${dia}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-zr-bg" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Calendario</p>
          <h2 className="zr-display text-xl capitalize text-zr-text">{titulo}</h2>
        </div>
        <button onClick={alCerrar} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-surface text-zr-text-muted">
          <IconoCerrar size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zr-text-muted">No hay nada programado este día.</p>
        ) : (
          items.map((e) => (
            <div key={e.id} className="zr-card space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR[e.tipo].punto}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">{NOMBRE_TIPO[e.tipo]}</span>
              </div>
              <p className="text-base font-bold text-zr-text">{e.titulo}</p>
              {e.clase ? (
                <dl className="space-y-2 text-sm">
                  {[
                    ['Hora', e.clase.hora],
                    ['Módulo', e.clase.modulo],
                    ['Profesor', e.clase.profesor ?? 'Por asignar'],
                    ['Salón', e.clase.salon ?? 'Por confirmar'],
                    ['Cohorte', e.clase.cohorte],
                  ].map(([k, v]) => v ? (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-zr-text-muted">{k}</dt>
                      <dd className="text-right font-semibold text-zr-text">{v}</dd>
                    </div>
                  ) : null)}
                </dl>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zr-text-muted">Hora</dt>
                    <dd className="font-semibold text-zr-text">{horaDe(e)}</dd>
                  </div>
                  {e.detalle && <p className="text-zr-text-muted">{e.detalle}</p>}
                </dl>
              )}
              {e.href && (
                <button onClick={() => alAbrir(e.href!)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-zr-blue">
                  Abrir <IconoChevron size={14} className="-rotate-90" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t border-zr-border bg-zr-bg px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            onClick={() => descargarVariosICS(items.map(paraCalendario), 'zr-mecademy.ics')}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zr-blue text-base font-bold text-white"
          >
            <IconoCalendario size={18} /> Agregar a tu calendario
          </button>
        </div>
      )}
    </div>
  )
}

export function VistaCalendario({ modo }: { modo: 'estudiante' | 'profesor' }) {
  const router = useRouter()
  const [items, setItems] = useState<ItemAgenda[]>([])
  const [cargando, setCargando] = useState(true)
  const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const agenda = await cargarAgenda(supabase)
      setItems(agenda.items)
      setCargando(false)
    }
    cargar()
  }, [router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  const porDia = new Map<string, ItemAgenda[]>()
  for (const e of items) {
    const k = clave(new Date(e.fecha))
    porDia.set(k, [...(porDia.get(k) ?? []), e])
  }

  const huecos = (new Date(mes.getFullYear(), mes.getMonth(), 1).getDay() + 6) % 7
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas: (Date | null)[] = [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ]
  const hoy = clave(new Date())

  return (
    <div className="min-h-dvh bg-zr-bg px-3 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))] sm:px-5">
      <div className="space-y-5">
        <div className="px-2 sm:px-0">
          <BotonVolver href={modo === 'profesor' ? '/hoy' : '/'} />
        </div>

        <div className="px-2 sm:px-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">{modo === 'profesor' ? 'Profesor' : 'Aula Virtual'}</p>
          <h1 className="zr-display text-3xl text-zr-text">Calendario</h1>
          <p className="mt-1 text-sm text-zr-text-muted">
            {modo === 'profesor'
              ? 'Tus clases y las fechas de tus módulos. Toca un día para ver el detalle.'
              : 'Tus clases, exámenes y tareas. Toca un día para ver el detalle.'}
          </p>
        </div>

        <div className="zr-card p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior" className="flex h-11 w-11 items-center justify-center rounded-xl bg-zr-surface text-zr-text">
              <IconoChevron size={18} className="rotate-90" />
            </button>
            <div className="text-center">
              <p className="text-base font-bold capitalize text-zr-text">{mes.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}</p>
              <button onClick={() => { const h = new Date(); setMes(new Date(h.getFullYear(), h.getMonth(), 1)) }} className="text-xs font-bold text-zr-blue">Hoy</button>
            </div>
            <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente" className="flex h-11 w-11 items-center justify-center rounded-xl bg-zr-surface text-zr-text">
              <IconoChevron size={18} className="-rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-zr-border/60">
            {DIAS.map((d) => (
              <div key={d} className="border-b border-r border-zr-border/60 py-1.5 text-center text-[11px] font-bold uppercase text-zr-text-muted">{d}</div>
            ))}
            {celdas.map((d, i) => {
              if (!d) return <div key={i} className="min-h-16 border-b border-r border-zr-border/60 bg-zr-surface/20 sm:min-h-28" />
              const k = clave(d)
              const lista = porDia.get(k) ?? []
              const esHoy = k === hoy
              return (
                <button
                  key={i}
                  onClick={() => setAbierto(k)}
                  className="flex min-h-16 flex-col items-stretch gap-1 border-b border-r border-zr-border/60 p-1 text-left transition-colors hover:bg-zr-surface/50 sm:min-h-28 sm:p-1.5"
                >
                  <span className={`flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-bold ${esHoy ? 'bg-zr-blue text-white' : 'text-zr-text'}`}>
                    {d.getDate()}
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {lista.slice(0, 2).map((e) => (
                      <span key={e.id} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${COLOR[e.tipo].chip}`}>
                        {e.tipo === 'clase' ? 'Clase' : e.titulo}
                      </span>
                    ))}
                    {lista.length > 2 && <span className="px-1 text-[11px] font-semibold text-zr-text-muted">+{lista.length - 2} más</span>}
                  </span>
                  <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {lista.slice(0, 4).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${COLOR[e.tipo].punto}`} />)}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {(['clase', 'exam', 'assignment', 'unit_open'] as TipoAgenda[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-zr-text-muted">
                <span className={`h-2 w-2 rounded-full ${COLOR[t].punto}`} />{NOMBRE_TIPO[t]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {abierto && (
        <PantallaDia
          dia={abierto}
          items={porDia.get(abierto) ?? []}
          alCerrar={() => setAbierto(null)}
          alAbrir={(href) => router.push(href)}
        />
      )}
    </div>
  )
}
