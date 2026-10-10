'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * Calificaciones de una cohorte -- Dirección Académica. Pedido del
 * coordinador (oct. 2026): ver el cuadro COMPLETO, igual que lo ve el
 * profesor -- una columna por cada examen y práctica, no solo las notas
 * generales -- y poder editarlo. Teoría, práctica y nota final siguen siendo
 * de solo lectura (las calcula el servidor); se editan las notas de cada
 * evaluación, la participación y la puntualidad (que sale sola de la
 * asistencia, pero se puede escribir a mano; si se borra, vuelve a ser
 * automática).
 *
 * Aquí también se VALIDA lo que el profesor envió (migración 126): hasta
 * entonces el estudiante no ve nada. Filtros por Módulo y por Tipo de
 * evaluación (Examen / Práctica / Otro).
 */

interface FilaNota {
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  puntualidad: number | null
  puntualidadManual: number | null
  sabadosContados: number | null
  sabadosTotal: number | null
  participacionClase: number | null
  finalScore: number | null
  status: string | null
}

interface Evaluacion { id: string; titulo: string; kind: 'examen' | 'practica' | 'otro'; detalle: string | null; scaleMax: number }
interface Modulo { id: string; nombre: string; orden: number }
interface Envio { status: 'enviado' | 'validado'; submittedAt: string; validatedAt: string | null }
type Tipo = 'todos' | 'examen' | 'practica' | 'otro'

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(v % 1 === 0 ? 0 : 1))
const ABREV: Record<string, string> = { examen: 'Ex', practica: 'Pr', otro: 'Ot' }

const CAMPO =
  'w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none'
const CELDA =
  'w-16 rounded border border-zr-border bg-zr-bg px-1 py-1.5 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none disabled:opacity-60'

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
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [notas, setNotas] = useState<Record<string, Record<string, number | null>>>({})
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [accionando, setAccionando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)
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

  // 2) Cuadro del módulo elegido
  useEffect(() => {
    if (!moduleId || autorizado !== true) return
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      setCargando(true)
      const [{ data: estudiantes }, { data: matriculas }, { data: sub }, { data: defs }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('student_id, theory_score, practice_score, participation_score, class_participation_score, final_score, status, puntualidad_manual, puntualidad_sabados, puntualidad_sabados_total')
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
          .select('id, title, kind, kind_detail, scale_max, exam_date')
          .eq('module_id', moduleId as string)
          .order('exam_date'),
      ])

      const idsDefs = (defs ?? []).map((d) => d.id)
      const { data: scores } = idsDefs.length
        ? await supabase.from('manual_exam_scores').select('definition_id, student_id, score').in('definition_id', idsDefs)
        : { data: [] }

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type MatriculaCruda = {
        student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; class_participation_score: number | null
        final_score: number | null; status: string | null
        puntualidad_manual: number | null; puntualidad_sabados: number | null; puntualidad_sabados_total: number | null
      }
      const porEstudiante = new Map(((matriculas ?? []) as unknown as MatriculaCruda[]).map((n) => [n.student_id, n]))

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
              puntualidadManual: n?.puntualidad_manual ?? null,
              sabadosContados: n?.puntualidad_sabados ?? null,
              sabadosTotal: n?.puntualidad_sabados_total ?? null,
              participacionClase: n?.class_participation_score ?? null,
              finalScore: n?.final_score ?? null,
              status: n?.status ?? null,
            }
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      )
      setEvaluaciones((defs ?? []).map((d) => ({
        id: d.id, titulo: d.title, kind: d.kind as Evaluacion['kind'], detalle: d.kind_detail, scaleMax: Number(d.scale_max),
      })))
      const mapa: Record<string, Record<string, number | null>> = {}
      for (const s of (scores ?? []) as { definition_id: string; student_id: string; score: number }[]) {
        ;(mapa[s.student_id] ??= {})[s.definition_id] = Number(s.score)
      }
      setNotas(mapa)
      setEnvio(sub ? { status: sub.status as Envio['status'], submittedAt: sub.submitted_at, validatedAt: sub.validated_at } : null)
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [cohortId, moduleId, autorizado, version])

  // El servidor recalcula teoría/práctica/nota: se vuelven a leer, nunca se suman aquí.
  async function releer(studentId: string) {
    if (!moduleId) return
    const { data } = await createClient()
      .from('module_enrollments')
      .select('theory_score, practice_score, participation_score, final_score, status, puntualidad_sabados, puntualidad_sabados_total')
      .eq('student_id', studentId).eq('cohort_id', cohortId).eq('module_id', moduleId)
      .maybeSingle()
    if (!data) return
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? {
          ...f, theory: data.theory_score, practice: data.practice_score, puntualidad: data.participation_score,
          finalScore: data.final_score, status: data.status,
          sabadosContados: data.puntualidad_sabados, sabadosTotal: data.puntualidad_sabados_total,
        }
      : f))
  }

  async function guardarNota(studentId: string, ev: Evaluacion, texto: string) {
    const previo = notas[studentId]?.[ev.id] ?? null
    const valor = texto.trim() === '' ? null : parseFloat(texto.replace(',', '.'))
    if (valor !== null && (Number.isNaN(valor) || valor < 0 || valor > ev.scaleMax)) {
      setError(`La nota de "${ev.titulo}" debe estar entre 0 y ${ev.scaleMax}.`)
      return
    }
    if (valor === previo) return
    setGuardando(`${studentId}:${ev.id}`)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = valor === null
      ? await supabase.from('manual_exam_scores').delete().eq('definition_id', ev.id).eq('student_id', studentId)
      : await supabase.from('manual_exam_scores')
          .upsert({ definition_id: ev.id, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })
    if (fallo) { setError(fallo.message); setGuardando(null); return }
    setNotas((n) => ({ ...n, [studentId]: { ...n[studentId], [ev.id]: valor } }))
    await releer(studentId)
    setGuardando(null)
  }

  async function guardarCampo(studentId: string, campo: 'class_participation_score' | 'puntualidad_manual', texto: string) {
    if (!moduleId) return
    const valor = texto.trim() === '' ? null : parseFloat(texto.replace(',', '.'))
    if (valor !== null && (Number.isNaN(valor) || valor < 0 || valor > 20)) {
      setError('El valor debe estar entre 0 y 20.')
      return
    }
    // La participación no se puede dejar en blanco (no hay "automática").
    if (campo === 'class_participation_score' && valor === null) return
    setGuardando(`${studentId}:${campo}`)
    setError(null)
    const { error: fallo } = await createClient()
      .from('module_enrollments')
      .update(campo === 'puntualidad_manual' ? { puntualidad_manual: valor } : { class_participation_score: valor })
      .eq('student_id', studentId).eq('cohort_id', cohortId).eq('module_id', moduleId)
    if (fallo) { setError(fallo.message); setGuardando(null); return }
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? campo === 'puntualidad_manual' ? { ...f, puntualidadManual: valor } : { ...f, participacionClase: valor }
      : f))
    await releer(studentId)
    setGuardando(null)
  }

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

  const visibles = tipo === 'todos' ? evaluaciones : evaluaciones.filter((e) => e.kind === tipo)
  const mostrarTeoria = tipo === 'todos' || tipo === 'examen'
  const mostrarPractica = tipo === 'todos' || tipo === 'practica'
  const mostrarResto = tipo === 'todos'

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica · Calificaciones
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{cohorteNombre}</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          El cuadro completo: una columna por cada examen y práctica. Puedes editar las notas, la
          participación y la puntualidad. Teoría, práctica y nota final se calculan solas. La
          puntualidad sale de la asistencia; si la escribes tú, queda como manual, y si la borras
          vuelve a ser automática.
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
            Validadas{envio.validatedAt ? ` el ${new Date(envio.validatedAt).toLocaleDateString('es-VE')}` : ''}. Los estudiantes ya las ven
            (y verán al instante cualquier cambio que hagas aquí).
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
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zr-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zr-surface">
                <th className="sticky left-0 z-10 min-w-[170px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                  Estudiante
                </th>
                {visibles.map((ev) => (
                  <th key={ev.id} className="min-w-[88px] border-b border-zr-border px-2 py-2 text-center align-bottom">
                    <span className="block text-xs font-bold text-zr-text">{ev.titulo}</span>
                    <span className="block text-[10px] font-normal text-zr-text-muted">
                      {ev.kind === 'otro' && ev.detalle ? ev.detalle : ABREV[ev.kind]} · /{ev.scaleMax}
                    </span>
                  </th>
                ))}
                {mostrarTeoria && <th className="min-w-[64px] border-b border-l border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Teoría</th>}
                {mostrarPractica && <th className="min-w-[64px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Práctica</th>}
                {mostrarResto && (
                  <>
                    <th className="min-w-[96px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Puntualidad</th>
                    <th className="min-w-[96px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Participación</th>
                    <th className="min-w-[64px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Nota</th>
                    <th className="min-w-[84px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Estado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                  <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-3 py-2">
                    <p className="break-words text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </td>
                  {visibles.map((ev) => (
                    <td key={ev.id} className="px-2 py-2 text-center">
                      <input
                        key={`${f.studentId}-${ev.id}-${notas[f.studentId]?.[ev.id] ?? ''}`}
                        type="number" inputMode="decimal" min={0} max={ev.scaleMax} step={0.5}
                        defaultValue={notas[f.studentId]?.[ev.id] ?? ''}
                        onBlur={(e) => guardarNota(f.studentId, ev, e.target.value)}
                        disabled={guardando === `${f.studentId}:${ev.id}`}
                        className={CELDA}
                      />
                    </td>
                  ))}
                  {mostrarTeoria && <td className="border-l border-zr-border px-2 py-2 text-center text-zr-text">{fmt(f.theory)}</td>}
                  {mostrarPractica && <td className="px-2 py-2 text-center text-zr-text">{fmt(f.practice)}</td>}
                  {mostrarResto && (
                    <>
                      <td className="px-2 py-2 text-center">
                        <input
                          key={`${f.studentId}-pun-${f.puntualidadManual ?? ''}-${f.puntualidad ?? ''}`}
                          type="number" inputMode="decimal" min={0} max={20} step={0.5}
                          defaultValue={f.puntualidadManual ?? ''}
                          placeholder={f.puntualidad !== null ? fmt(f.puntualidad) : '—'}
                          onBlur={(e) => guardarCampo(f.studentId, 'puntualidad_manual', e.target.value)}
                          disabled={guardando === `${f.studentId}:puntualidad_manual`}
                          className={CELDA}
                        />
                        <p className="mt-0.5 text-[10px] leading-tight text-zr-text-muted">
                          {f.puntualidadManual !== null ? 'manual' : 'automática'}
                          {f.sabadosTotal ? ` · ${f.sabadosContados ?? 0} de ${f.sabadosTotal} sáb.` : ''}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          key={`${f.studentId}-part-${f.participacionClase ?? ''}`}
                          type="number" inputMode="decimal" min={0} max={20} step={0.5}
                          defaultValue={f.participacionClase ?? ''}
                          onBlur={(e) => guardarCampo(f.studentId, 'class_participation_score', e.target.value)}
                          disabled={guardando === `${f.studentId}:class_participation_score`}
                          className={CELDA}
                        />
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-zr-blue">{fmt(f.finalScore)}</td>
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
