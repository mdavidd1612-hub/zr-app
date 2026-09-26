'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "Por Examen" -- pedido explícito del coordinador (sept. 2026). Registro de
 * exámenes que el profesor califica A MANO (distinto de `exams`/
 * `exam_attempts`, el examen digital autocalificado). Dirección Académica
 * solo define módulo/fecha/título/escala/mínimo aprobatorio -- nunca una
 * nota por estudiante, eso lo llena el profesor.
 */

interface Modulo {
  id: string
  nombre: string
  programa: string
}

interface Examen {
  id: string
  moduleId: string
  moduloNombre: string
  examDate: string
  title: string
  scaleMax: number
  passingMin: number
}

export default function ExamenesManuales() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [moduloId, setModuloId] = useState('')
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

      const [{ data: mods }, { data: exs }] = await Promise.all([
        supabase.from('modules').select('id, name, order_index, programs(name)').order('order_index'),
        supabase
          .from('manual_exam_definitions')
          .select('id, module_id, exam_date, title, scale_max, passing_min, modules(name)')
          .order('exam_date', { ascending: false }),
      ])

      if (!vigente) return

      type ModuloCrudo = { id: string; name: string; programs: { name: string } | null }
      setModulos(
        ((mods ?? []) as unknown as ModuloCrudo[]).map((m) => ({
          id: m.id,
          nombre: m.name,
          programa: m.programs?.name ?? '',
        })),
      )

      type ExamenCrudo = {
        id: string; module_id: string; exam_date: string; title: string
        scale_max: number; passing_min: number; modules: { name: string } | null
      }
      setExamenes(
        ((exs ?? []) as unknown as ExamenCrudo[]).map((e) => ({
          id: e.id,
          moduleId: e.module_id,
          moduloNombre: e.modules?.name ?? '—',
          examDate: e.exam_date,
          title: e.title,
          scaleMax: Number(e.scale_max),
          passingMin: Number(e.passing_min),
        })),
      )
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function crearExamen() {
    if (!moduloId || !fecha || !titulo.trim()) {
      setError('Módulo, fecha y título son obligatorios.')
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
      })
      .select('id, module_id, exam_date, title, scale_max, passing_min, modules(name)')
      .single()

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    const fila = data as unknown as {
      id: string; module_id: string; exam_date: string; title: string
      scale_max: number; passing_min: number; modules: { name: string } | null
    }
    setExamenes((ex) => [
      {
        id: fila.id,
        moduleId: fila.module_id,
        moduloNombre: fila.modules?.name ?? '—',
        examDate: fila.exam_date,
        title: fila.title,
        scaleMax: Number(fila.scale_max),
        passingMin: Number(fila.passing_min),
      },
      ...ex,
    ])
    setTitulo('')
    setFecha('')
    setGuardando(false)
  }

  async function borrarExamen(id: string) {
    const supabase = createClient()
    const { error: fallo } = await supabase.from('manual_exam_definitions').delete().eq('id', id)
    if (!fallo) setExamenes((ex) => ex.filter((e) => e.id !== id))
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
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Por Examen</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Registra el examen; el profesor pone la nota de cada estudiante en su propia pantalla.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      <div className="zr-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Nuevo examen</p>

        <select
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
        >
          <option value="">Módulo…</option>
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>{m.programa} — {m.nombre}</option>
          ))}
        </select>

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
          onClick={crearExamen}
          disabled={guardando}
          className="w-full rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Registrar examen'}
        </button>
      </div>

      <div className="space-y-3">
        {examenes.map((e) => (
          <div key={e.id} className="zr-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-zr-text">{e.title}</p>
              <p className="text-xs text-zr-text-muted">
                {e.moduloNombre} · {e.examDate} · Escala {e.scaleMax} · Mínimo {e.passingMin}
              </p>
            </div>
            <button onClick={() => borrarExamen(e.id)} className="text-xs font-bold text-zr-error">
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
