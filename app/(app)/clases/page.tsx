'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoCheck, IconoAviso, IconoChevron } from '@/components/ui/Iconos'
import { esAdmin } from '@/lib/auth-helpers'
import { leerCohorteVistaRecorridoCookie, leerModuloVistaRecorridoCookie } from '@/lib/vista-recorrido'
import type { UserRole } from '@/lib/types'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { useEsqueletoVisible } from '@/lib/useEsqueletoVisible'

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
      // tienen fila en `students`, así que no hay nada que mostrarles. Se usa
      // la cohorte que eligió en el panel antes de entrar (pedido explícito
      // del coordinador, oct. 2026 — ver lib/vista-recorrido.ts); si entró
      // directo sin elegir, se cae al respaldo de siempre: la cohorte real
      // más poblada que ya tenga módulo asignado.
      if (!moduloId) {
        const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (esAdmin(perfil?.role as UserRole | undefined)) {
          const cohorteElegida = leerCohorteVistaRecorridoCookie()
          const moduloElegido = leerModuloVistaRecorridoCookie()
          if (cohorteElegida) {
            cohortId = cohorteElegida
            // El módulo elegido explícitamente en el panel (pedido explícito
            // del coordinador, oct. 2026: "también por módulo") gana sobre
            // el módulo vigente de la cohorte.
            if (moduloElegido) {
              moduloId = moduloElegido
            } else {
              const { data: coh } = await supabase
                .from('cohorts').select('current_module_id').eq('id', cohorteElegida).maybeSingle()
              moduloId = coh?.current_module_id ?? null
            }
          }

          if (!moduloId) {
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

  const mostrarEsqueleto = useEsqueletoVisible(cargando)
  if (mostrarEsqueleto) {
    return (
      <PantallaEsqueleto />
    )
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-9">
        <BotonVolver href="/" />

        {!modulo ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-base font-bold text-zr-text">Todavía no tienes módulo asignado</p>
            <p className="max-w-xs text-sm text-zr-text-muted">
              Cuando la academia te asigne un programa, aquí vas a ver en qué módulo estás y qué
              vas a aprender.
            </p>
          </div>
        ) : (
          <>
            <div id="tour-modulo" className="animate-rise overflow-hidden rounded-2xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Módulo · Semana {modulo.semanaActual} de {modulo.duracionSemanas}
              </p>
              <p className="zr-display text-2xl">{modulo.nombre}</p>
            </div>

            <Seccion numero={1} titulo="Lo que se aprende aquí" delay={120}>
              {/* Resumen como texto que se lee, no como cuadro gris. */}
              {modulo.resumen ? (
                <p className="text-[15px] leading-relaxed text-zr-text-muted">{modulo.resumen}</p>
              ) : !modulo.competencias?.length ? (
                <p className="text-sm text-zr-text-muted">
                  Todavía no se ha cargado el contenido de este módulo.
                </p>
              ) : null}

              {modulo.competencias && modulo.competencias.length > 0 && (
                <ul className="space-y-3 pt-1">
                  {modulo.competencias.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] text-zr-text">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zr-blue/15 text-zr-blue-mid">
                        <IconoCheck size={13} />
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-zr-text-muted">
                <IconoAviso size={15} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                Las competencias no se califican en esta fase. Están aquí para que sepas hacia dónde vas.
              </p>
            </Seccion>

            <Regla delay={200} />

            {/* Acción primaria: entrar al recorrido del Aula Virtual (material,
                exámenes y tareas de este módulo) — es el centro de la vida del
                estudiante, así que va destacada. */}
            <Link
              href="/unidades"
              className="flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-zr-blue-deep to-zr-blue px-6 py-5 text-white transition-all hover:shadow-lg hover:shadow-zr-blue/25"
            >
              <span className="min-w-0">
                <span className="block text-base font-bold">Entrar al Aula Virtual</span>
                <span className="mt-0.5 block text-xs text-white/70">Material, exámenes y tareas de este módulo</span>
              </span>
              <IconoChevron size={20} className="shrink-0 -rotate-90 text-white/80" />
            </Link>

            {/* Secundario: la malla completa del programa (Módulo 7 de la spec),
                como enlace ligero, no como otro cuadro. */}
            <Link
              href="/malla"
              className="flex items-center justify-between gap-3 py-1 text-sm font-bold text-zr-text-muted transition-colors hover:text-zr-text"
            >
              Ver la malla curricular completa
              <IconoChevron size={16} className="shrink-0 -rotate-90" />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
