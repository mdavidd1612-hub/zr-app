'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Notas del profesor -- reunión de sept. 2026: UNA sola tabla tipo Excel por
 * programa, con todo el curso en una vista (una columna por cada evaluación
 * que registró Dirección Académica + Teoría, Práctica, Puntualidad,
 * Participación y Nota), en vez de entrar y salir de una pantalla por
 * evaluación. Al terminar, el profesor "Confirma y envía": desde ahí queda
 * bloqueado para él y el estudiante NO ve nada hasta que Dirección Académica
 * lo valide (migración 126).
 *
 * teoría, práctica, puntualidad y nota final se calculan solas en el
 * servidor -- de solo lectura aquí (regla 2 de CLAUDE.md). Lo que el
 * profesor escribe: la nota de cada evaluación y la participación en clase.
 */

interface Evaluacion { id: string; title: string; examDate: string; kind: string; scaleMax: number }

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  puntualidad: number | null
  participacionClase: number | null
  finalScore: number | null
}

interface Envio { status: 'enviado' | 'validado'; submittedAt: string }

const ABREV_KIND: Record<string, string> = { examen: 'Ex', practica: 'Pr', otro: 'Ot' }

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(v % 1 === 0 ? 0 : 1))

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [moduleId, setModuleId] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  // notas[studentId][evalId]
  const [notas, setNotas] = useState<Record<string, Record<string, number | null>>>({})
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: cohorte } = await supabase
        .from('cohorts').select('current_module_id').eq('id', cohortId).single()
      if (!vigente) return
      setModuleId(cohorte?.current_module_id ?? null)
      if (!cohorte?.current_module_id) { setCargando(false); return }
      const modulo = cohorte.current_module_id

      const [{ data: estudiantes }, { data: matriculas }, { data: exs }, { data: sub }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('student_id, theory_score, practice_score, participation_score, class_participation_score, final_score')
          .eq('cohort_id', cohortId)
          .eq('module_id', modulo),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, exam_date, kind, scale_max')
          .eq('module_id', modulo)
          .order('exam_date'),
        supabase
          .from('grade_submissions')
          .select('status, submitted_at')
          .eq('cohort_id', cohortId)
          .eq('module_id', modulo)
          .maybeSingle(),
      ])

      const defs = (exs ?? []) as { id: string; title: string; exam_date: string; kind: string; scale_max: number }[]
      const { data: scores } = defs.length
        ? await supabase.from('manual_exam_scores').select('definition_id, student_id, score').in('definition_id', defs.map((d) => d.id))
        : { data: [] }

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type MatriculaCruda = {
        student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; class_participation_score: number | null; final_score: number | null
      }
      const porEstudiante = new Map(((matriculas ?? []) as unknown as MatriculaCruda[]).map((n) => [n.student_id, n]))

      setEvaluaciones(defs.map((e) => ({
        id: e.id, title: e.title, examDate: e.exam_date, kind: e.kind, scaleMax: Number(e.scale_max),
      })))

      const mapa: Record<string, Record<string, number | null>> = {}
      for (const s of (scores ?? []) as { definition_id: string; student_id: string; score: number }[]) {
        ;(mapa[s.student_id] ??= {})[s.definition_id] = Number(s.score)
      }
      setNotas(mapa)

      setEnvio(sub ? { status: sub.status as Envio['status'], submittedAt: sub.submitted_at } : null)

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[]).map((e) => {
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
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

  const bloqueado = envio !== null

  // Después de guardar una nota, el servidor ya recalculó teoría/práctica/
  // nota final: se vuelven a leer de la base, nunca se suman aquí.
  async function releerEstudiante(studentId: string) {
    if (!moduleId) return
    const { data } = await createClient()
      .from('module_enrollments')
      .select('theory_score, practice_score, participation_score, final_score')
      .eq('student_id', studentId).eq('cohort_id', cohortId).eq('module_id', moduleId)
      .maybeSingle()
    if (!data) return
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? { ...f, theory: data.theory_score, practice: data.practice_score, puntualidad: data.participation_score, finalScore: data.final_score }
      : f))
  }

  async function guardarNota(studentId: string, ev: Evaluacion, texto: string) {
    if (bloqueado) return
    const clave = `${studentId}:${ev.id}`
    const previo = notas[studentId]?.[ev.id] ?? null
    const valor = texto.trim() === '' ? null : parseFloat(texto.replace(',', '.'))

    if (valor !== null && (Number.isNaN(valor) || valor < 0 || valor > ev.scaleMax)) {
      setError(`La nota de "${ev.title}" debe estar entre 0 y ${ev.scaleMax}.`)
      return
    }
    if (valor === previo) return

    setGuardando(clave)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = valor === null
      ? await supabase.from('manual_exam_scores').delete().eq('definition_id', ev.id).eq('student_id', studentId)
      : await supabase.from('manual_exam_scores')
          .upsert({ definition_id: ev.id, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })
    if (fallo) {
      setError(fallo.message)
      setGuardando(null)
      return
    }
    setNotas((n) => ({ ...n, [studentId]: { ...n[studentId], [ev.id]: valor } }))
    await releerEstudiante(studentId)
    setGuardando(null)
  }

  async function guardarParticipacionClase(studentId: string, texto: string) {
    if (bloqueado) return
    const valor = parseFloat(texto.replace(',', '.'))
    if (Number.isNaN(valor)) return
    if (valor < 0 || valor > 20) {
      setError('La participación debe estar entre 0 y 20.')
      return
    }
    setGuardando(`${studentId}:part`)
    setError(null)
    const { data, error: fallo } = await createClient()
      .from('module_enrollments')
      .update({ class_participation_score: valor })
      .eq('student_id', studentId).eq('cohort_id', cohortId)
      .select('final_score')
      .single()
    if (fallo) { setError(fallo.message); setGuardando(null); return }
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? { ...f, participacionClase: valor, finalScore: data.final_score }
      : f))
    setGuardando(null)
  }

  async function confirmarEnvio() {
    if (!moduleId) return
    const faltan = filas.reduce(
      (total, f) => total
        + evaluaciones.filter((e) => notas[f.studentId]?.[e.id] == null).length
        + (f.participacionClase == null ? 1 : 0),
      0,
    )
    const aviso = faltan > 0
      ? `Todavía hay ${faltan} nota${faltan === 1 ? '' : 's'} vacía${faltan === 1 ? '' : 's'}. `
      : ''
    if (!confirm(`${aviso}Al confirmar, las notas se envían a Dirección Académica y ya no podrás cambiarlas. Los estudiantes las verán cuando se validen. ¿Enviar?`)) return

    setEnviando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('enviar_notas', { p_cohort: cohortId, p_module: moduleId })
    setEnviando(false)
    if (fallo) { setError(fallo.message); return }
    setEnvio({ status: 'enviado', submittedAt: new Date().toISOString() })
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando notas…</p>
      </div>
    )
  }

  const celda = 'w-16 rounded border border-zr-border bg-zr-bg px-1 py-1.5 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none disabled:opacity-60'

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/hoy" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Notas</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Tus estudiantes</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Llena la tabla a tu ritmo. Teoría, práctica, puntualidad y nota se calculan solas.
        </p>
      </header>

      {envio?.status === 'enviado' && (
        <p className="rounded-lg border border-zr-blue/30 bg-zr-blue/10 px-4 py-3 text-sm font-medium text-zr-text">
          Enviadas a Dirección Académica el {new Date(envio.submittedAt).toLocaleDateString('es-VE')}.
          Los estudiantes las verán cuando se validen. Si hay que corregir algo, pídele a Dirección
          Académica que las devuelva.
        </p>
      )}
      {envio?.status === 'validado' && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/10 px-4 py-3 text-sm font-medium text-zr-success">
          Notas validadas. Los estudiantes ya las ven.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {!moduleId ? (
        <EstadoVacio titulo="Sin módulo activo" explicacion="Esta cohorte no tiene un módulo en curso asignado." />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : (
        <>
          {evaluaciones.length === 0 && (
            <EstadoVacio titulo="Sin evaluaciones registradas" explicacion="Dirección Académica todavía no registró una evaluación para este módulo." />
          )}

          <div className="overflow-x-auto rounded-lg border border-zr-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="sticky left-0 z-10 min-w-[170px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  {evaluaciones.map((ev) => (
                    <th key={ev.id} className="min-w-[88px] border-b border-zr-border px-2 py-2 text-center align-bottom">
                      <span className="block text-xs font-bold text-zr-text">{ev.title}</span>
                      <span className="block text-[10px] font-normal text-zr-text-muted">
                        {ABREV_KIND[ev.kind] ?? ev.kind} · /{ev.scaleMax}
                      </span>
                    </th>
                  ))}
                  <th className="min-w-[64px] border-b border-l border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Teoría</th>
                  <th className="min-w-[64px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Práctica</th>
                  <th className="min-w-[84px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Puntualidad</th>
                  <th className="min-w-[96px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Participación</th>
                  <th className="min-w-[64px] border-b border-zr-border px-2 py-2.5 text-center text-xs font-bold text-zr-text-muted">Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                    <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-3 py-2">
                      <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                    </td>
                    {evaluaciones.map((ev) => (
                      <td key={ev.id} className="px-2 py-2 text-center">
                        <input
                          type="number" inputMode="decimal" min={0} max={ev.scaleMax} step={0.5}
                          defaultValue={notas[f.studentId]?.[ev.id] ?? ''}
                          onBlur={(e) => guardarNota(f.studentId, ev, e.target.value)}
                          disabled={bloqueado || guardando === `${f.studentId}:${ev.id}`}
                          className={celda}
                        />
                      </td>
                    ))}
                    <td className="border-l border-zr-border px-2 py-2 text-center text-zr-text">{fmt(f.theory)}</td>
                    <td className="px-2 py-2 text-center text-zr-text">{fmt(f.practice)}</td>
                    <td className="px-2 py-2 text-center text-zr-text">{fmt(f.puntualidad)}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number" inputMode="decimal" min={0} max={20} step={0.5}
                        defaultValue={f.participacionClase ?? ''}
                        onBlur={(e) => guardarParticipacionClase(f.studentId, e.target.value)}
                        disabled={bloqueado || guardando === `${f.studentId}:part`}
                        className={celda}
                      />
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-zr-blue">{fmt(f.finalScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!bloqueado && (
            <button
              onClick={confirmarEnvio}
              disabled={enviando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Confirmar y enviar a Dirección Académica'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
