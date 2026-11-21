'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select } from '@/components/ui/Select'

/**
 * Calendario de mes con el salón de cada sábado de UN corte, dentro de la
 * ficha del corte (20-nov-2026). Se toca un día de clase y se cambia su salón;
 * si un día no tiene salón propio, hereda el último asignado (igual que
 * /salones y fn_salon_de_clase, migración 216).
 */
interface Salon { id: string; nombre: string }

const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function SalonesCorte({ cohorteId }: { cohorteId: string }) {
  const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [salones, setSalones] = useState<Salon[]>([])
  const [dias, setDias] = useState<Map<string, string>>(new Map())
  const [clases, setClases] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<string | null>(null)
  const [sede, setSede] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? '')
    const { data: c } = await supabase.from('cohorts').select('sede').eq('id', cohorteId).maybeSingle()
    const nombreSede = (c as { sede: string | null } | null)?.sede ?? null
    setSede(nombreSede)
    const [{ data: s }, { data: r }, { data: d }, { data: ses }] = await Promise.all([
      supabase.from('sedes').select('id, nombre').eq('nombre', nombreSede ?? ''),
      supabase.from('rooms' as never).select('id, sede_id, nombre').order('nombre'),
      supabase.from('cohort_room_days' as never).select('class_date, room_id').eq('cohort_id', cohorteId),
      supabase.from('class_sessions').select('session_date').eq('cohort_id', cohorteId),
    ])
    const idSede = (s as { id: string }[] | null)?.[0]?.id
    setSalones(((r ?? []) as unknown as { id: string; sede_id: string; nombre: string }[]).filter((x) => x.sede_id === idSede))
    setDias(new Map(((d ?? []) as unknown as { class_date: string; room_id: string }[]).map((x) => [x.class_date, x.room_id])))
    setClases(new Set((ses ?? []).map((x) => x.session_date)))
    setCargando(false)
  }, [cohorteId])

  useEffect(() => { void cargar() }, [cargar])

  const nombre = (id?: string) => salones.find((s) => s.id === id)?.nombre
  // Salón efectivo de una fecha: el propio o el último anterior.
  const efectivo = useCallback((f: string): { id?: string; propio: boolean } => {
    if (dias.has(f)) return { id: dias.get(f), propio: true }
    const prev = [...dias.keys()].filter((k) => k < f).sort().pop()
    return { id: prev ? dias.get(prev) : undefined, propio: false }
  }, [dias])

  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    const hueco = (primero.getDay() + 6) % 7 // lunes primero
    return [...Array<null>(hueco).fill(null), ...Array.from({ length: total }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1))]
  }, [mes])

  async function elegir(fecha: string, roomId: string) {
    const supabase = createClient()
    if (!roomId) await supabase.from('cohort_room_days' as never).delete().eq('cohort_id', cohorteId).eq('class_date', fecha)
    else await supabase.from('cohort_room_days' as never).upsert({ cohort_id: cohorteId, class_date: fecha, room_id: roomId, set_by: userId } as never)
    await cargar()
  }

  if (cargando) return <p className="text-sm text-zr-text-muted">Cargando salones…</p>
  if (salones.length === 0) {
    return <p className="zr-card p-4 text-sm text-zr-text-muted">La sede {sede ?? '(sin sede)'} todavía no tiene salones. El super admin los crea en Salones.</p>
  }

  const titulo = mes.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
  const esClase = (d: Date) => d.getDay() === 6 || clases.has(aISO(d))

  return (
    <div className="zr-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="min-h-10 min-w-10 rounded-lg border border-zr-border text-zr-text" aria-label="Mes anterior">‹</button>
        <p className="text-sm font-bold capitalize text-zr-text">{titulo}</p>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="min-h-10 min-w-10 rounded-lg border border-zr-border text-zr-text" aria-label="Mes siguiente">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-zr-text-muted">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (!d) return <span key={i} />
          const f = aISO(d)
          if (!esClase(d)) return <span key={i} className="flex min-h-12 items-start justify-center pt-1 text-xs text-zr-text-muted/50">{d.getDate()}</span>
          const e = efectivo(f)
          return (
            <button
              key={i}
              onClick={() => setSel(f)}
              className={`flex min-h-12 flex-col items-center rounded-lg border px-0.5 py-1 text-center transition-colors ${
                sel === f ? 'border-zr-blue bg-zr-blue/20' : 'border-zr-border bg-zr-surface/40 hover:border-zr-blue/60'
              }`}
            >
              <span className="text-xs font-bold text-zr-text">{d.getDate()}</span>
              <span className={`w-full truncate text-[10px] leading-tight ${e.propio ? 'font-semibold text-zr-blue-mid' : 'text-zr-text-muted'}`}>
                {nombre(e.id) ?? '—'}
              </span>
            </button>
          )
        })}
      </div>
      {sel ? (
        <div className="space-y-2 border-t border-zr-border/60 pt-3">
          <p className="text-sm font-semibold capitalize text-zr-text">
            {new Date(`${sel}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <Select
            value={dias.get(sel) ?? ''}
            onChange={(e) => elegir(sel, e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text"
          >
            <option value="">{efectivo(sel).id && !efectivo(sel).propio ? `Igual que antes (${nombre(efectivo(sel).id)})` : 'Sin salón asignado'}</option>
            {salones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        </div>
      ) : (
        <p className="text-xs text-zr-text-muted">Toca un día de clase para cambiar su salón. En azul, los que tienen salón propio; en gris, los que repiten el anterior.</p>
      )}
    </div>
  )
}
