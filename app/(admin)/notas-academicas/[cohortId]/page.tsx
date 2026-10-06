'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "Ver calificaciones" -- Dirección Académica. Solo lectura de las notas:
 * teoría y práctica se calculan solas desde "Registrar Evaluación"
 * (fn_recalc_evaluacion_general, migración 110) y puntualidad desde la
 * asistencia (fn_recalc_puntualidad). Nadie edita aquí.
 *
 * Reunión de sept. 2026: tabla compacta tipo Excel, con filtro por Módulo
 * (cualquiera de la malla del programa) y por Tipo de evaluación
 * (Examen / Práctica / Otro). Dirección Académica ve la nota GENERAL por
 * estudiante, no el detalle de cada examen -- ese es del profesor. Y aquí se
 * VALIDA lo que el profesor envió (migración 126): hasta entonces el
 * estudiante no ve nada.
 */

interface FilaNota {
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  puntualidad: number | null
  participacionClase: number | null
  finalScore: number | null
  status: string | null
}

interface Modulo { id: string; nombre: string; orden: number }
interface Envio { status: 'enviado' | 'validado'; submittedAt: string; validatedAt: string | null }
type Tipo = 'todos' | 'examen' | 'practica' | 'otro'

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(v % 1 === 0 ? 0 : 1))

const CAMPO =
  'w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none'

export default function VerCalificacionesCohorte() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohorteNombre, setCohorteNombre] = useState('')
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [filas, setFilas] = useState<FilaNota[]>([])
  const [otros, setOtros] = useState<{ id: string; titulo: string }[]>([])
  const [notasOtros, setNotasOtros] = useState<Record<string, Record<string, number>>>({})
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [accionando, setAccionando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // 1) Autorización + datos de la cohorte y la malla de su programa
  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function iniciar() {
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

      const { data: cohorte } = await supabase
        .from('cohorts').select('name, current_module_id, program_id').eq('id', cohortId).single()
      if (!vigente) return
      setCohorteNombre(cohorte?.name ?? '')
      if (!cohorte) { setCargando(false); return }

      const { data: mods } = await supabase
        .from('modules').select('id, name, order_index').eq('program_id', cohorte.program_id).order('order_index')
      if (!vigente) return
      setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index })))
      setModuleId(cohorte.current_module_id ?? mods?.[0]?.id ?? null)
      if (!cohorte.current_module_id && !mods?.length) setCargando(false)
    }

    iniciar()
    return () => { vigente = false }
  }, [router, cohortId])

  // 2) Notas del módulo elegido
  useEffect(() => {
    if (!moduleId || autorizado !== true) return
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      setCargando(true)
      const [{ data: estudiantes }, { data: notas }, { data: sub }, { data: defsOtro }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('student_id, theory_score, practice_score, participation_score, class_participation_score, final_score, status')
          .eq('cohort_id', cohortId)
          .eq('module_id', moduleId as string),
        supabase
          .from('grade_submissions')
          .select('status, submitted_at, validated_at')
          .eq('cohort_id', cohortId)
          .eq('module_id', moduleId as string)
          .maybeSingle(),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, kind_detail')
          .eq('module_id', moduleId as string)
          .eq('kind', 'otro')
          .order('exam_date'),
      ])

      const idsOtro = (defsOtro ?? []).map((d) => d.id)
      const { data: scoresOtro } = idsOtro.length
        ? await supabase.from('manual_exam_scores').select('definition_id, student_id, score').in('definition_id', idsOtro)
        : { data: [] }

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type NotaCruda = {
        student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; class_participation_score: number | null
        final_score: number | null; status: string | null
      }
      const porEstudiante = new Map(((notas ?? []) as unknown as NotaCruda[]).map((n) => [n.student_id, n]))

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[])
          .map((e) => {
            const n = porEstudiante.get(e.id)
            return {
              studentId: e.id,
              nombre: e.profiles?.full_name ?? '—',
              cedula: e.profiles?.cedula ?? '—',
              theory: n?.theory_score ?? null,
              practice: n?.practice_score ?? null,
              puntualidad: n?.participation_score ?? null,
              participacionClase: n?.class_participation_score ?? null,
              finalScore: n?.final_score ?? null,
              status: n?.status ?? null,
            }
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      )
      setOtros((defsOtro ?? []).map((d) => ({ id: d.id, titulo: d.kind_detail ? `${d.title} (${d.kind_detail})` : d.title })))
      const mapa: Record<string, Record<string, number>> = {}
      for (const s of (scoresOtro ?? []) as { definition_id: string; student_id: string; score: number }[]) {
        ;(mapa[s.student_id] ??= {})[s.definition_id] = Number(s.score)
      }
      setNotasOtros(mapa)
      setEnvio(sub ? { status: sub.status as Envio['status'], submittedAt: sub.submitted_at, validatedAt: sub.validated_at } : null)
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [cohortId, moduleId, autorizado, version])

  async function ejecutar(accion: 'validar_notas' | 'devolver_notas', confirmacion: string) {
    if (!moduleId || !confirm(confirmacion)) return
    setAccionando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc(accion, { p_cohort: cohortId, p_module: moduleId })
    setAccionando(false)
    if (fallo) { setError(fallo.message); return }
    setVersion((v) => v + 1)
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
        <p className="text-sm text-zr-text-muted">Cargando calificaciones…</p>
      </div>
    )
  }

  const columnas: { clave: string; titulo: string; valor: (f: FilaNota) => string }[] =
    tipo === 'examen' ? [{ clave: 't', titulo: 'Teoría (exámenes)', valor: (f) => fmt(f.theory) }]
    : tipo === 'practica' ? [{ clave: 'p', titulo: 'Práctica', valor: (f) => fmt(f.practice) }]
    : tipo === 'otro' ? otros.map((o) => ({
        clave: o.id,
        titulo: o.titulo,
        valor: (f: FilaNota) => fmt(notasOtros[f.studentId]?.[o.id] ?? null),
      }))
    : [
        { clave: 't', titulo: 'Teoría', valor: (f) => fmt(f.theory) },
        { clave: 'p', titulo: 'Práctica', valor: (f) => fmt(f.practice) },
        { clave: 'pt', titulo: 'Puntualidad', valor: (f) => fmt(f.puntualidad) },
        { clave: 'pa', titulo: 'Participación', valor: (f) => fmt(f.participacionClase) },
      ]

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica · Ver calificaciones
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{cohorteNombre}</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Teoría y práctica se calculan solas desde &ldquo;Registrar Evaluación&rdquo;; puntualidad
          desde la asistencia. Nada de esto se edita aquí.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Módulo</label>
          <select value={moduleId ?? ''} onChange={(e) => setModuleId(e.target.value)} className={CAMPO}>
            {modulos.map((m) => (
              <option key={m.id} value={m.id}>Módulo {m.orden} · {m.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className={CAMPO}>
            <option value="todos">Todo</option>
            <option value="examen">Examen</option>
            <option value="practica">Práctica</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      {/* Estado del envío del profesor y validación */}
      {!envio && (
        <p className="rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm text-zr-text-muted">
          El profesor todavía no envió las notas de este módulo. Los estudiantes no ven nada.
        </p>
      )}
      {envio?.status === 'enviado' && (
        <div className="space-y-3 rounded-lg border border-zr-warning/40 bg-zr-warning/10 p-4">
          <p className="text-sm font-semibold text-zr-text">
            Notas enviadas el {new Date(envio.submittedAt).toLocaleDateString('es-VE')} — pendientes de tu validación.
          </p>
          <p className="text-xs text-zr-text-muted">Los estudiantes las verán cuando las valides.</p>
          <div className="flex gap-2">
            <button
              onClick={() => ejecutar('validar_notas', '¿Validar estas notas? Los estudiantes las verán de inmediato.')}
              disabled={accionando}
              className="min-h-11 flex-1 rounded-lg bg-zr-success text-sm font-bold text-white disabled:opacity-50"
            >
              Validar y publicar
            </button>
            <button
              onClick={() => ejecutar('devolver_notas', '¿Devolver las notas al profesor para que las corrija?')}
              disabled={accionando}
              className="min-h-11 flex-1 rounded-lg border border-zr-error/40 text-sm font-bold text-zr-error disabled:opacity-50"
            >
              Devolver al profesor
            </button>
          </div>
        </div>
      )}
      {envio?.status === 'validado' && (
        <div className="space-y-2 rounded-lg border border-zr-success/30 bg-zr-success/10 p-4">
          <p className="text-sm font-semibold text-zr-success">
            Validadas{envio.validatedAt ? ` el ${new Date(envio.validatedAt).toLocaleDateString('es-VE')}` : ''}. Los estudiantes ya las ven.
          </p>
          <button
            onClick={() => ejecutar('devolver_notas', 'Esto oculta las notas a los estudiantes y las devuelve al profesor. ¿Continuar?')}
            disabled={accionando}
            className="text-xs font-bold text-zr-error underline disabled:opacity-50"
          >
            Retirar validación y devolver al profesor
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      ) : !moduleId ? (
        <EstadoVacio titulo="Sin módulos" explicacion="Este programa no tiene módulos cargados." />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : tipo === 'otro' && otros.length === 0 ? (
        <EstadoVacio titulo="Sin evaluaciones de tipo Otro" explicacion="En este módulo no se registró ninguna." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zr-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zr-surface">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                  Estudiante
                </th>
                {columnas.map((c) => (
                  <th key={c.clave} className="min-w-[88px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">
                    {c.titulo}
                  </th>
                ))}
                {tipo === 'todos' && (
                  <>
                    <th className="min-w-[70px] border-b border-l border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Nota</th>
                    <th className="min-w-[90px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Estado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                  <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-3 py-2">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </td>
                  {columnas.map((c) => (
                    <td key={c.clave} className="px-2 py-2 text-center text-zr-text">{c.valor(f)}</td>
                  ))}
                  {tipo === 'todos' && (
                    <>
                      <td className="border-l border-zr-border px-2 py-2 text-center font-bold text-zr-blue">{fmt(f.finalScore)}</td>
                      <td
                        className={`px-2 py-2 text-center text-xs font-semibold ${
                          f.status === 'aprobado' ? 'text-zr-success' : f.status === 'reprobado' ? 'text-zr-error' : 'text-zr-text-muted'
                        }`}
                      >
                        {f.status === 'aprobado' ? 'Aprobado' : f.status === 'reprobado' ? 'Reprobado' : f.status ? 'En curso' : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
