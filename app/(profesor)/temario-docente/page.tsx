'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Regla } from '@/components/ui/Editorial'
import { IconoCheck } from '@/components/ui/Iconos'
import { ContextoDocente, AvisoModuloBloqueado, moduloVigente, type ContextoSel } from '@/components/ui/ContextoDocente'

/**
 * Temario del profesor: sale tal cual de lo que ven los estudiantes en
 * "Mi módulo" (tabla `modules`: resumen,
 * competencias, duración). Así el profesor enseña exactamente lo que el
 * estudiante ve que va a aprender, sin una segunda fuente que mantener.
 *
 * Primero elige programa y módulo (ContextoDocente). Un módulo ya cursado o
 * que aún no empieza se muestra bloqueado.
 */

interface DatosModulo {
  semanaActual: number | null
  duracionSemanas: number
  resumen: string | null
  competencias: string[]
}

function Temario({ ctx }: { ctx: ContextoSel }) {
  const [datos, setDatos] = useState<DatosModulo | null>(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      const [{ data: mod }, { data: sesiones }] = await Promise.all([
        supabase
          .from('modules')
          .select('resumen_largo, description, competencias, duration_weeks')
          .eq('id', ctx.moduleId)
          .single(),
        supabase
          .from('class_sessions')
          .select('week_number, session_date')
          .eq('cohort_id', ctx.cohortId)
          .eq('module_id', ctx.moduleId)
          .order('session_date'),
      ])
      if (!vigente || !mod) return

      // Misma regla que "Mi módulo" del estudiante: la semana actual es la de
      // la sesión más cercana a hoy; antes de la primera clase, la 1.
      const hoy = new Date().toISOString().slice(0, 10)
      const filas = sesiones ?? []
      const semana = filas.length === 0 ? null : (filas.find((s) => s.session_date >= hoy) ?? filas[filas.length - 1]).week_number

      if (!vigente) return

      setDatos({
        semanaActual: semana,
        duracionSemanas: mod.duration_weeks,
        resumen: mod.resumen_largo?.split(/\n\s*\n/)[0]?.trim() || mod.description,
        competencias: mod.competencias ?? [],
      })
    }
    cargar()
    return () => { vigente = false }
  }, [ctx.cohortId, ctx.moduleId])

  const bloqueado = !moduloVigente(ctx.estado)

  return (
    <div className="space-y-8 px-5 pb-28 pt-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Temario</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Qué debo impartir</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Es lo mismo que ven tus estudiantes en «Mi módulo».
        </p>
      </header>
      <Regla />

      <section className="space-y-4">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-5 text-white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            {!bloqueado && datos?.semanaActual
              ? `Semana ${datos.semanaActual} de ${datos.duracionSemanas}`
              : datos ? `${datos.duracionSemanas} semanas` : ''}
          </p>
          <p className="zr-display text-lg">
            {ctx.cohorteNombre}{ctx.sede ? ` · ${ctx.sede}` : ''} · Módulo {ctx.moduloOrden} · {ctx.moduloNombre}
          </p>
        </div>

        {bloqueado ? (
          <AvisoModuloBloqueado estado={ctx.estado} />
        ) : !datos ? null : (
          <>
            {datos.resumen ? (
              <p className="zr-card p-5 text-sm leading-relaxed text-zr-text-muted">{datos.resumen}</p>
            ) : datos.competencias.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Todavía no se ha cargado el contenido de este módulo.</p>
            ) : null}
            {datos.competencias.length > 0 && (
              <ul className="space-y-1.5">
                {datos.competencias.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zr-text">
                    <IconoCheck size={14} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

    </div>
  )
}

export default function TemarioDocente() {
  return (
    <ContextoDocente sobretitulo="Temario" titulo="Qué debo impartir" volverHref="/perfil-docente">
      {(ctx) => <Temario ctx={ctx} />}
    </ContextoDocente>
  )
}
