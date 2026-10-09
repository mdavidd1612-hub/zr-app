'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

// La nota final y el estado los calcula SIEMPRE el servidor (trigger
// fn_recalc_enrollment, migración 005) — este formulario solo escribe
// theory_score/practice_score/participation_score y lee de vuelta lo que
// la base ya calculó. Nunca se calcula una nota en el navegador.

interface FilaNota {
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
}

export default function NotasCohorte() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohorteNombre, setCohorteNombre] = useState('')
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaNota[]>([])
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

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data: cohorte } = await supabase
        .from('cohorts')
        .select('name, current_module_id')
        .eq('id', cohortId)
        .single()

      if (!vigente) return
      setCohorteNombre(cohorte?.name ?? '')
      setModuleId(cohorte?.current_module_id ?? null)

      if (!cohorte?.current_module_id) {
        setCargando(false)
        return
      }

      const [{ data: estudiantes }, { data: notas }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('id, student_id, theory_score, practice_score, participation_score, participation_weight, final_score, status, passing_threshold')
          .eq('cohort_id', cohortId)
          .eq('module_id', cohorte.current_module_id),
      ])

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      const porEstudiante = new Map((notas ?? []).map((n) => [n.student_id, n]))

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[]).map((e) => {
          const n = porEstudiante.get(e.id)
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
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

  async function guardar(fila: FilaNota, campo: 'theory' | 'practice' | 'participation', valor: number) {
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
      // 0 es el centinela que el trigger fn_set_passing_threshold reconoce
      // como "calcúlalo tú" — solo importa en el insert inicial.
      passing_threshold: fila.passingThreshold ?? 0,
    }

    const { data, error: fallo } = await supabase
      .from('module_enrollments')
      .upsert(payload, { onConflict: 'student_id,module_id' })
      .select('id, final_score, status, passing_threshold')
      .single()

    if (fallo) {
      setError(fallo.message)
      setGuardandoId(null)
      return
    }

    setFilas((fs) =>
      fs.map((f) =>
        f.studentId === fila.studentId
          ? {
              ...f,
              enrollmentId: data.id,
              theory: payload.theory_score,
              practice: payload.practice_score,
              participation: payload.participation_score,
              finalScore: data.final_score,
              status: data.status,
              passingThreshold: data.passing_threshold,
            }
          : f,
      ),
    )
    setGuardandoId(null)
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (cargando || autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando notas…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Dirección Académica</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{cohorteNombre}</h1>
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
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      defaultValue={f[campo] ?? ''}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isNaN(v)) guardar(f, campo, v)
                      }}
                      disabled={guardandoId === f.studentId}
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-center text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-zr-border pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-zr-text-muted">Nota final</p>
                  <p className="mt-1 text-2xl font-bold text-zr-blue">
                    {f.finalScore != null ? f.finalScore.toFixed(1) : '—'}
                  </p>
                  {f.passingThreshold != null && (
                    <p className="text-xs text-zr-text-muted">Aprueba con {f.passingThreshold}</p>
                  )}
                </div>
                {f.status && (
                  <span
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      f.status === 'aprobado'
                        ? 'border-zr-success/30 bg-zr-success/10 text-zr-success'
                        : f.status === 'reprobado'
                          ? 'border-zr-error/30 bg-zr-error/10 text-zr-error'
                          : 'border-zr-border bg-zr-surface text-zr-text-muted'
                    }`}
                  >
                    {f.status === 'aprobado' ? 'Aprobado' : f.status === 'reprobado' ? 'Reprobado' : 'En curso'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
