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

interface Corte { id: string; name: string; sede: string | null; turno: string | null; status: string }
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

interface Curso { id: string; nombre: string; sede: string | null; turno: string | null; start_date: string; end_date: string; teacher_name: string | null; class_start: string | null; class_end: string | null; notas: string | null }
const CURSO_VACIO = { nombre: '', sede: '', turno: '', start_date: '', end_date: '', teacher_name: '', class_start: '', class_end: '', notas: '' }
const CAMPO = 'min-h-11 w-full rounded-xl border border-zr-border bg-zr-bg px-3 text-sm text-zr-text'

export function PlanificacionCortes({ puedeEditar = false }: { puedeEditar?: boolean }) {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [form, setForm] = useState<(typeof CURSO_VACIO & { id?: string }) | null>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
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
      const { data: cc } = await supabase.from('short_courses' as never).select('*').order('start_date')
      setCursos((cc ?? []) as unknown as Curso[])
      const [c, t, m, a] = await Promise.all([
        supabase.from('cohorts').select('id, name, sede, turno, status').order('sede').order('name'),
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
  }, [recarga])

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

  async function guardarCurso() {
    if (!form) return
    if (!form.nombre.trim() || !form.start_date || !form.end_date) { setErrorForm('Pon nombre, fecha de inicio y de fin.'); return }
    if (form.end_date < form.start_date) { setErrorForm('La fecha de fin no puede ser antes del inicio.'); return }
    const fila = {
      nombre: form.nombre.trim(), sede: form.sede || null, turno: form.turno || null,
      start_date: form.start_date, end_date: form.end_date, teacher_name: form.teacher_name || null,
      class_start: form.class_start || null, class_end: form.class_end || null, notas: form.notas || null,
    }
    const q = createClient().from('short_courses' as never)
    const { error } = form.id ? await q.update(fila as never).eq('id', form.id) : await q.insert(fila as never)
    if (error) { setErrorForm(error.message); return }
    setForm(null); setRecarga((x) => x + 1)
  }
  async function borrarCurso() {
    if (!form?.id || !confirm(`¿Eliminar el curso "${form.nombre}"? No se puede deshacer.`)) return
    const { error } = await createClient().from('short_courses' as never).delete().eq('id', form.id)
    if (error) { setErrorForm(error.message); return }
    setForm(null); setRecarga((x) => x + 1)
  }
  const editar = (k: Curso) => {
    setErrorForm(null)
    setForm({ id: k.id, nombre: k.nombre, sede: k.sede ?? '', turno: k.turno ?? '', start_date: k.start_date, end_date: k.end_date, teacher_name: k.teacher_name ?? '', class_start: (k.class_start ?? '').slice(0, 5), class_end: (k.class_end ?? '').slice(0, 5), notas: k.notas ?? '' })
  }

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
                <span className="truncate text-[10px] text-zr-text-muted">{[c.sede, c.turno].filter(Boolean).join(' · ')}</span>
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

          {cursos.length > 0 && (
            <div className="sticky left-0 z-10 border-b border-zr-border bg-zr-bg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zr-text-muted" style={{ gridColumn: `1 / span ${n + 1}` }}>Cursos cortos</div>
          )}
          {cursos.map((k) => {
            const a = Math.max(0, colDe(k.start_date)); const b = Math.min(n - 1, colDe(k.end_date))
            const visible = !(b < 0 || a > n - 1)
            return (
              <div key={k.id} className="contents">
                <button type="button" disabled={!puedeEditar} onClick={() => editar(k)}
                  className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-zr-border bg-zr-bg px-2 py-1.5 text-left">
                  <span className="truncate font-bold text-zr-text">{k.nombre}</span>
                  <span className="truncate text-[10px] text-zr-text-muted">{['Curso', k.sede, k.turno].filter(Boolean).join(' · ')}</span>
                </button>
                <div className="relative border-b border-zr-border" style={{ gridColumn: `2 / span ${n}` }}>
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                    {semanas.map((_, i) => <div key={i} className={`border-r border-zr-border/40 ${i === hoyCol ? 'bg-zr-blue/15' : ''}`} />)}
                  </div>
                  <div className="relative grid min-h-[38px] items-center py-1" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                    {visible && (
                      <div title={`${k.nombre} · ${k.start_date} a ${k.end_date}`} className="mx-px truncate rounded-md bg-[#0F766E] px-1.5 py-1 text-[11px] font-semibold text-white" style={{ gridColumn: `${a + 1} / ${b + 2}` }}>
                        {k.nombre}{k.teacher_name ? `: ${k.teacher_name}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {puedeEditar && !form && (
        <button onClick={() => { setErrorForm(null); setForm({ ...CURSO_VACIO }) }} className="min-h-11 rounded-full border border-zr-blue/60 px-5 text-sm font-bold text-zr-text">+ Curso corto</button>
      )}
      {form && (
        <div className="max-w-2xl space-y-3 rounded-2xl border border-zr-border bg-zr-bg p-4">
          <p className="text-sm font-bold text-zr-text">{form.id ? 'Editar curso corto' : 'Nuevo curso corto'}</p>
          <p className="text-xs text-zr-text-muted">Un curso suelto (motos, pintura…) que no es un programa con módulos. Por ahora sirve para planificar; no inscribe estudiantes.</p>
          <input placeholder="Nombre (ej. Mecánica de motos)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={CAMPO} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input placeholder="Sede" value={form.sede} onChange={(e) => setForm({ ...form, sede: e.target.value })} className={CAMPO} />
            <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className={CAMPO}>
              <option value="">Turno</option><option>Mañana</option><option>Tarde</option>
            </select>
            <label className="space-y-1 text-xs text-zr-text-muted">Desde<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={CAMPO} /></label>
            <label className="space-y-1 text-xs text-zr-text-muted">Hasta<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={CAMPO} /></label>
            <label className="space-y-1 text-xs text-zr-text-muted">Hora de inicio<input type="time" value={form.class_start} onChange={(e) => setForm({ ...form, class_start: e.target.value })} className={CAMPO} /></label>
            <label className="space-y-1 text-xs text-zr-text-muted">Hora de fin<input type="time" value={form.class_end} onChange={(e) => setForm({ ...form, class_end: e.target.value })} className={CAMPO} /></label>
          </div>
          <input placeholder="Profesor" value={form.teacher_name} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })} className={CAMPO} />
          <input placeholder="Notas (opcional)" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={CAMPO} />
          {errorForm && <p className="rounded-xl bg-zr-error/10 px-3 py-2 text-xs font-semibold text-zr-error">{errorForm}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void guardarCurso()} className="min-h-11 rounded-full bg-zr-blue px-5 text-sm font-bold text-white">Guardar</button>
            <button onClick={() => setForm(null)} className="min-h-11 rounded-full border border-zr-border px-5 text-sm font-bold text-zr-text">Cancelar</button>
            {form.id && <button onClick={() => void borrarCurso()} className="min-h-11 rounded-full border border-zr-error/50 px-5 text-sm font-bold text-zr-error">Eliminar</button>}
          </div>
        </div>
      )}
      <p className="text-xs text-zr-text-muted">Cada columna es una semana (fecha del sábado). La franja azul es esta semana. ◇ = módulo virtual en paralelo. Toca el nombre de un corte para abrir su ficha y cambiar su calendario.</p>
    </div>
  )
}
