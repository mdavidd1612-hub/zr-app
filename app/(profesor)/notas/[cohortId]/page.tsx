'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Notas del profesor -- pedido explícito del coordinador (sept. 2026): la
 * versión anterior mostraba cada evaluación con su lista completa de
 * estudiantes en la misma pantalla -- tedioso con 20+ estudiantes. Ahora:
 * arriba, una tabla compacta tipo Excel (mismo patrón que /asistencias) con
 * el "General" de solo lectura; abajo, un botón por evaluación (ordenados
 * por fecha) que lleva a `/notas/[cohortId]/evaluacion/[evalId]`, una
 * pantalla dedicada con la tabla de esa sola evaluación.
 *
 * teoría, práctica y puntualidad se calculan solas en el servidor
 * (migración 110) -- de solo lectura aquí. "Participación en clase" es el
 * ÚNICO campo de General que el profesor pone directo (migración 111).
 */

interface FilaEstudiante {
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

interface Evaluacion { id: string; title: string; examDate: string; kind: string }

const ETIQUETA_KIND: Record<string, string> = { examen: 'Examen', practica: 'Práctica', otro: 'Otro' }

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [moduleId, setModuleId] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
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

      const [{ data: estudiantes }, { data: notas }, { data: exs }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('student_id, theory_score, practice_score, participation_score, class_participation_score, final_score, status')
          .eq('cohort_id', cohortId)
          .eq('module_id', cohorte.current_module_id),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, exam_date, kind')
          .eq('module_id', cohorte.current_module_id)
          .order('exam_date'),
      ])

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type NotaCruda = {
        student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; class_participation_score: number | null
        final_score: number | null; status: string | null
      }
      const porEstudiante = new Map(((notas ?? []) as unknown as NotaCruda[]).map((n) => [n.student_id, n]))

      setEvaluaciones(
        ((exs ?? []) as { id: string; title: string; exam_date: string; kind: string }[])
          .map((e) => ({ id: e.id, title: e.title, examDate: e.exam_date, kind: e.kind })),
      )

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
            status: n?.status ?? null,
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

  async function guardarParticipacionClase(studentId: string, valor: number) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { data, error: fallo } = await supabase
      .from('module_enrollments')
      .update({ class_participation_score: valor })
      .eq('student_id', studentId)
      .eq('cohort_id', cohortId)
      .select('final_score, status')
      .single()

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? { ...f, participacionClase: valor, finalScore: data.final_score, status: data.status }
      : f))
    setGuardandoId(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando notas…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/hoy" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Notas</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Tus estudiantes</h1>
      </header>

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
          {/* Computadora: tabla compacta tipo Excel, mismo patrón que /asistencias. */}
          <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-zr-border bg-zr-surface px-4 py-2.5 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  <th className="min-w-[80px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">Teoría</th>
                  <th className="min-w-[80px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">Práctica</th>
                  <th className="min-w-[90px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">Puntualidad</th>
                  <th className="min-w-[110px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">Participación</th>
                  <th className="min-w-[80px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                    <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-4 py-2">
                      <p className="truncate font-semibold text-zr-text">{f.nombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                    </td>
                    <td className="px-2 py-2 text-center text-zr-text">{f.theory ?? '—'}</td>
                    <td className="px-2 py-2 text-center text-zr-text">{f.practice ?? '—'}</td>
                    <td className="px-2 py-2 text-center text-zr-text">{f.puntualidad ?? '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number" min={0} max={20} step={0.5}
                        defaultValue={f.participacionClase ?? ''}
                        onBlur={(ev) => { const v = parseFloat(ev.target.value); if (!Number.isNaN(v)) guardarParticipacionClase(f.studentId, v) }}
                        disabled={guardandoId === f.studentId}
                        className="w-16 rounded border border-zr-border bg-zr-bg px-1 py-1 text-center text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-zr-blue">
                      {f.finalScore != null ? f.finalScore.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teléfono: una tarjeta compacta por estudiante. */}
          <div className="space-y-2 lg:hidden">
            {filas.map((f) => (
              <div key={f.studentId} className="zr-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold text-zr-blue">{f.finalScore != null ? f.finalScore.toFixed(1) : '—'}</p>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] text-zr-text-muted">
                  <p>T: <span className="font-semibold text-zr-text">{f.theory ?? '—'}</span></p>
                  <p>P: <span className="font-semibold text-zr-text">{f.practice ?? '—'}</span></p>
                  <p>Pt: <span className="font-semibold text-zr-text">{f.puntualidad ?? '—'}</span></p>
                  <input
                    type="number" min={0} max={20} step={0.5}
                    defaultValue={f.participacionClase ?? ''}
                    placeholder="Part."
                    onBlur={(ev) => { const v = parseFloat(ev.target.value); if (!Number.isNaN(v)) guardarParticipacionClase(f.studentId, v) }}
                    disabled={guardandoId === f.studentId}
                    className="w-full rounded border border-zr-border bg-zr-bg px-1 py-0.5 text-center text-xs text-zr-text focus:border-zr-blue focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Evaluaciones</p>
            {evaluaciones.length === 0 ? (
              <EstadoVacio titulo="Sin evaluaciones registradas" explicacion="Dirección Académica todavía no registró una evaluación para este módulo." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {evaluaciones.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => router.push(`/notas/${cohortId}/evaluacion/${ev.id}`)}
                    className="rounded-full border border-zr-border px-4 py-2 text-xs font-bold text-zr-blue-mid"
                  >
                    {ETIQUETA_KIND[ev.kind] ?? ev.kind}: {ev.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
