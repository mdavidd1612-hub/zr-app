'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Notas del profesor -- corrección explícita del coordinador (sept. 2026):
 * ya no hay "Evaluar módulo" (teoría/práctica/participación a mano). El
 * profesor SOLO pone la nota de cada evaluación que Dirección Académica
 * registró en "Registrar Evaluación" (examen, práctica u otro). teoría,
 * práctica y puntualidad del módulo se calculan solas en el servidor
 * (migración 110) -- aquí solo se muestran, de solo lectura.
 */

const ETIQUETA_KIND: Record<string, string> = { examen: 'Examen', practica: 'Práctica', otro: 'Otro' }

interface ExamenDef { id: string; title: string; examDate: string; scaleMax: number; kind: string }

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  puntualidad: number | null
  finalScore: number | null
  status: string | null
}

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [moduleId, setModuleId] = useState<string | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<ExamenDef[]>([])
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [notasEvaluacion, setNotasEvaluacion] = useState<Record<string, Record<string, number | null>>>({})
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
          .select('student_id, theory_score, practice_score, participation_score, final_score, status')
          .eq('cohort_id', cohortId)
          .eq('module_id', cohorte.current_module_id),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, exam_date, scale_max, kind')
          .eq('module_id', cohorte.current_module_id)
          .order('exam_date'),
      ])

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type NotaCruda = {
        student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; final_score: number | null; status: string | null
      }
      const porEstudiante = new Map(((notas ?? []) as unknown as NotaCruda[]).map((n) => [n.student_id, n]))

      setEvaluaciones(
        ((exs ?? []) as { id: string; title: string; exam_date: string; scale_max: number; kind: string }[])
          .map((e) => ({ id: e.id, title: e.title, examDate: e.exam_date, scaleMax: Number(e.scale_max), kind: e.kind })),
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
            finalScore: n?.final_score ?? null,
            status: n?.status ?? null,
          }
        }),
      )

      if (exs && exs.length > 0) {
        const { data: notasEx } = await supabase
          .from('manual_exam_scores')
          .select('definition_id, student_id, score')
          .in('definition_id', exs.map((e) => e.id))
        if (!vigente) return
        const mapa: Record<string, Record<string, number | null>> = {}
        for (const n of notasEx ?? []) {
          mapa[n.definition_id] ??= {}
          mapa[n.definition_id][n.student_id] = n.score
        }
        setNotasEvaluacion(mapa)
      }

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

  async function guardarNota(examId: string, studentId: string, valor: number) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase
      .from('manual_exam_scores')
      .upsert({ definition_id: examId, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }
    setNotasEvaluacion((m) => ({ ...m, [examId]: { ...(m[examId] ?? {}), [studentId]: valor } }))

    // teoría/práctica/nota final se recalculan solos en el servidor -- se
    // vuelve a leer para reflejarlo sin que el navegador calcule nada.
    const { data: n } = await supabase
      .from('module_enrollments')
      .select('theory_score, practice_score, participation_score, final_score, status')
      .eq('student_id', studentId)
      .eq('cohort_id', cohortId)
      .single()
    if (n) {
      setFilas((fs) => fs.map((f) => f.studentId === studentId ? {
        ...f, theory: n.theory_score, practice: n.practice_score, puntualidad: n.participation_score,
        finalScore: n.final_score, status: n.status,
      } : f))
    }
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
        <p className="mt-2 text-sm text-zr-text-muted">
          Teoría, práctica y puntualidad se calculan solas — aquí solo registras las notas de cada
          evaluación.
        </p>
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
          <div className="space-y-3">
            {filas.map((f) => (
              <div key={f.studentId} className="zr-card space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-zr-text-muted">Nota</p>
                      <p className="text-lg font-bold text-zr-blue">{f.finalScore != null ? f.finalScore.toFixed(1) : '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-zr-text-muted">
                  <p>Teoría: <span className="font-semibold text-zr-text">{f.theory ?? '—'}</span></p>
                  <p>Práctica: <span className="font-semibold text-zr-text">{f.practice ?? '—'}</span></p>
                  <p>Puntualidad: <span className="font-semibold text-zr-text">{f.puntualidad ?? '—'}</span></p>
                </div>
              </div>
            ))}
          </div>

          {evaluaciones.length === 0 ? (
            <EstadoVacio titulo="Sin evaluaciones registradas" explicacion="Dirección Académica todavía no registró una evaluación para este módulo." />
          ) : (
            <div className="space-y-6">
              {evaluaciones.map((examen) => (
                <div key={examen.id} className="space-y-3">
                  <p className="text-sm font-bold text-zr-text">
                    {examen.title}{' '}
                    <span className="font-normal text-zr-text-muted">
                      · {ETIQUETA_KIND[examen.kind] ?? examen.kind} · {examen.examDate} · sobre {examen.scaleMax}
                    </span>
                  </p>
                  {filas.map((f) => (
                    <div key={f.studentId} className="zr-card flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                        <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                      </div>
                      <input
                        type="number" min={0} max={examen.scaleMax} step={0.5}
                        defaultValue={notasEvaluacion[examen.id]?.[f.studentId] ?? ''}
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardarNota(examen.id, f.studentId, v) }}
                        disabled={guardandoId === f.studentId}
                        className="w-20 shrink-0 rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
