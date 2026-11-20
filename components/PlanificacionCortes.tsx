'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * Planificación (20-nov-2026, pedido del coordinador): la misma vista que la
 * hoja de cálculo de Dirección Académica. Una fila por corte, una columna por
 * semana, y una barra por cada módulo con su profesor. Se ve por mes,
 * trimestre, semestre o año. Sale del calendario de módulos de cada corte
 * (`cohort_module_calendar`) y de la cobertura (`teacher_module_assignments`).
 */

interface Corte { id: string; name: string; sede: string | null; turno: string | null; status: string; programs?: { tipo: string | null } | null }
interface Tramo { cohort_id: string; module_id: string; start_date: string; end_date: string; modalidad: string | null }

const RANGOS = [
  { meses: 1, etiqueta: 'Mes' },
  { meses: 3, etiqueta: 'Trimestre' },
  { meses: 6, etiqueta: 'Semestre' },
  { meses: 12, etiqueta: 'Año' },
] as const
const COLORES = ['#3869B1', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04', '#4F46E5']
const ANCHO = 'minmax(34px, 1fr)'

const deISO = (s: string) => new Date(`${s}T12:00:00`)
const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function lunesDe(d: Date) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

export function PlanificacionCortes() {
  const [meses, setMeses] = useState<number>(3)
  const [inicio, setInicio] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12) })
  const [cortes, setCortes] = useState<Corte[]>([])
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [modulos, setModulos] = useState<Record<string, string>>({})
  const [profes, setProfes] = useState<Record<string, string>>({}) // `${cohort}|${module}` → nombres
  const [verTerminados, setVerTerminados] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const [c, t, m, a] = await Promise.all([
        supabase.from('cohorts').select('id, name, sede, turno, status, programs(tipo)').order('sede').order('name'),
        supabase.from('cohort_module_calendar' as never).select('cohort_id, module_id, start_date, end_date, modalidad'),
        supabase.from('modules').select('id, name'),
        supabase.from('teacher_module_assignments').select('cohort_id, module_id, teacher_id'),
      ])
      const asig = (a.data ?? []) as { cohort_id: string | null; module_id: string; teacher_id: string }[]
      const ids = [...new Set(asig.map((x) => x.teacher_id))]
      const { data: p } = ids.length
        ? await supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [] as { id: string; full_name: string | null }[] }
      const nombre = Object.fromEntries((p ?? []).map((x) => [x.id, (x.full_name ?? '').split(' ')[0]]))
      const pr: Record<string, string[]> = {}
      for (const x of asig) {
        const k = `${x.cohort_id}|${x.module_id}`
        ;(pr[k] ??= []).push(nombre[x.teacher_id] ?? '')
      }
      setCortes((c.data ?? []) as unknown as Corte[])
      setTramos((t.data ?? []) as unknown as Tramo[])
      setModulos(Object.fromEntries(((m.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])))
      setProfes(Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.filter(Boolean).join(' / ')])))
      setCargando(false)
    })()
  }, [])

  // Semanas visibles (columnas), de lunes a lunes.
  const semanas = useMemo(() => {
    const fin = new Date(inicio); fin.setMonth(fin.getMonth() + meses)
    const out: Date[] = []
    for (let d = lunesDe(inicio); d < fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 12)) out.push(d)
    return out
  }, [inicio, meses])
  const primera = semanas[0]
  const n = semanas.length
  const colDe = (iso: string) => Math.floor((deISO(iso).getTime() - primera.getTime()) / (7 * 864e5))
  const hoyCol = colDe(aISO(new Date()))

  const filas = cortes.filter((c) => verTerminados || c.status === 'activa')
  const colorModulo = (id: string) => COLORES[Object.keys(modulos).indexOf(id) % COLORES.length]

  const mover = (k: number) => { const d = new Date(inicio); d.setMonth(d.getMonth() + k * meses); setInicio(d) }
  const titulo = `${primera.toLocaleDateString('es-VE', { month: 'short', year: 'numeric' })} – ${semanas[n - 1].toLocaleDateString('es-VE', { month: 'short', year: 'numeric' })}`

  if (cargando) return <p className="text-sm text-zr-text-muted">Cargando planificación…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => mover(-1)} aria-label="Anterior" className="flex h-11 w-11 items-center justify-center rounded-full border border-zr-border text-zr-text">‹</button>
          <p className="min-w-0 flex-1 text-center text-sm font-bold capitalize text-zr-text md:w-56 md:flex-none">{titulo}</p>
          <button onClick={() => mover(1)} aria-label="Siguiente" className="flex h-11 w-11 items-center justify-center rounded-full border border-zr-border text-zr-text">›</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <button key={r.meses} onClick={() => setMeses(r.meses)} className={`min-h-10 rounded-full border px-4 text-xs font-bold ${meses === r.meses ? 'border-zr-blue bg-zr-blue text-white' : 'border-zr-border text-zr-text'}`}>{r.etiqueta}</button>
          ))}
          <label className="flex items-center gap-2 text-xs text-zr-text-muted">
            <input type="checkbox" checked={verTerminados} onChange={(e) => setVerTerminados(e.target.checked)} className="h-4 w-4" />
            Ver cortes terminados
          </label>
        </div>
      </div>

      <div className="zr-scroll overflow-x-auto rounded-2xl border border-zr-border">
        <div className="grid min-w-max text-xs" style={{ gridTemplateColumns: `160px repeat(${n}, ${meses >= 6 ? '30px' : ANCHO})` }}>
          {/* Encabezado: fechas de cada semana (sábado) */}
          <div className="sticky left-0 z-20 border-b border-r border-zr-border bg-zr-bg p-2 font-bold text-zr-text-muted">Corte</div>
          {semanas.map((s, i) => {
            const sab = new Date(s); sab.setDate(s.getDate() + 5)
            return (
              <div key={i} className={`flex h-20 items-end justify-center border-b border-r border-zr-border pb-1 ${i === hoyCol ? 'bg-zr-blue/30' : ''}`}>
                <span className="text-[10px] text-zr-text-muted [writing-mode:vertical-rl] rotate-180">{sab.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              </div>
            )
          })}

          {filas.map((c) => (
            <div key={c.id} className="contents">
              <Link href={`/cohortes/${c.id}`} className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-zr-border bg-zr-bg px-2 py-1.5">
                <span className="truncate font-bold text-zr-text">{c.name}</span>
                <span className="truncate text-[10px] text-zr-text-muted">{[c.programs?.tipo === 'curso' ? 'Curso corto' : null, c.sede, c.turno].filter(Boolean).join(' · ')}</span>
              </Link>
              <div className="relative border-b border-zr-border" style={{ gridColumn: `2 / span ${n}` }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                  {semanas.map((_, i) => <div key={i} className={`border-r border-zr-border/40 ${i === hoyCol ? 'bg-zr-blue/15' : ''}`} />)}
                </div>
                <div className="relative grid min-h-[38px] items-center gap-y-0.5 py-1" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                  {tramos.filter((t) => t.cohort_id === c.id).map((t, i) => {
                    const a = Math.max(0, colDe(t.start_date))
                    const b = Math.min(n - 1, colDe(t.end_date))
                    if (b < 0 || a > n - 1) return null
                    const virtual = t.modalidad === 'virtual'
                    const prof = profes[`${c.id}|${t.module_id}`]
                    const texto = `${modulos[t.module_id] ?? 'Módulo'}${prof ? `: ${prof}` : ''}`
                    return (
                      <div key={i} title={`${texto}${virtual ? ' (virtual)' : ''} · ${t.start_date} a ${t.end_date}`}
                        className={`mx-px truncate rounded-md px-1.5 py-1 text-[11px] font-semibold text-white ${virtual ? 'border border-dashed border-white/70 opacity-80' : ''}`}
                        style={{ gridColumn: `${a + 1} / ${b + 2}`, gridRow: virtual ? 2 : 1, background: colorModulo(t.module_id) }}>
                        {virtual ? '◇ ' : ''}{texto}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-zr-text-muted">Cada columna es una semana (fecha del sábado). La franja azul es esta semana. ◇ = módulo virtual en paralelo. Toca el nombre de un corte para abrir su ficha y cambiar su calendario.</p>
    </div>
  )
}
