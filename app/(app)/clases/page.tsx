'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoCheck } from '@/components/ui/Iconos'
import { esAdmin } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "Mi módulo": el módulo que el estudiante está cursando ahora mismo. La
 * malla curricular completa (los 14 módulos, resumen corto) vive aparte en
 * /malla — a pedido explícito del coordinador, esta pantalla no intenta
 * mostrar los 14, solo el actual, y enlaza hacia abajo a la malla completa.
 *
 * El resumen que se muestra aquí (sept. 2026, pedido explícito del
 * coordinador): el párrafo completo de `resumen_largo` se sentía como
 * "mucho texto, nadie lo va a leer" — igual que ya había pasado antes con
 * la malla (migración 079). La solución no es el resumen corto de una
 * frase que ya usan /malla e Inicio (eso se sentiría igual de escueto
 * aquí, donde el estudiante sí quiere algo más de contexto de SU módulo
 * actual) ni el párrafo entero: es el PRIMER párrafo de `resumen_largo`
 * -- cada resumen largo ya está escrito de lo general a lo específico, así
 * que el primer párrafo por sí solo funciona como una introducción media,
 * sin inventar ni recortar contenido a mano módulo por módulo. El resto de
 * la pantalla pasa a listar las competencias como checklist simple (mismo
 * estilo que la tarjeta "Estás cursando" de Inicio), no una tarjeta grande
 * por cada una.
 */

interface DatosModulo {
  nombre: string
  resumen: string | null
  competencias: string[] | null
  duracionSemanas: number
  semanaActual: number
}

export default function MiModulo() {
  const router = useRouter()
  const [modulo, setModulo] = useState<DatosModulo | null>(null)
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
        .maybeSingle()

      let cohortId = (est as unknown as { cohort_id: string | null } | null)?.cohort_id ?? null
      let moduloId = (est as unknown as { cohorts: { current_module_id: string | null } | null } | null)
        ?.cohorts?.current_module_id ?? null

      // Vista de recorrido (admin, dirección académica y super_admin): no
      // tienen fila en `students`, así que no hay nada que mostrarles. En
      // vez de inventar una inscripción falsa, se les muestra en SOLO
      // LECTURA un programa real que ya exista y tenga módulo asignado — el
      // más poblado, para que se vea con contenido.
      if (!moduloId) {
        const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (esAdmin(perfil?.role as UserRole | undefined)) {
          const { data: cohortesConModulo } = await supabase
            .from('cohorts')
            .select('id, current_module_id, students(id)')
            .not('current_module_id', 'is', null)
            .eq('status', 'activa')

          const filas = (cohortesConModulo ?? []) as unknown as {
            id: string; current_module_id: string; students: { id: string }[] | null
          }[]
          const mejor = [...filas].sort((a, b) => (b.students?.length ?? 0) - (a.students?.length ?? 0))[0]

          if (mejor) {
            cohortId = mejor.id
            moduloId = mejor.current_module_id
          }
        }
      }

      if (!moduloId) {
        setCargando(false)
        return
      }

      const [{ data: mod }, { data: sesiones }] = await Promise.all([
        supabase.from('modules').select('name, resumen_largo, description, competencias, duration_weeks').eq('id', moduloId).single(),
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

        // Primer párrafo del resumen largo como resumen "medio" -- ver nota
        // arriba del componente. Si el módulo todavía no tiene resumen
        // largo cargado, se cae al resumen corto (el mismo de /malla).
        const primerParrafo = mod.resumen_largo?.split(/\n\s*\n/)[0]?.trim() || null

        setModulo({
          nombre: mod.name,
          resumen: primerParrafo || mod.description,
          competencias: mod.competencias,
          duracionSemanas: mod.duration_weeks,
          semanaActual,
        })
      }

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
              Cuando la academia te asigne un programa, aquí vas a ver en qué módulo estás y qué
              vas a aprender.
            </p>
          </div>
        ) : (
          <>
            <div id="tour-modulo" className="animate-rise overflow-hidden rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Módulo · Semana {modulo.semanaActual} de {modulo.duracionSemanas}
              </p>
              <p className="zr-display text-xl">{modulo.nombre}</p>
            </div>

            <Regla delay={60} />

            <Seccion numero={1} titulo="Lo que se aprende aquí" delay={120}>
              {modulo.resumen ? (
                <p className="zr-card p-5 text-sm leading-relaxed text-zr-text-muted">
                  {modulo.resumen}
                </p>
              ) : !modulo.competencias?.length ? (
                <p className="text-sm text-zr-text-muted">
                  Todavía no se ha cargado el contenido de este módulo.
                </p>
              ) : null}

              {modulo.competencias && modulo.competencias.length > 0 && (
                <ul className="space-y-1.5">
                  {modulo.competencias.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zr-text">
                      <IconoCheck size={14} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3 rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
                <IconoCheck size={18} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                <p className="text-sm leading-relaxed text-zr-text">
                  Las competencias <b>no se califican en esta fase</b>. Están aquí para que sepas
                  hacia dónde vas.
                </p>
              </div>
            </Seccion>

            {/* Módulo 7 de la spec funcional: el camino completo del programa,
                no solo el módulo de esta semana. */}
            <Link
              href="/malla"
              className="flex min-h-14 items-center justify-between rounded-lg border border-zr-border bg-zr-surface px-5 text-base font-bold text-zr-text"
            >
              Ver la malla curricular completa
              <span aria-hidden className="text-zr-text-muted">›</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
