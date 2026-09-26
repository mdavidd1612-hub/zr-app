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
 * El selector ya NO lista todos los módulos de la historia (lista gigante,
 * pedido explícito de corregir) -- lista las COHORTES ACTIVAS (ej. "PTMA
 * 2026-II") con una etiqueta del módulo que están cursando ahora, y de ahí
 * se toma el módulo real.
 */

interface CohorteActiva {
  id: string
  nombre: string
  moduloId: string
  moduloNombre: string
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
}

const ETIQUETA_KIND: Record<Evaluacion['kind'], string> = {
  examen: 'Examen',
  practica: 'Práctica',
  otro: 'Otro',
}

export default function RegistrarEvaluacion() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohortes, setCohortes] = useState<CohorteActiva[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [cohorteId, setCohorteId] = useState('')
  const [kind, setKind] = useState<Evaluacion['kind']>('examen')
  const [fecha, setFecha] = useState('')
  const [titulo, setTitulo] = useState('')
  const [escala, setEscala] = useState('20')
  const [minimo, setMinimo] = useState('12')

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

      const [{ data: cohs }, { data: exs }] = await Promise.all([
        supabase
          .from('cohorts')
          .select('id, name, current_module_id, modules(name)')
          .eq('status', 'activa')
          .not('current_module_id', 'is', null)
          .order('name'),
        supabase
          .from('manual_exam_definitions')
          .select('id, module_id, exam_date, title, scale_max, passing_min, kind, modules(name)')
          .order('exam_date', { ascending: false }),
      ])

      if (!vigente) return

      type CohorteCruda = { id: string; name: string; current_module_id: string; modules: { name: string } | null }
      setCohortes(
        ((cohs ?? []) as unknown as CohorteCruda[]).map((c) => ({
          id: c.id,
          nombre: c.name,
          moduloId: c.current_module_id,
          moduloNombre: c.modules?.name ?? '—',
        })),
      )

      type ExamenCrudo = {
        id: string; module_id: string; exam_date: string; title: string
        scale_max: number; passing_min: number; kind: string; modules: { name: string } | null
      }
      setEvaluaciones(
        ((exs ?? []) as unknown as ExamenCrudo[]).map((e) => ({
          id: e.id,
          moduleId: e.module_id,
          moduloNombre: e.modules?.name ?? '—',
          examDate: e.exam_date,
          title: e.title,
          scaleMax: Number(e.scale_max),
          passingMin: Number(e.passing_min),
          kind: e.kind as Evaluacion['kind'],
        })),
      )
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function crear() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    if (!cohorte || !fecha || !titulo.trim()) {
      setError('Cohorte, fecha y título son obligatorios.')
      return
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fallo } = await supabase
      .from('manual_exam_definitions')
      .insert({
        module_id: cohorte.moduloId,
        exam_date: fecha,
        title: titulo.trim(),
        scale_max: Number(escala) || 20,
        passing_min: Number(minimo) || 12,
        kind,
      })
      .select('id, module_id, exam_date, title, scale_max, passing_min, kind, modules(name)')
      .single()

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    const fila = data as unknown as {
      id: string; module_id: string; exam_date: string; title: string
      scale_max: number; passing_min: number; kind: string; modules: { name: string } | null
    }
    setEvaluaciones((ex) => [
      {
        id: fila.id,
        moduleId: fila.module_id,
        moduloNombre: fila.modules?.name ?? '—',
        examDate: fila.exam_date,
        title: fila.title,
        scaleMax: Number(fila.scale_max),
        passingMin: Number(fila.passing_min),
        kind: fila.kind as Evaluacion['kind'],
      },
      ...ex,
    ])
    setTitulo('')
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

        <select
          value={cohorteId}
          onChange={(e) => setCohorteId(e.target.value)}
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        >
          <option value="">Programa…</option>
          {cohortes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} — {c.moduloNombre}</option>
          ))}
        </select>

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

        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />

        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder='Ej. "Examen 2 Instrumentación"'
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Escala</label>
            <input
              type="number"
              value={escala}
              onChange={(e) => setEscala(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Mínimo aprobatorio</label>
            <input
              type="number"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none"
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
        {evaluaciones.map((e) => (
          <div key={e.id} className="zr-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-zr-text">
                {e.title} <span className="text-xs font-normal text-zr-text-muted">· {ETIQUETA_KIND[e.kind]}</span>
              </p>
              <p className="text-xs text-zr-text-muted">
                {e.moduloNombre} · {e.examDate} · Escala {e.scaleMax} · Mínimo {e.passingMin}
              </p>
            </div>
            <button onClick={() => borrar(e.id)} className="text-xs font-bold text-zr-error">
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
