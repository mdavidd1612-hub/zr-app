'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoAviso } from '@/components/ui/Iconos'

/**
 * Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 3): "Mi módulo" reemplaza
 * "Mis clases" en el perfil del estudiante. Muestra en qué módulo está, qué
 * semana es y qué va a aprender — SIN estado de dominio: eso queda pospuesto
 * junto con Progreso (regla del equipo para la demo del 5 de septiembre).
 */

interface Competencia {
  titulo: string
  descripcion: string | null
  semana: number
}

interface DatosModulo {
  nombre: string
  descripcion: string | null
  duracionSemanas: number
  semanaActual: number
}

export default function MiModulo() {
  const router = useRouter()
  const [modulo, setModulo] = useState<DatosModulo | null>(null)
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: est } = await supabase
        .from('students')
        .select('cohort_id, cohorts(current_module_id)')
        .eq('id', user.id)
        .single()

      const cohortId = (est as unknown as { cohort_id: string | null } | null)?.cohort_id
      const moduloId = (est as unknown as { cohorts: { current_module_id: string | null } | null } | null)
        ?.cohorts?.current_module_id

      if (!moduloId) {
        setCargando(false)
        return
      }

      const [{ data: mod }, { data: guias }, { data: sesiones }] = await Promise.all([
        supabase.from('modules').select('name, description, duration_weeks').eq('id', moduloId).single(),
        supabase
          .from('learning_guides')
          .select('sub_competency_name, pre_practice_description, week_number')
          .eq('module_id', moduloId)
          .order('week_number', { ascending: true })
          .order('order_in_week', { ascending: true }),
        cohortId
          ? supabase
              .from('class_sessions')
              .select('week_number, session_date')
              .eq('cohort_id', cohortId)
              .eq('module_id', moduloId)
              .order('session_date', { ascending: true })
          : Promise.resolve({ data: null }),
      ])

      if (mod) {
        // La semana "actual" es la de la sesión más cercana a hoy — antes de
        // la primera clase se muestra la semana 1, no un error.
        const hoy = new Date().toISOString().slice(0, 10)
        const filas = sesiones ?? []
        const proxima = filas.find((s) => s.session_date >= hoy)
        const semanaActual = proxima?.week_number ?? filas[filas.length - 1]?.week_number ?? 1

        setModulo({
          nombre: mod.name,
          descripcion: mod.description,
          duracionSemanas: mod.duration_weeks,
          semanaActual,
        })
      }

      setCompetencias(
        (guias ?? []).map((g) => ({
          titulo: g.sub_competency_name,
          descripcion: g.pre_practice_description,
          semana: g.week_number,
        })),
      )

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href="/" />

        {!modulo ? (
          <div className="zr-card p-7">
            <p className="text-base font-semibold text-zr-text">Todavía no tienes módulo asignado</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Cuando la academia te asigne una cohorte, aquí vas a ver en qué módulo estás y qué
              vas a aprender.
            </p>
          </div>
        ) : (
          <>
            <div className="animate-rise overflow-hidden rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Módulo · Semana {modulo.semanaActual} de {modulo.duracionSemanas}
              </p>
              <p className="zr-display text-xl">{modulo.nombre}</p>
              {modulo.descripcion && (
                <p className="mt-3 text-sm leading-relaxed text-white/90">{modulo.descripcion}</p>
              )}
            </div>

            <Regla delay={60} />

            <Seccion numero={1} titulo="Lo que se aprende aquí" delay={120}>
              {competencias.length === 0 ? (
                <p className="text-sm text-zr-text-muted">
                  Todavía no se ha cargado el contenido de este módulo.
                </p>
              ) : (
                <div className="space-y-3">
                  {competencias.map((c, i) => (
                    <div key={i} className="zr-card flex gap-3 p-4">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zr-blue/15 text-xs font-bold text-zr-blue-mid">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zr-text">{c.titulo}</p>
                        {c.descripcion && (
                          <p className="mt-1 text-sm leading-relaxed text-zr-text-muted">{c.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
                <IconoAviso size={18} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                <p className="text-sm leading-relaxed text-zr-text">
                  Las competencias <b>no se califican en esta fase</b>. Están aquí para que sepas
                  hacia dónde vas.
                </p>
              </div>
            </Seccion>
          </>
        )}
      </div>
    </div>
  )
}
