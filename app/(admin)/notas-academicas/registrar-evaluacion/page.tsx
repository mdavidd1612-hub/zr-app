'use client'

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
}

interface Evaluacion {
  id: string
  moduleId: string
  moduloNombre: string
  examDate: string
  title: string
  scaleMax: number
  passingMin: number
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
  scale_max: number; passing_min: number; kind: string; kind_detail: string | null
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
    kind: e.kind as Evaluacion['kind'],
    kindDetail: e.kind_detail,
  }
}

const COLUMNAS = 'id, module_id, exam_date, title, scale_max, passing_min, kind, kind_detail, modules(name)'

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

      const [{ data: cohs }, { data: mods }, { data: exs }] = await Promise.all([
        supabase.from('cohorts').select('id, name, program_id').eq('status', 'activa').order('name'),
        supabase.from('modules').select('id, name, order_index, program_id').order('order_index'),
        supabase.from('manual_exam_definitions').select(COLUMNAS).order('exam_date', { ascending: false }),
      ])
      if (!vigente) return

      setCohortes((cohs ?? []).map((c) => ({ id: c.id, nombre: c.name, programId: c.program_id })))
      setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index, programId: m.program_id })))
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

  async function crear() {
    if (!titulo.trim() || !cohorteId || !moduloId || !fecha) {
      setError('El nombre, el programa, el módulo y la fecha son obligatorios.')
      return
    }
    if (kind === 'otro' && !kindDetail.trim()) {
      setError('Escribe de qué se trata la evaluación de tipo "Otro".')
      return
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fallo } = await supabase
      .from('manual_exam_definitions')
      .insert({
        module_id: moduloId,
        exam_date: fecha,
        title: titulo.trim(),
        scale_max: Number(escala) || 20,
        passing_min: Number(minimo) || 12,
        kind,
        kind_detail: kind === 'otro' ? kindDetail.trim() : null,
      })
      .select(COLUMNAS)
      .single()

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    setEvaluaciones((ex) => [aEvaluacion(data as unknown as ExamenCrudo), ...ex])
    // Programa y módulo se conservan: lo normal es cargar varias seguidas.
    setTitulo('')
    setKindDetail('')
    setFecha('')
    setGuardando(false)
  }

  async function borrar(id: string) {
    const supabase = createClient()
    const { error: fallo } = await supabase.from('manual_exam_definitions').delete().eq('id', id)
    if (!fallo) setEvaluaciones((ex) => ex.filter((e) => e.id !== id))
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
          su propia pantalla — teoría y práctica del módulo se calculan solas a partir de esto.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      <div className="zr-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Nueva evaluación</p>

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
          <select
            value={cohorteId}
            onChange={(e) => { setCohorteId(e.target.value); setModuloId('') }}
            className={CAMPO}
          >
            <option value="">Elige el programa…</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Módulo</label>
          <select
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
            disabled={!cohorteId}
            className={`${CAMPO} disabled:opacity-50`}
          >
            <option value="">{cohorteId ? 'Elige el módulo…' : 'Primero elige el programa'}</option>
            {modulosForm.map((m) => (
              <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>
            ))}
          </select>
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

        <button
          onClick={crear}
          disabled={guardando}
          className="w-full rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Registrar'}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">
          Evaluaciones registradas ({visibles.length})
        </p>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={filtroCohorteId}
            onChange={(e) => { setFiltroCohorteId(e.target.value); setFiltroModuloId('') }}
            className={CAMPO}
          >
            <option value="">Todos los programas</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <select
            value={filtroModuloId}
            onChange={(e) => setFiltroModuloId(e.target.value)}
            disabled={!filtroCohorteId}
            className={`${CAMPO} disabled:opacity-50`}
          >
            <option value="">Todos los módulos</option>
            {modulosFiltro.map((m) => (
              <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>
            ))}
          </select>
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
                {e.moduloNombre} · {e.examDate} · Escala {e.scaleMax} · Mínimo {e.passingMin}
              </p>
            </div>
            <button onClick={() => borrar(e.id)} className="shrink-0 text-xs font-bold text-zr-error">
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
