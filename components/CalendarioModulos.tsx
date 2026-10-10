'use client'

import { Select } from '@/components/ui/Select'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Calendario de módulos por cohorte (migración 137). Solo super_admin -- la
 * RLS es la garantía real; esta pantalla ya vive dentro de Configuración,
 * que solo abre para super_admin.
 *
 * Cada fila es un TRAMO de un módulo (Motor de combustión interna tiene dos,
 * por las vacaciones de diciembre). Se edita por fecha o por número de
 * sábados; al guardar, el servidor actualiza el módulo actual de la cohorte
 * y el módulo de sus sesiones. Cada noche se vuelve a aplicar solo.
 */

interface Tramo {
  id: string
  moduleId: string
  inicio: string
  fin: string
}

interface Modulo { id: string; nombre: string; orden: number }
interface Cohorte { id: string; nombre: string; programId: string; moduloActual: string | null }

const CAMPO =
  'w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none'

function aFecha(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function aISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function contarSabados(inicio: string, fin: string): number {
  if (!inicio || !fin || fin < inicio) return 0
  let n = 0
  for (const d = aFecha(inicio); aISO(d) <= fin; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6) n++
  }
  return n
}

// Fin de un tramo de n sábados que empieza en `inicio` (un sábado).
function finPorSabados(inicio: string, n: number): string {
  const d = aFecha(inicio)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + (Math.max(1, n) - 1) * 7)
  return aISO(d)
}

function formatear(iso: string): string {
  return aFecha(iso).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CalendarioModulos() {
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [nuevoModulo, setNuevoModulo] = useState('')
  const [nuevoInicio, setNuevoInicio] = useState('')
  const [nuevosSabados, setNuevosSabados] = useState('4')

  const cohorte = cohortes.find((c) => c.id === cohorteId)

  useEffect(() => {
    createClient()
      .from('cohorts')
      .select('id, name, program_id, current_module_id')
      .eq('status', 'activa')
      .order('name')
      .then(({ data }) => {
        const lista = (data ?? []).map((c) => ({
          id: c.id, nombre: c.name, programId: c.program_id, moduloActual: c.current_module_id,
        }))
        setCohortes(lista)
        setCohorteId((actual) => actual || lista.find((c) => c.nombre === 'PTMA-2026-II')?.id || lista[0]?.id || '')
      })
  }, [version])

  useEffect(() => {
    if (!cohorte) return
    const supabase = createClient()
    Promise.all([
      supabase.from('modules').select('id, name, order_index').eq('program_id', cohorte.programId).order('order_index'),
      supabase.from('cohort_module_calendar').select('id, module_id, start_date, end_date').eq('cohort_id', cohorte.id).order('start_date'),
    ]).then(([{ data: mods }, { data: cal }]) => {
      setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index })))
      setTramos((cal ?? []).map((t) => ({ id: t.id, moduleId: t.module_id, inicio: t.start_date, fin: t.end_date })))
    })
  }, [cohorte?.id, cohorte?.programId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const nombreModulo = (id: string) => {
    const m = modulos.find((x) => x.id === id)
    return m ? `Módulo ${m.orden} · ${m.nombre}` : '—'
  }

  async function guardar(t: Tramo, cambios: Partial<Pick<Tramo, 'inicio' | 'fin'>>) {
    const nuevo = { ...t, ...cambios }
    if (!nuevo.inicio || !nuevo.fin) return
    if (nuevo.fin < nuevo.inicio) {
      setError('La fecha de fin no puede ser anterior a la de inicio.')
      setVersion((v) => v + 1)
      return
    }
    setGuardandoId(t.id)
    setError(null)
    const { error: fallo } = await createClient()
      .from('cohort_module_calendar')
      .update({ start_date: nuevo.inicio, end_date: nuevo.fin })
      .eq('id', t.id)
    setGuardandoId(null)
    if (fallo) setError(fallo.message)
    setVersion((v) => v + 1)
  }

  async function borrar(t: Tramo) {
    if (!confirm(`¿Quitar este tramo de "${nombreModulo(t.moduleId)}" del calendario?`)) return
    const { error: fallo } = await createClient().from('cohort_module_calendar').delete().eq('id', t.id)
    if (fallo) setError(fallo.message)
    setVersion((v) => v + 1)
  }

  async function agregar() {
    if (!cohorte || !nuevoModulo || !nuevoInicio) {
      setError('Elige el módulo y la fecha de inicio.')
      return
    }
    setError(null)
    const fin = finPorSabados(nuevoInicio, Number(nuevosSabados) || 1)
    const { error: fallo } = await createClient()
      .from('cohort_module_calendar')
      .insert({ cohort_id: cohorte.id, module_id: nuevoModulo, start_date: nuevoInicio, end_date: fin })
    if (fallo) { setError(fallo.message); return }
    setNuevoModulo('')
    setNuevoInicio('')
    setVersion((v) => v + 1)
  }

  const actual = cohorte?.moduloActual ? nombreModulo(cohorte.moduloActual) : null
  const repetidos = new Set(
    tramos.map((t) => t.moduleId).filter((id, i, a) => a.indexOf(id) !== i),
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-zr-text-muted">
        El módulo de cada cohorte cambia solo según estas fechas (se revisa cada noche y al guardar).
        Un módulo puede tener varios tramos, por ejemplo con vacaciones de por medio. Las clases son
        los sábados.
      </p>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Cohorte</label>
        <Select value={cohorteId} onChange={(e) => setCohorteId(e.target.value)} className={CAMPO}>
          {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        {actual && (
          <p className="mt-2 text-xs font-semibold text-zr-blue-mid">Ahora cursa: {actual}</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {tramos.length === 0 ? (
        <p className="rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm text-zr-text-muted">
          Esta cohorte no tiene calendario. Su módulo se cambia a mano desde Cohortes. Agrega tramos
          abajo para que cambie solo.
        </p>
      ) : (
        <div className="space-y-2">
          {tramos.map((t) => {
            const hoy = aISO(new Date())
            const vigente = t.inicio <= hoy && hoy <= t.fin
            return (
              <div key={t.id} className={`zr-card space-y-3 p-4 ${vigente ? 'border-zr-blue/60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zr-text">{nombreModulo(t.moduleId)}</p>
                    <p className="text-xs text-zr-text-muted">
                      {formatear(t.inicio)} → {formatear(t.fin)}
                      {repetidos.has(t.moduleId) ? ' · tramo de un módulo cortado' : ''}
                      {vigente ? ' · en curso' : ''}
                    </p>
                  </div>
                  <button onClick={() => borrar(t)} className="shrink-0 text-xs font-bold text-zr-error">
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-zr-text-muted">Inicio</label>
                    <input
                      type="date" defaultValue={t.inicio} key={`i-${t.id}-${t.inicio}`}
                      disabled={guardandoId === t.id}
                      onBlur={(e) => e.target.value !== t.inicio && guardar(t, { inicio: e.target.value })}
                      className={CAMPO}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-zr-text-muted">Sábados</label>
                    <input
                      type="number" min={1} max={30} inputMode="numeric"
                      defaultValue={contarSabados(t.inicio, t.fin)} key={`s-${t.id}-${t.inicio}-${t.fin}`}
                      disabled={guardandoId === t.id}
                      onBlur={(e) => {
                        const n = Number(e.target.value)
                        if (n >= 1 && n !== contarSabados(t.inicio, t.fin)) guardar(t, { fin: finPorSabados(t.inicio, n) })
                      }}
                      className={`${CAMPO} text-center`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-zr-text-muted">Fin</label>
                    <input
                      type="date" defaultValue={t.fin} key={`f-${t.id}-${t.fin}`}
                      disabled={guardandoId === t.id}
                      onBlur={(e) => e.target.value !== t.fin && guardar(t, { fin: e.target.value })}
                      className={CAMPO}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="zr-card space-y-3 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Agregar tramo</p>
        <Select value={nuevoModulo} onChange={(e) => setNuevoModulo(e.target.value)} className={CAMPO}>
          <option value="">Elige el módulo…</option>
          {modulos.map((m) => <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-zr-text-muted">Inicio (sábado)</label>
            <input type="date" value={nuevoInicio} onChange={(e) => setNuevoInicio(e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-zr-text-muted">Cantidad de sábados</label>
            <input
              type="number" min={1} max={30} inputMode="numeric" value={nuevosSabados}
              onChange={(e) => setNuevosSabados(e.target.value)} className={`${CAMPO} text-center`}
            />
          </div>
        </div>
        <button onClick={agregar} className="min-h-11 w-full rounded-lg bg-zr-blue text-sm font-bold text-white">
          Agregar al calendario
        </button>
      </div>
    </div>
  )
}
