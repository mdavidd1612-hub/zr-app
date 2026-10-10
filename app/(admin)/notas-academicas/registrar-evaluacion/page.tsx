'use client'

import { Select } from '@/components/ui/Select'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "Registrar Evaluación" -- corrección explícita del coordinador (sept.
 * 2026) sobre lo que antes era "Por Examen". Aquí se registran exámenes,
 * prácticas u otras cosas evaluativas (columna `kind`, migración 110).
 * Dirección Académica solo define esto -- nunca una nota por estudiante,
 * eso lo llena el profesor. teoría y práctica del módulo se calculan solas
 * a partir de estas notas (trigger `fn_recalc_evaluacion_general`).
 *
 * Reunión de sept. 2026: dos casillas separadas, Programa (la cohorte) y
 * Módulo (TODA la malla de ese programa, no solo el módulo actual) para
 * poder cargar de una vez las evaluaciones de módulos que aún no empiezan.
 * Orden del formulario: Título → Programa → Módulo → Tipo → Fecha → Escala →
 * Mínimo. "Otro" pide escribir de qué se trata (migración 125). El historial
 * se filtra por Programa y luego por Módulo.
 */

interface Cohorte {
  id: string
  nombre: string
  programId: string
}

interface Modulo {
  id: string
  nombre: string
  orden: number
  programId: string
  participacionPct: number
}

interface Evaluacion {
  id: string
  moduleId: string
  moduloNombre: string
  examDate: string
  title: string
  scaleMax: number
  passingMin: number
  pesoPct: number
  kind: 'examen' | 'practica' | 'otro'
  kindDetail: string | null
}

const ETIQUETA_KIND: Record<Evaluacion['kind'], string> = {
  examen: 'Examen',
  practica: 'Práctica',
  otro: 'Otro',
}

const CAMPO =
  'w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none'

type ExamenCrudo = {
  id: string; module_id: string; exam_date: string; title: string
  scale_max: number; passing_min: number; weight_pct: number; kind: string; kind_detail: string | null
  modules: { name: string } | null
}

function aEvaluacion(e: ExamenCrudo): Evaluacion {
  return {
    id: e.id,
    moduleId: e.module_id,
    moduloNombre: e.modules?.name ?? '—',
    examDate: e.exam_date,
    title: e.title,
    scaleMax: Number(e.scale_max),
    passingMin: Number(e.passing_min),
    pesoPct: Number(e.weight_pct),
    kind: e.kind as Evaluacion['kind'],
    kindDetail: e.kind_detail,
  }
}

const COLUMNAS = 'id, module_id, exam_date, title, scale_max, passing_min, weight_pct, kind, kind_detail, modules(name)'

export default function RegistrarEvaluacion() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Formulario (en el orden pedido)
  const [titulo, setTitulo] = useState('')
  const [cohorteId, setCohorteId] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [kind, setKind] = useState<Evaluacion['kind']>('examen')
  const [kindDetail, setKindDetail] = useState('')
  const [fecha, setFecha] = useState('')
  const [escala, setEscala] = useState('20')
  const [minimo, setMinimo] = useState('12')
  const [peso, setPeso] = useState('')
  // Si hay un id, el formulario está editando esa evaluación (no creando una).
  const [editandoId, setEditandoId] = useState<string | null>(null)
  // Rango del peso de la participación (system_config, en %).
  const [partMin, setPartMin] = useState(5)
  const [partMax, setPartMax] = useState(10)

  // Filtros del historial
  const [filtroCohorteId, setFiltroCohorteId] = useState('')
  const [filtroModuloId, setFiltroModuloId] = useState('')

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const [{ data: cohs }, { data: mods }, { data: exs }, { data: cfg }] = await Promise.all([
        supabase.from('cohorts').select('id, name, program_id').eq('status', 'activa').order('name'),
        supabase.from('modules').select('id, name, order_index, program_id, participation_pct').order('order_index'),
        supabase.from('manual_exam_definitions').select(COLUMNAS).order('exam_date', { ascending: false }),
        supabase.from('system_config').select('key, value').in('key', ['module.participation_weight_min', 'module.participation_weight_max']),
      ])
      if (!vigente) return

      for (const c of cfg ?? []) {
        const pct = Math.round(Number(c.value) * 100)
        if (c.key === 'module.participation_weight_min') setPartMin(pct)
        else setPartMax(pct)
      }
      setCohortes((cohs ?? []).map((c) => ({ id: c.id, nombre: c.name, programId: c.program_id })))
      setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index, programId: m.program_id, participacionPct: Number(m.participation_pct) })))
      setEvaluaciones(((exs ?? []) as unknown as ExamenCrudo[]).map(aEvaluacion))
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  const cohorteForm = cohortes.find((c) => c.id === cohorteId)
  const modulosForm = modulos.filter((m) => m.programId === cohorteForm?.programId)
  const cohorteFiltro = cohortes.find((c) => c.id === filtroCohorteId)
  const modulosFiltro = modulos.filter((m) => m.programId === cohorteFiltro?.programId)
  const idsModulosFiltro = new Set(modulosFiltro.map((m) => m.id))

  const visibles = evaluaciones.filter((e) => {
    if (filtroModuloId) return e.moduleId === filtroModuloId
    if (filtroCohorteId) return idsModulosFiltro.has(e.moduleId)
    return true
  })

  const moduloForm = modulos.find((m) => m.id === moduloId)
  const evalsDelModulo = evaluaciones.filter((e) => e.moduleId === moduloId)
  const sumaEvals = evalsDelModulo.filter((e) => e.id !== editandoId).reduce((t, e) => t + e.pesoPct, 0)
  const pesoNuevo = Number(peso.replace(',', '.')) || 0
  const sumaTotal = sumaEvals + pesoNuevo + (moduloForm?.participacionPct ?? 0)

  function limpiarFormulario() {
    setEditandoId(null)
    setTitulo('')
    setKindDetail('')
    setFecha('')
    setPeso('')
    setKind('examen')
    setEscala('20')
    setMinimo('12')
  }

  function empezarEdicion(e: Evaluacion) {
    const modulo = modulos.find((m) => m.id === e.moduleId)
    const cohorte = cohortes.find((c) => c.programId === modulo?.programId)
    setEditandoId(e.id)
    if (cohorte) setCohorteId(cohorte.id)
    setModuloId(e.moduleId)
    setTitulo(e.title)
    setKind(e.kind)
    setKindDetail(e.kindDetail ?? '')
    setFecha(e.examDate)
    setEscala(String(e.scaleMax))
    setMinimo(String(e.passingMin))
    setPeso(String(e.pesoPct))
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cambiarParticipacion(valor: string) {
    if (!moduloForm) return
    const n = Number(valor.replace(',', '.'))
    if (Number.isNaN(n) || n < partMin || n > partMax) {
      setError(`La participación debe valer entre ${partMin} % y ${partMax} %.`)
      return
    }
    if (n === moduloForm.participacionPct) return
    setError(null)
    const { error: fallo } = await createClient().from('modules').update({ participation_pct: n }).eq('id', moduloForm.id)
    if (fallo) { setError(fallo.message); return }
    setModulos((ms) => ms.map((m) => m.id === moduloForm.id ? { ...m, participacionPct: n } : m))
  }

  async function crear() {
    if (!titulo.trim() || !cohorteId || !moduloId || !fecha) {
      setError('El nombre, el programa, el módulo y la fecha son obligatorios.')
      return
    }
    if (!(pesoNuevo > 0)) {
      setError('Escribe el porcentaje que vale esta evaluación en la nota del módulo.')
      return
    }
    if (sumaTotal > 100) {
      setError(`Los porcentajes pasan de 100 % (${sumaTotal} %). Baja el de esta evaluación o el de otra.`)
      return
    }
    if (kind === 'otro' && !kindDetail.trim()) {
      setError('Escribe de qué se trata la evaluación de tipo "Otro".')
      return
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const campos = {
      module_id: moduloId,
      exam_date: fecha,
      title: titulo.trim(),
      scale_max: Number(escala) || 20,
      passing_min: Number(minimo) || 12,
      weight_pct: pesoNuevo,
      kind,
      kind_detail: kind === 'otro' ? kindDetail.trim() : null,
    }
    const { data, error: fallo } = editandoId
      ? await supabase.from('manual_exam_definitions').update(campos).eq('id', editandoId).select(COLUMNAS).single()
      : await supabase.from('manual_exam_definitions').insert(campos).select(COLUMNAS).single()

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    const nueva = aEvaluacion(data as unknown as ExamenCrudo)
    setEvaluaciones((ex) => editandoId ? ex.map((x) => x.id === editandoId ? nueva : x) : [nueva, ...ex])
    // Programa y módulo se conservan: lo normal es cargar varias seguidas.
    limpiarFormulario()
    setGuardando(false)
  }

  async function borrar(id: string) {
    if (!confirm('¿Quitar esta evaluación? También se borran las notas que ya tenga cargadas.')) return
    const supabase = createClient()
    const { error: fallo } = await supabase.from('manual_exam_definitions').delete().eq('id', id)
    if (!fallo) setEvaluaciones((ex) => ex.filter((e) => e.id !== id))
    if (editandoId === id) limpiarFormulario()
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Registrar Evaluación</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Exámenes, prácticas u otra cosa evaluativa. El profesor pone la nota de cada estudiante en
          su propia pantalla. Cada evaluación vale un porcentaje de la nota del módulo; con la participación deben sumar 100 %.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      <div className="zr-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">
          {editandoId ? 'Editando evaluación' : 'Nueva evaluación'}
        </p>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Nombre de la evaluación</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder='Ej. "Examen 2 Instrumentación"'
            className={CAMPO}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Programa</label>
          <Select
            value={cohorteId}
            onChange={(e) => { setCohorteId(e.target.value); setModuloId('') }}
            className={CAMPO}
          >
            <option value="">Elige el programa…</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Módulo</label>
          <Select
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
            disabled={!cohorteId}
            className={`${CAMPO} disabled:opacity-50`}
          >
            <option value="">{cohorteId ? 'Elige el módulo…' : 'Primero elige el programa'}</option>
            {modulosForm.map((m) => (
              <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Tipo</label>
          <div className="flex overflow-hidden rounded-full border border-zr-border">
            {(['examen', 'practica', 'otro'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 py-2 text-xs font-bold ${kind === k ? 'bg-zr-blue text-white' : 'text-zr-text-muted'}`}
              >
                {ETIQUETA_KIND[k]}
              </button>
            ))}
          </div>
          {kind === 'otro' && (
            <input
              value={kindDetail}
              onChange={(e) => setKindDetail(e.target.value)}
              placeholder='¿De qué se trata? Ej. "Recuperación", "Bonificación"'
              className={`${CAMPO} mt-2`}
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Fecha en que se realiza</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Escala</label>
            <input
              type="number"
              value={escala}
              onChange={(e) => setEscala(e.target.value)}
              className={`${CAMPO} text-center`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Mínimo aprobatorio</label>
            <input
              type="number"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              className={`${CAMPO} text-center`}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Porcentaje de la nota del módulo (%)</label>
          <input
            type="number"
            inputMode="decimal"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="Ej. 30"
            className={`${CAMPO} text-center`}
          />
        </div>

        {moduloForm && (
          <div className="space-y-2 rounded-lg border border-zr-border bg-zr-bg/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zr-text-muted">
                Participación del módulo ({partMin} % a {partMax} %)
              </p>
              <input
                key={moduloForm.id + moduloForm.participacionPct}
                type="number"
                inputMode="decimal"
                defaultValue={moduloForm.participacionPct}
                min={partMin}
                max={partMax}
                onBlur={(e) => cambiarParticipacion(e.target.value)}
                className="w-16 rounded border border-zr-border bg-zr-bg px-1 py-1.5 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>
            <p className={`text-xs font-semibold ${sumaTotal === 100 ? 'text-zr-success' : sumaTotal > 100 ? 'text-zr-error' : 'text-zr-warning'}`}>
              Evaluaciones {sumaEvals + pesoNuevo} % + participación {moduloForm.participacionPct} % = {sumaTotal} %
              {sumaTotal === 100 ? ' ✓ completo' : sumaTotal > 100 ? ' · se pasa de 100 %' : ` · faltan ${100 - sumaTotal} %`}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {editandoId && (
            <button
              onClick={limpiarFormulario}
              className="rounded-lg border border-zr-border px-4 py-2.5 text-sm font-bold text-zr-text"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={crear}
            disabled={guardando}
            className="flex-1 rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">
          Evaluaciones registradas ({visibles.length})
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Select
            value={filtroCohorteId}
            onChange={(e) => { setFiltroCohorteId(e.target.value); setFiltroModuloId('') }}
            className={CAMPO}
          >
            <option value="">Todos los programas</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
          <Select
            value={filtroModuloId}
            onChange={(e) => setFiltroModuloId(e.target.value)}
            disabled={!filtroCohorteId}
            className={`${CAMPO} disabled:opacity-50`}
          >
            <option value="">Todos los módulos</option>
            {modulosFiltro.map((m) => (
              <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>
            ))}
          </Select>
        </div>

        {visibles.length === 0 && (
          <p className="text-sm text-zr-text-muted">No hay evaluaciones con ese filtro.</p>
        )}

        {visibles.map((e) => (
          <div key={e.id} className="zr-card flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zr-text">
                {e.title}{' '}
                <span className="text-xs font-normal text-zr-text-muted">
                  · {e.kind === 'otro' && e.kindDetail ? `Otro: ${e.kindDetail}` : ETIQUETA_KIND[e.kind]}
                </span>
              </p>
              <p className="text-xs text-zr-text-muted">
                {e.moduloNombre} · {e.examDate} · Vale {e.pesoPct} % · Escala {e.scaleMax} · Mínimo {e.passingMin}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button onClick={() => empezarEdicion(e)} className="text-xs font-bold text-zr-blue-mid">
                Editar
              </button>
              <button onClick={() => borrar(e.id)} className="text-xs font-bold text-zr-error">
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
