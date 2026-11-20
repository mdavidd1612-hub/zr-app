'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { MoverClase } from '@/components/MoverClase'
import { PlanificacionCortes } from '@/components/PlanificacionCortes'

/**
 * Calendario general (parte 1, 20-nov-2026; propuesta en
 * docs/reportes/propuesta_calendario_general_2026-11-20.md).
 *
 * Todas las clases presenciales de los cortes activos de las sedes de quien
 * mira (super admin: todas; Dirección/Administración: las asignadas, o todas
 * si no tiene ninguna), en una semana por horas. Las arma la base
 * (`fn_calendario_general`, migración 233) a partir del calendario de módulos,
 * el horario del corte y las excepciones. Marca en rojo los choques de salón
 * o de profesor a la misma hora. Mover clases llega en la parte 2.
 *
 * Computadora: cuadrícula de 7 días × horas. Teléfono: la misma semana como
 * lista por día (7 columnas no caben en 375 px).
 */

interface Clase {
  cohort_id: string
  cohorte: string
  sede: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  module_id: string
  modulo: string
  modulo_orden: number
  profesores: string | null
  salon: string | null
  movida: boolean
  fecha_original: string | null
}

const COLORES = ['#3869B1', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04', '#4F46E5']
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deISO = (s: string) => new Date(`${s}T12:00:00`)
const minutos = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)
const hora12 = (t: string | null) => {
  if (!t) return '—'
  const h = Number(t.slice(0, 2)); const m = t.slice(3, 5)
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'a.m.' : 'p.m.'}`
}
function lunesDe(d: Date) {
  const x = new Date(d); x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export default function CalendarioGeneral() {
  const router = useRouter()
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [clases, setClases] = useState<Clase[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sede, setSede] = useState('')
  const [corte, setCorte] = useState('')
  const [abierta, setAbierta] = useState<Clase | null>(null)
  const [vista, setVista] = useState<'semana' | 'plan'>('semana')
  // Mover clases: solo Dirección Académica y super_admin (la base lo vuelve a revisar).
  const [puedeMover, setPuedeMover] = useState(false)
  // Arrastrar en computadora (parte 3): al soltar se abre "Mover" con destino puesto.
  const [arrastrada, setArrastrada] = useState<Clase | null>(null)
  const [sobreDia, setSobreDia] = useState<string | null>(null)
  const [propuesta, setPropuesta] = useState<{ nueva: string; ini: string; fin: string } | null>(null)
  const abrir = (c: Clase) => { setPropuesta(null); setAbierta(c) }
  const cerrar = () => { setPropuesta(null); setAbierta(null) }

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d
  }), [lunes])

  const cargar = useCallback(async () => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    setPuedeMover(perfil?.role === 'direccion_academica' || perfil?.role === 'super_admin')
    const { data, error: e } = await supabase.rpc('fn_calendario_general' as never, {
      p_desde: aISO(dias[0]), p_hasta: aISO(dias[6]),
    } as never) as { data: Clase[] | null; error: { message: string } | null }
    if (e) setError('No se pudo cargar el calendario. Vuelve a intentarlo.')
    setClases(data ?? [])
    setCargando(false)
  }, [dias, router])

  useEffect(() => { void cargar() }, [cargar])

  // Un color fijo por corte (por orden alfabético, para que no cambie entre semanas).
  const colorDe = useMemo(() => {
    const nombres = [...new Set(clases.map((c) => c.cohorte))].sort()
    return (n: string) => COLORES[nombres.indexOf(n) % COLORES.length]
  }, [clases])

  const sedes = useMemo(() => [...new Set(clases.map((c) => c.sede).filter(Boolean) as string[])].sort(), [clases])
  const cortes = useMemo(() => [...new Set(clases.filter((c) => !sede || c.sede === sede).map((c) => c.cohorte))].sort(), [clases, sede])
  const visibles = clases.filter((c) => (!sede || c.sede === sede) && (!corte || c.cohorte === corte))

  // Choques: mismo día, horas que se pisan y mismo salón o algún profesor en común.
  const choques = useMemo(() => {
    const malos = new Map<string, string[]>()
    const clave = (c: Clase) => `${c.cohort_id}|${c.fecha}`
    for (let i = 0; i < visibles.length; i++) {
      for (let j = i + 1; j < visibles.length; j++) {
        const a = visibles[i], b = visibles[j]
        if (a.fecha !== b.fecha) continue
        const ai = minutos(a.hora_inicio), af = minutos(a.hora_fin), bi = minutos(b.hora_inicio), bf = minutos(b.hora_fin)
        if (ai == null || af == null || bi == null || bf == null || !(ai < bf && bi < af)) continue
        const motivos: string[] = []
        if (a.salon && a.salon === b.salon) motivos.push(`mismo salón (${a.salon})`)
        const pa = (a.profesores ?? '').split(', ').filter(Boolean)
        const comun = (b.profesores ?? '').split(', ').filter((p) => pa.includes(p))
        if (comun.length) motivos.push(`mismo profesor (${comun.join(', ')})`)
        if (motivos.length) {
          malos.set(clave(a), [...(malos.get(clave(a)) ?? []), `${b.cohorte}: ${motivos.join(' y ')}`])
          malos.set(clave(b), [...(malos.get(clave(b)) ?? []), `${a.cohorte}: ${motivos.join(' y ')}`])
        }
      }
    }
    return malos
  }, [visibles])
  const choqueDe = (c: Clase) => choques.get(`${c.cohort_id}|${c.fecha}`)

  // Rango de horas de la cuadrícula: de la clase más temprana a la más tardía.
  const inicios = visibles.map((c) => minutos(c.hora_inicio)).filter((x): x is number => x != null)
  const fines = visibles.map((c) => minutos(c.hora_fin)).filter((x): x is number => x != null)
  const hDesde = Math.max(0, Math.floor((inicios.length ? Math.min(...inicios) : 8 * 60) / 60) - 1)
  const hHasta = Math.min(24, Math.ceil((fines.length ? Math.max(...fines) : 18 * 60) / 60) + 1)
  const PX_HORA = 56
  const horas = Array.from({ length: hHasta - hDesde }, (_, i) => hDesde + i)
  const hoyISO = aISO(new Date())

  if (cargando) return <PantallaEsqueleto variante="lista" />

  const titSemana = `${dias[0].toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })} – ${dias[6].toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const moverSemana = (n: number) => { const x = new Date(lunes); x.setDate(x.getDate() + 7 * n); setLunes(x) }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:px-8">
      <BotonVolver href="/panel" />
      <Encabezado
        sobretitulo="Dirección académica"
        titulo="Calendario general"
        descripcion="Todas las clases de tus sedes en la semana. Toca una para ver su detalle o moverla; en computadora también puedes arrastrarla."
      />
      <Regla delay={40} />
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-zr-border bg-zr-surface p-1">
          {(['semana', 'plan'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`min-h-10 rounded-full px-5 text-sm font-bold ${vista === v ? 'bg-zr-blue text-white' : 'text-zr-text-muted'}`}>
              {v === 'semana' ? 'Semana' : 'Planificación'}
            </button>
          ))}
        </div>
      </div>
      {vista === 'plan' && <PlanificacionCortes />}
      {vista === 'semana' && (<>

      {/* Barra de semana y filtros */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => moverSemana(-1)} aria-label="Semana anterior" className="flex h-11 w-11 items-center justify-center rounded-full border border-zr-border text-zr-text">‹</button>
          <p className="min-w-0 flex-1 text-center text-sm font-bold capitalize text-zr-text md:w-56 md:flex-none">{titSemana}</p>
          <button onClick={() => moverSemana(1)} aria-label="Semana siguiente" className="flex h-11 w-11 items-center justify-center rounded-full border border-zr-border text-zr-text">›</button>
          <button onClick={() => setLunes(lunesDe(new Date()))} className="min-h-11 rounded-full border border-zr-border px-4 text-xs font-bold text-zr-text">Hoy</button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select value={sede} onChange={(e) => { setSede(e.target.value); setCorte('') }} className="min-h-11 rounded-xl border border-zr-border bg-zr-surface/40 px-3 text-sm text-zr-text">
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={corte} onChange={(e) => setCorte(e.target.value)} className="min-h-11 rounded-xl border border-zr-border bg-zr-surface/40 px-3 text-sm text-zr-text">
            <option value="">Todos los cortes</option>
            {cortes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="rounded-xl bg-zr-error/10 px-4 py-3 text-sm font-semibold text-zr-error">{error}</p>}

      {choques.size > 0 && (
        <p className="rounded-xl border border-zr-error/40 bg-zr-error/10 px-4 py-3 text-sm font-semibold text-zr-error">
          Hay clases que chocan esta semana por salón o profesor (marcadas en rojo). Toca una para ver con cuál.
        </p>
      )}

      {visibles.length === 0 && !error && (
        <p className="zr-card p-6 text-center text-sm text-zr-text-muted">No hay clases presenciales esta semana.</p>
      )}

      {/* Computadora: semana por horas */}
      {visibles.length > 0 && (
        <div className="zr-card hidden overflow-hidden md:block">
          <div className="grid" style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}>
            <div />
            {dias.map((d) => (
              <div key={aISO(d)} className={`border-b border-l border-zr-border/60 px-2 py-2 text-center ${aISO(d) === hoyISO ? 'bg-zr-blue/10' : ''}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">{DIA_CORTO[d.getDay()]}</p>
                <p className="text-lg font-bold text-zr-text">{d.getDate()}</p>
              </div>
            ))}
            {/* Columna de horas */}
            <div className="relative" style={{ height: horas.length * PX_HORA }}>
              {horas.map((h, i) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-zr-text-muted" style={{ top: i * PX_HORA }}>
                  {i === 0 ? '' : `${((h + 11) % 12) + 1} ${h < 12 ? 'a.m.' : 'p.m.'}`}
                </span>
              ))}
            </div>
            {dias.map((d) => {
              const iso = aISO(d)
              const delDia = visibles.filter((c) => c.fecha === iso)
              return (
                <div
                  key={iso}
                  className={`relative border-l border-zr-border/60 ${sobreDia === iso ? 'bg-zr-blue/10' : ''}`}
                  style={{ height: horas.length * PX_HORA }}
                  onDragOver={(e) => { if (arrastrada && iso >= hoyISO) { e.preventDefault(); setSobreDia(iso) } }}
                  onDragLeave={() => setSobreDia((s) => (s === iso ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault(); setSobreDia(null)
                    const c = arrastrada; setArrastrada(null)
                    if (!c || iso < hoyISO) return
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                    const ini0 = minutos(c.hora_inicio) ?? 8 * 60
                    const dur = (minutos(c.hora_fin) ?? ini0 + 120) - ini0
                    const ini = Math.max(0, Math.min(24 * 60 - dur, Math.round((hDesde * 60 + (y / PX_HORA) * 60) / 30) * 30))
                    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                    if (iso === c.fecha && hhmm(ini) === (c.hora_inicio ?? '').slice(0, 5)) return
                    setPropuesta({ nueva: iso, ini: hhmm(ini), fin: hhmm(ini + dur) })
                    setAbierta(c)
                  }}
                >
                  {horas.map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-zr-border/40" style={{ top: i * PX_HORA }} />
                  ))}
                  {delDia.map((c, k) => {
                    const ini = minutos(c.hora_inicio) ?? hDesde * 60 + 60
                    const fin = minutos(c.hora_fin) ?? ini + 120
                    const top = ((ini - hDesde * 60) / 60) * PX_HORA
                    const alto = Math.max(36, ((fin - ini) / 60) * PX_HORA - 4)
                    // Si dos clases se pisan en el mismo día, se reparten el ancho.
                    const pisadas = delDia.filter((o) => {
                      const oi = minutos(o.hora_inicio) ?? 0, of = minutos(o.hora_fin) ?? 0
                      return oi < fin && ini < of
                    })
                    const pos = pisadas.indexOf(c)
                    const ancho = 100 / Math.max(1, pisadas.length)
                    const malo = choqueDe(c)
                    return (
                      <button
                        key={`${c.cohort_id}-${k}`}
                        onClick={() => abrir(c)}
                        draggable={puedeMover && c.fecha >= hoyISO}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setArrastrada(c) }}
                        onDragEnd={() => { setArrastrada(null); setSobreDia(null) }}
                        title={puedeMover && c.fecha >= hoyISO ? 'Arrastra para mover esta clase' : undefined}
                        className={`absolute flex ${puedeMover && c.fecha >= hoyISO ? 'cursor-grab active:cursor-grabbing' : ''} flex-col justify-start overflow-hidden rounded-lg px-2 py-1.5 text-left text-white shadow-md ${malo ? 'ring-2 ring-zr-error' : ''}`}
                        style={{ top: top + 2, height: alto, left: `calc(${pos * ancho}% + 3px)`, width: `calc(${ancho}% - 6px)`, background: colorDe(c.cohorte) }}
                      >
                        <p className="truncate text-xs font-bold">{c.cohorte}</p>
                        <p className="truncate text-[11px] opacity-90">{c.modulo}</p>
                        <p className="truncate text-[11px] opacity-80">{hora12(c.hora_inicio)} · {c.salon ?? 'sin salón'}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Teléfono: lista por día */}
      {visibles.length > 0 && (
        <div className="space-y-4 md:hidden">
          {dias.map((d) => {
            const iso = aISO(d)
            const delDia = visibles.filter((c) => c.fecha === iso)
            if (delDia.length === 0) return null
            return (
              <div key={iso} className="space-y-2">
                <p className="zr-eyebrow capitalize">{d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {delDia.map((c, k) => {
                  const malo = choqueDe(c)
                  return (
                    <button
                      key={`${c.cohort_id}-${k}`}
                      onClick={() => abrir(c)}
                      className={`zr-card flex w-full items-stretch gap-3 overflow-hidden p-0 text-left ${malo ? 'ring-2 ring-zr-error' : ''}`}
                    >
                      <span className="w-1.5 shrink-0" style={{ background: colorDe(c.cohorte) }} />
                      <span className="min-w-0 flex-1 py-3 pr-3">
                        <span className="block text-sm font-bold text-zr-text">{hora12(c.hora_inicio)} – {hora12(c.hora_fin)}</span>
                        <span className="block truncate text-sm text-zr-text">{c.cohorte} · {c.modulo}</span>
                        <span className="block truncate text-xs text-zr-text-muted">{c.profesores ?? 'Sin profesor'} · {c.salon ?? 'sin salón'}</span>
                        {malo && <span className="mt-1 block text-xs font-semibold text-zr-error">Choque con {malo.join('; ')}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Detalle de una clase */}
      </>)}
      {abierta && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-5" onClick={cerrar}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border border-zr-border bg-zr-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="zr-eyebrow">{abierta.sede ?? ''}</p>
                <p className="text-lg font-bold text-zr-text">{abierta.cohorte}</p>
              </div>
              <button onClick={cerrar} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zr-border text-zr-text">✕</button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-zr-text-muted">Fecha</dt>
              <dd className="font-semibold capitalize text-zr-text">{deISO(abierta.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</dd>
              <dt className="text-zr-text-muted">Hora</dt>
              <dd className="font-semibold text-zr-text">{hora12(abierta.hora_inicio)} – {hora12(abierta.hora_fin)}</dd>
              <dt className="text-zr-text-muted">Módulo</dt>
              <dd className="font-semibold text-zr-text">{abierta.modulo_orden}. {abierta.modulo}</dd>
              <dt className="text-zr-text-muted">Profesor</dt>
              <dd className="font-semibold text-zr-text">{abierta.profesores ?? 'Sin asignar'}</dd>
              <dt className="text-zr-text-muted">Salón</dt>
              <dd className="font-semibold text-zr-text">{abierta.salon ?? 'Sin salón'}</dd>
            </dl>
            {choqueDe(abierta) && (
              <p className="rounded-xl bg-zr-error/10 px-3 py-2 text-xs font-semibold text-zr-error">Choca con {choqueDe(abierta)!.join('; ')}</p>
            )}
            {abierta.movida && abierta.fecha_original && (
              <p className="text-xs text-zr-text-muted">Movida desde el {deISO(abierta.fecha_original).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })}.</p>
            )}
            <button onClick={() => router.push(`/cohortes/${abierta.cohort_id}`)} className="min-h-12 w-full rounded-xl border border-zr-border text-sm font-bold text-zr-text">
              Abrir la ficha del corte
            </button>
            {puedeMover && abierta.fecha >= hoyISO && (
              <MoverClase
                key={`${abierta.cohort_id}-${abierta.fecha}-${propuesta ? propuesta.nueva + propuesta.ini : ""}`}
                cohortId={abierta.cohort_id}
                fecha={abierta.fecha}
                horaInicio={abierta.hora_inicio}
                horaFin={abierta.hora_fin}
                sede={abierta.sede}
                inicial={propuesta ?? undefined}
                onListo={() => { void cargar() }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
