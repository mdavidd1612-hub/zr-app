'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * T-311 (reescrita, pedido explícito del coordinador sept. 2026) · Notas del
 * profesor para su propia cohorte. Dos secciones, como pidió: "Evaluar
 * módulo del estudiante" (Teoría/Práctica/Participación + los campos extra
 * que Dirección Académica haya definido) y "Evaluar exámenes del
 * estudiante" (los exámenes que Dirección Académica registró en "Por
 * Examen").
 *
 * La nota final y el estado los calcula SIEMPRE el servidor (trigger
 * fn_recalc_enrollment, migración 005) — este formulario solo escribe los
 * campos y lee de vuelta lo que la base ya calculó. Nunca se calcula una
 * nota en el navegador (regla 2 de AGENTS.md).
 */

interface CampoDef { id: string; label: string }
interface ExamenDef { id: string; title: string; examDate: string; scaleMax: number; passingMin: number }

interface FilaModulo {
  enrollmentId: string | null
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  participation: number | null
  weight: number
  finalScore: number | null
  status: string | null
  passingThreshold: number | null
  extras: Record<string, number | null>
}

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [tab, setTab] = useState<'modulo' | 'examenes'>('modulo')
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [campos, setCampos] = useState<CampoDef[]>([])
  const [examenes, setExamenes] = useState<ExamenDef[]>([])
  const [filas, setFilas] = useState<FilaModulo[]>([])
  const [notasExamen, setNotasExamen] = useState<Record<string, Record<string, number | null>>>({})
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

      const [{ data: estudiantes }, { data: notas }, { data: defs }, { data: exs }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('id, student_id, theory_score, practice_score, participation_score, participation_weight, final_score, status, passing_threshold, module_evaluation_extra_scores(field_def_id, score)')
          .eq('cohort_id', cohortId)
          .eq('module_id', cohorte.current_module_id),
        supabase.from('module_evaluation_field_defs').select('id, label'),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, exam_date, scale_max, passing_min')
          .eq('module_id', cohorte.current_module_id)
          .order('exam_date'),
      ])

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type NotaCruda = {
        id: string; student_id: string; theory_score: number | null; practice_score: number | null
        participation_score: number | null; participation_weight: number; final_score: number | null
        status: string | null; passing_threshold: number | null
        module_evaluation_extra_scores: { field_def_id: string; score: number | null }[] | null
      }
      const porEstudiante = new Map(((notas ?? []) as unknown as NotaCruda[]).map((n) => [n.student_id, n]))

      setCampos((defs ?? []) as CampoDef[])
      setExamenes(
        ((exs ?? []) as { id: string; title: string; exam_date: string; scale_max: number; passing_min: number }[])
          .map((e) => ({ id: e.id, title: e.title, examDate: e.exam_date, scaleMax: Number(e.scale_max), passingMin: Number(e.passing_min) })),
      )

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[]).map((e) => {
          const n = porEstudiante.get(e.id)
          const extras: Record<string, number | null> = {}
          for (const ex of n?.module_evaluation_extra_scores ?? []) extras[ex.field_def_id] = ex.score
          return {
            enrollmentId: n?.id ?? null,
            studentId: e.id,
            nombre: e.profiles?.full_name ?? '—',
            cedula: e.profiles?.cedula ?? '—',
            theory: n?.theory_score ?? null,
            practice: n?.practice_score ?? null,
            participation: n?.participation_score ?? null,
            weight: n?.participation_weight ?? 0.05,
            finalScore: n?.final_score ?? null,
            status: n?.status ?? null,
            passingThreshold: n?.passing_threshold ?? null,
            extras,
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
        setNotasExamen(mapa)
      }

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

  async function guardarGeneral(fila: FilaModulo, campo: 'theory' | 'practice' | 'participation', valor: number) {
    if (!moduleId) return
    setGuardandoId(fila.studentId)
    setError(null)

    const supabase = createClient()
    const payload = {
      student_id: fila.studentId,
      module_id: moduleId,
      cohort_id: cohortId,
      theory_score: campo === 'theory' ? valor : fila.theory,
      practice_score: campo === 'practice' ? valor : fila.practice,
      participation_score: campo === 'participation' ? valor : fila.participation,
      participation_weight: fila.weight,
      passing_threshold: fila.passingThreshold ?? 0,
    }

    const { data, error: fallo } = await supabase
      .from('module_enrollments')
      .upsert(payload, { onConflict: 'student_id,module_id' })
      .select('id, final_score, status, passing_threshold')
      .single()

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }

    setFilas((fs) => fs.map((f) => f.studentId === fila.studentId ? {
      ...f, enrollmentId: data.id,
      theory: payload.theory_score, practice: payload.practice_score, participation: payload.participation_score,
      finalScore: data.final_score, status: data.status, passingThreshold: data.passing_threshold,
    } : f))
    setGuardandoId(null)
  }

  async function guardarExtra(fila: FilaModulo, campoId: string, valor: number) {
    if (!fila.enrollmentId) {
      setError('Primero registra Teoría/Práctica/Participación para este estudiante.')
      return
    }
    setGuardandoId(fila.studentId)
    const supabase = createClient()
    const { error: fallo } = await supabase
      .from('module_evaluation_extra_scores')
      .upsert({ enrollment_id: fila.enrollmentId, field_def_id: campoId, score: valor }, { onConflict: 'enrollment_id,field_def_id' })

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }
    setFilas((fs) => fs.map((f) => f.studentId === fila.studentId ? { ...f, extras: { ...f.extras, [campoId]: valor } } : f))
    setGuardandoId(null)
  }

  async function guardarNotaExamen(examId: string, studentId: string, valor: number) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase
      .from('manual_exam_scores')
      .upsert({ definition_id: examId, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }
    setNotasExamen((m) => ({ ...m, [examId]: { ...(m[examId] ?? {}), [studentId]: valor } }))
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
      <BotonVolver href="/sesiones" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Notas</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Tus estudiantes</h1>
      </header>

      <div className="flex overflow-hidden rounded-full border border-zr-border">
        <button
          onClick={() => setTab('modulo')}
          className={`flex-1 py-2.5 text-sm font-bold ${tab === 'modulo' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'}`}
        >
          Evaluar módulo
        </button>
        <button
          onClick={() => setTab('examenes')}
          className={`flex-1 py-2.5 text-sm font-bold ${tab === 'examenes' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'}`}
        >
          Evaluar exámenes
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {!moduleId ? (
        <EstadoVacio titulo="Sin módulo activo" explicacion="Esta cohorte no tiene un módulo en curso asignado." />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : tab === 'modulo' ? (
        <div className="space-y-3">
          {filas.map((f) => (
            <div key={f.studentId} className="zr-card space-y-4 p-5">
              <div>
                <p className="text-base font-semibold text-zr-text">{f.nombre}</p>
                <p className="text-sm tabular-nums text-zr-text-muted">{f.cedula}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['theory', 'practice', 'participation'] as const).map((campo) => (
                  <div key={campo}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">
                      {campo === 'theory' ? 'Teoría' : campo === 'practice' ? 'Práctica' : 'Participación'}
                    </label>
                    <input
                      type="number" min={0} max={20} step={0.5}
                      defaultValue={f[campo] ?? ''}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardarGeneral(f, campo, v) }}
                      disabled={guardandoId === f.studentId}
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {campos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {campos.map((c) => (
                    <div key={c.id}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">{c.label}</label>
                      <input
                        type="number" min={0} max={20} step={0.5}
                        defaultValue={f.extras[c.id] ?? ''}
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardarExtra(f, c.id, v) }}
                        disabled={guardandoId === f.studentId}
                        className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-zr-border pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-zr-text-muted">Nota final</p>
                  <p className="mt-1 text-2xl font-bold text-zr-blue">{f.finalScore != null ? f.finalScore.toFixed(1) : '—'}</p>
                </div>
                {f.status && (
                  <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    f.status === 'aprobado' ? 'border-zr-success/30 bg-zr-success/10 text-zr-success'
                      : f.status === 'reprobado' ? 'border-zr-error/30 bg-zr-error/10 text-zr-error'
                        : 'border-zr-border bg-zr-surface text-zr-text-muted'
                  }`}>
                    {f.status === 'aprobado' ? 'Aprobado' : f.status === 'reprobado' ? 'Reprobado' : 'En curso'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : examenes.length === 0 ? (
        <EstadoVacio titulo="Sin exámenes registrados" explicacion="Dirección Académica todavía no registró un examen para este módulo." />
      ) : (
        <div className="space-y-6">
          {examenes.map((examen) => (
            <div key={examen.id} className="space-y-3">
              <p className="text-sm font-bold text-zr-text">
                {examen.title} <span className="font-normal text-zr-text-muted">· {examen.examDate} · sobre {examen.scaleMax}</span>
              </p>
              {filas.map((f) => (
                <div key={f.studentId} className="zr-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </div>
                  <input
                    type="number" min={0} max={examen.scaleMax} step={0.5}
                    defaultValue={notasExamen[examen.id]?.[f.studentId] ?? ''}
                    onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardarNotaExamen(examen.id, f.studentId, v) }}
                    disabled={guardandoId === f.studentId}
                    className="w-20 shrink-0 rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
