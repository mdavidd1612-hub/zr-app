'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "Ver calificaciones (por estudiante)" -- pantalla de solo lectura para
 * Dirección Académica. Nadie edita aquí: teoría y práctica se calculan
 * solas a partir de "Registrar Evaluación" (fn_recalc_evaluacion_general,
 * migración 110) y puntualidad se calcula sola desde la asistencia
 * (fn_recalc_puntualidad, misma migración) -- ni el profesor ni Dirección
 * Académica ni super_admin ponen ninguno de los tres a mano.
 */

interface FilaNota {
  studentId: string
  nombre: string
  cedula: string
  theory: number | null
  practice: number | null
  puntualidad: number | null
  finalScore: number | null
  status: string | null
  passingThreshold: number | null
}

export default function VerCalificacionesCohorte() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohorteNombre, setCohorteNombre] = useState('')
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaNota[]>([])
  const [cargando, setCargando] = useState(true)

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
          .select('id, student_id, theory_score, practice_score, participation_score, final_score, status, passing_threshold')
          .eq('cohort_id', cohortId)
          .eq('module_id', cohorte.current_module_id),
      ])

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type NotaCruda = {
        student_id: string
        theory_score: number | null
        practice_score: number | null
        participation_score: number | null
        final_score: number | null
        status: string | null
        passing_threshold: number | null
      }
      const porEstudiante = new Map(((notas ?? []) as unknown as NotaCruda[]).map((n) => [n.student_id, n]))

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
            passingThreshold: n?.passing_threshold ?? null,
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId])

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
        <p className="text-sm text-zr-text-muted">Cargando calificaciones…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica · Ver calificaciones
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{cohorteNombre}</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Teoría y práctica se calculan solas desde &ldquo;Registrar Evaluación&rdquo;; puntualidad se
          calcula sola desde la asistencia. Nada de esto se edita aquí.
        </p>
      </header>

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

              <div className="grid grid-cols-3 gap-3 text-center">
                {([
                  ['Teoría', f.theory],
                  ['Práctica', f.practice],
                  ['Puntualidad', f.puntualidad],
                ] as const).map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="rounded-lg border border-zr-border bg-zr-bg p-3">
                    <p className="text-xs font-semibold uppercase text-zr-text-muted">{etiqueta}</p>
                    <p className="mt-1 text-lg font-bold text-zr-text">{valor ?? '—'}</p>
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
