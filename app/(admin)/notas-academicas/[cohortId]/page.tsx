'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

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
 * Reunión de oct. 2026 (migración 143): cada evaluación vale un porcentaje, ya
 * no hay Teoría / Práctica / Puntualidad como notas, y "Devolver al profesor"
 * pide un motivo que el profesor ve.
 *
 * Aquí también se VALIDA lo que el profesor envió (migración 126): hasta
 * entonces el estudiante no ve nada. Filtros por Módulo y por Tipo de
 * evaluación (Examen / Práctica / Otro).
 */

interface FilaNota {
  studentId: string
  nombre: string
  cedula: string
  finalScore: number | null
  evaluadoPct: number
  umbral: number
  status: string | null
}

interface Evaluacion { id: string; titulo: string; kind: 'examen' | 'practica' | 'prepractica' | 'exposicion' | 'participacion' | 'otro'; detalle: string | null; scaleMax: number; passingMin: number; pesoPct: number }
interface Modulo { id: string; nombre: string; orden: number }
interface Envio { status: 'enviado' | 'validado' | 'devuelto'; submittedAt: string; validatedAt: string | null; motivo: string | null }
type Tipo = 'todos' | 'examen' | 'practica' | 'prepractica' | 'exposicion' | 'participacion' | 'otro'

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(2))
const ABREV: Record<string, string> = { examen: 'Examen', practica: 'Práctica', prepractica: 'Pre-práctica', exposicion: 'Exposición', participacion: 'Participación', otro: 'Otro' }

const CAMPO =
  'w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none'
const CELDA =
  'w-16 rounded border border-zr-border bg-zr-bg px-1 py-1.5 text-center text-sm focus:border-zr-blue focus:outline-none disabled:opacity-60'

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
  const [devolviendo, setDevolviendo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Evaluaciones con notas que Dirección tocó (o que aún no valida) y los estudiantes todavía no ven.
  const [sinPublicar, setSinPublicar] = useState(0)

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
          .select('student_id, final_score, evaluated_pct, passing_threshold, status')
          .eq('cohort_id', cohortId)
          .eq('module_id', moduleId as string),
        supabase
          .from('grade_submissions')
          .select('status, submitted_at, validated_at, return_reason')
          .eq('cohort_id', cohortId)
          .eq('module_id', moduleId as string)
          .maybeSingle(),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, kind, kind_detail, scale_max, passing_min, weight_pct, exam_date')
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
        student_id: string
        final_score: number | null; status: string | null
        evaluated_pct: number; passing_threshold: number
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
              finalScore: n?.final_score === null || n?.final_score === undefined ? null : Number(n.final_score),
              evaluadoPct: Number(n?.evaluated_pct ?? 0),
              umbral: Number(n?.passing_threshold ?? 12),
              status: n?.status ?? null,
            }
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      )
      setEvaluaciones((defs ?? []).map((d) => ({
        id: d.id, titulo: d.title, kind: d.kind as Evaluacion['kind'], detalle: d.kind_detail, scaleMax: Number(d.scale_max),
        passingMin: Number(d.passing_min), pesoPct: Number(d.weight_pct),
      })))
      const mapa: Record<string, Record<string, number | null>> = {}
      for (const s of (scores ?? []) as { definition_id: string; student_id: string; score: number }[]) {
        ;(mapa[s.student_id] ??= {})[s.definition_id] = Number(s.score)
      }
      setNotas(mapa)
      setEnvio(sub ? { status: sub.status as Envio['status'], submittedAt: sub.submitted_at, validatedAt: sub.validated_at, motivo: sub.return_reason } : null)
      void contarSinPublicar()
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [cohortId, moduleId, autorizado, version])

  // El servidor recalcula la nota: se vuelve a leer, nunca se suma aquí.
  async function releer(studentId: string) {
    if (!moduleId) return
    const { data } = await createClient()
      .from('module_enrollments')
      .select('final_score, evaluated_pct, status')
      .eq('student_id', studentId).eq('cohort_id', cohortId).eq('module_id', moduleId)
      .maybeSingle()
    if (!data) return
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? { ...f, finalScore: data.final_score === null ? null : Number(data.final_score), evaluadoPct: Number(data.evaluated_pct), status: data.status }
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
    void contarSinPublicar()
    setGuardando(null)
  }

  async function contarSinPublicar() {
    if (!moduleId) return
    const supabase = createClient()
    const { data: defs } = await supabase.from('manual_exam_definitions').select('id').eq('module_id', moduleId)
    const ids = (defs ?? []).map((d) => d.id)
    if (ids.length === 0) { setSinPublicar(0); return }
    const [{ data: validadas }, { data: conNota }] = await Promise.all([
      supabase.from('grade_validated_evals').select('definition_id').eq('cohort_id', cohortId).eq('module_id', moduleId),
      supabase.from('manual_exam_scores').select('definition_id').in('definition_id', ids),
    ])
    const ok = new Set((validadas ?? []).map((v) => v.definition_id))
    const conNotas = new Set((conNota ?? []).map((n) => n.definition_id))
    setSinPublicar([...conNotas].filter((id) => !ok.has(id)).length)
  }

  async function publicar() {
    if (!moduleId || !confirm('¿Validar y publicar estos cambios? Los estudiantes los verán de inmediato.')) return
    setAccionando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('publicar_cambios', { p_cohort: cohortId, p_module: moduleId })
    setAccionando(false)
    if (fallo) { setError(fallo.message); return }
    setVersion((v) => v + 1)
  }

  async function validar() {
    if (!moduleId || !confirm('¿Validar estas notas? Los estudiantes las verán de inmediato.')) return
    setAccionando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('validar_notas', { p_cohort: cohortId, p_module: moduleId })
    setAccionando(false)
    if (fallo) { setError(fallo.message); return }
    setVersion((v) => v + 1)
  }

  async function devolver() {
    if (!moduleId) return
    if (!motivo.trim()) {
      setError('Escribe qué debe corregir el profesor.')
      return
    }
    setAccionando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('devolver_notas', { p_cohort: cohortId, p_module: moduleId, p_motivo: motivo.trim() })
    setAccionando(false)
    if (fallo) { setError(fallo.message); return }
    setDevolviendo(false)
    setMotivo('')
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
      <PantallaEsqueleto />
    )
  }

  const visibles = tipo === 'todos' ? evaluaciones : evaluaciones.filter((e) => e.kind === tipo)
  const mostrarResto = tipo === 'todos'
  const sumaPct = evaluaciones.reduce((t, e) => t + e.pesoPct, 0)
  // Menos del mínimo en rojo, el mínimo o más en verde (reunión oct. 2026).
  const tonoNota = (v: number | undefined, min: number) =>
    v === undefined ? 'text-zr-text' : v < min ? 'text-zr-error' : 'text-zr-success'

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica · Calificaciones
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{cohorteNombre}</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          El cuadro completo: una columna por cada examen y práctica, con su porcentaje. Puedes editar
          las notas; la nota del módulo se calcula sola.
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
            <option value="prepractica">Pre-práctica</option>
            <option value="exposicion">Exposición</option>
            <option value="participacion">Participación</option>
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
              onClick={validar}
              disabled={accionando}
              className="min-h-11 flex-1 rounded-lg bg-zr-success text-sm font-bold text-white disabled:opacity-50"
            >
              Validar y publicar
            </button>
            <button
              onClick={() => setDevolviendo(true)}
              disabled={accionando}
              className="min-h-11 flex-1 rounded-lg border border-zr-error/40 text-sm font-bold text-zr-error disabled:opacity-50"
            >
              Devolver al profesor
            </button>
          </div>
        </div>
      )}
      {envio?.status === 'devuelto' && (
        <div className="rounded-lg border border-zr-error/30 bg-zr-error/10 p-4 text-sm text-zr-text">
          <p className="font-semibold text-zr-error">Devueltas al profesor para corregir.</p>
          {envio.motivo && <p className="mt-1">{envio.motivo}</p>}
        </div>
      )}
      {envio?.status === 'validado' && (
        <div className="space-y-2 rounded-lg border border-zr-success/30 bg-zr-success/10 p-4">
          <p className="text-sm font-semibold text-zr-success">
            Validadas{envio.validatedAt ? ` el ${new Date(envio.validatedAt).toLocaleDateString('es-VE')}` : ''}. Los estudiantes ya las ven.
            Si cambias una nota, ese cambio no les llega hasta que pulses «Validar y publicar».
          </p>
          <p className="text-xs text-zr-text-muted">
            Si el profesor carga evaluaciones nuevas, solo esas quedan por validar; lo ya validado no se les quita a los estudiantes.
          </p>
        </div>
      )}

      {sinPublicar > 0 && envio?.status !== 'enviado' && (
        <div className="space-y-3 rounded-lg border border-zr-warning/40 bg-zr-warning/10 p-4">
          <p className="text-sm font-semibold text-zr-text">
            {sinPublicar === 1 ? 'Hay 1 evaluación con cambios sin publicar.' : `Hay ${sinPublicar} evaluaciones con cambios sin publicar.`}
          </p>
          <p className="text-xs text-zr-text-muted">
            Los estudiantes no ven esos cambios hasta que revises y pulses «Validar y publicar».
          </p>
          <button
            onClick={publicar}
            disabled={accionando}
            className="min-h-11 w-full rounded-lg bg-zr-success text-sm font-bold text-white disabled:opacity-50"
          >
            Validar y publicar
          </button>
        </div>
      )}

      {!cargando && evaluaciones.length > 0 && Math.round(sumaPct * 100) !== 10000 && (
        <p className="rounded-lg border border-zr-warning/40 bg-zr-warning/10 px-4 py-3 text-sm font-medium text-zr-text">
          Los porcentajes de este módulo suman {sumaPct} % y deben sumar 100 %.
          Ajústalos en Registrar Evaluación; mientras tanto el profesor no puede enviar las notas.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {devolviendo && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-md sm:items-center sm:p-5"
          onClick={() => setDevolviendo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-2xl border border-white/15 bg-zr-surface/85 p-6 pb-8 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-2xl sm:pb-6"
          >
            <p className="zr-display text-xl text-zr-text">Devolver al profesor</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">¿Qué debe corregir?</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                placeholder="Ej. Falta la nota del examen 2 de varios estudiantes."
                className={CAMPO}
              />
              <p className="mt-2 text-xs text-zr-text-muted">
                El profesor recibe este mensaje y las notas dejan de verse para los estudiantes hasta que las vuelva a enviar.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDevolviendo(false)}
                className="min-h-12 flex-1 rounded-lg border border-zr-border text-sm font-bold text-zr-text"
              >
                Cancelar
              </button>
              <button
                onClick={devolver}
                disabled={accionando}
                className="min-h-12 flex-1 rounded-lg bg-zr-error text-sm font-bold text-white disabled:opacity-50"
              >
                Devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      ) : !moduleId ? (
        <EstadoVacio titulo="Sin módulos" explicacion="Este programa no tiene módulos cargados." />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : (
        <div className="max-h-[65dvh] overflow-auto rounded-lg border border-zr-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zr-surface">
                <th className="sticky left-0 top-0 z-20 min-w-[170px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                  Estudiante
                </th>
                {visibles.map((ev) => (
                  <th key={ev.id} className="sticky top-0 z-10 min-w-[88px] border-b border-zr-border bg-zr-surface px-2 py-2 text-center align-bottom">
                    <span className="block text-xs font-bold text-zr-text">{ev.titulo}</span>
                    <span className="block text-[10px] font-normal text-zr-text-muted">
                      {ev.kind === 'otro' && ev.detalle ? ev.detalle : ABREV[ev.kind]} · /{ev.scaleMax} · {ev.pesoPct} %
                    </span>
                  </th>
                ))}
                {mostrarResto && (
                  <>
                    <th className="sticky top-0 z-10 min-w-[84px] border-b border-l border-zr-border bg-zr-surface px-2 py-2.5 text-center align-bottom text-xs font-bold text-zr-text-muted">Nota</th>
                    <th className="sticky top-0 z-10 min-w-[84px] border-b border-zr-border bg-zr-surface px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Estado</th>
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
                        type="text" inputMode="decimal"
                        // Pedido explícito del coordinador (oct. 2026): una celda sin
                        // calificar se veía en blanco, "como que no tiene nada" -- se
                        // ve el mínimo (0.00) de referencia. Es un `placeholder`, no un
                        // valor real: no se guarda nada si el profesor no toca la celda
                        // (si fuera `defaultValue`, con solo entrar y salir de la celda
                        // quedaría guardada una nota de 0 para alguien sin evaluar).
                        placeholder={notas[f.studentId]?.[ev.id] == null ? '0.00' : undefined}
                        defaultValue={notas[f.studentId]?.[ev.id] != null ? fmt(notas[f.studentId][ev.id]) : ''}
                        onBlur={(e) => guardarNota(f.studentId, ev, e.target.value)}
                        disabled={guardando === `${f.studentId}:${ev.id}`}
                        className={`${CELDA} ${tonoNota(notas[f.studentId]?.[ev.id] ?? undefined, ev.passingMin)}`}
                      />
                    </td>
                  ))}
                  {mostrarResto && (
                    <>
                      <td className="border-l border-zr-border px-2 py-2 text-center">
                        {f.finalScore === null ? (
                          // Pedido explícito del coordinador (oct. 2026): sin ninguna
                          // evaluación cargada, se ve el mínimo (0.00), no un guion.
                          <span className={`font-bold ${tonoNota(0, f.umbral)}`}>{fmt(0)}</span>
                        ) : (
                          <>
                            {/* En progreso: puntos ganados de los ya evaluados. Con 100 % evaluado: nota final. */}
                            <span className={`font-bold ${tonoNota(f.finalScore * 100 / Math.max(f.evaluadoPct, 1), f.umbral)}`}>
                              {fmt(f.finalScore)}
                            </span>
                            <span className="block text-[10px] leading-tight text-zr-text-muted">
                              {f.evaluadoPct >= 100 ? 'final' : `de ${fmt(Math.round(f.evaluadoPct * 20) / 100)}`}
                            </span>
                          </>
                        )}
                      </td>
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
