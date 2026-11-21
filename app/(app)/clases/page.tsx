'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PestanasMiModulo } from '@/components/ui/PestanasMiModulo'
import { TarjetaHero } from '@/components/ui/TarjetaHero'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoCheck, IconoAviso, IconoChevron, IconoProgreso, IconoDocumento, IconoCarpeta } from '@/components/ui/Iconos'
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
        // week_number es la semana del PROGRAMA completo (p. ej. 13), no la del
        // módulo: la semana del módulo es la posición de la clase dentro de
        // las sesiones de ese módulo (19-nov-2026, mostraba "Semana 13 de 4").
        const idxProxima = filas.findIndex((s) => s.session_date >= hoy)
        const semanaActual = Math.min(
          Math.max(1, mod.duration_weeks ?? 1),
          idxProxima >= 0 ? idxProxima + 1 : Math.max(1, filas.length),
        )

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

  const avance = modulo
    ? Math.min(100, Math.round((modulo.semanaActual / Math.max(1, modulo.duracionSemanas)) * 100))
    : 0

  return (
    <div className="px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-7">
        <BotonVolver href="/" />
        <PestanasMiModulo />

        {!modulo ? (
          <EstadoVacio
            Icono={IconoProgreso}
            titulo="Todavía no tienes módulo asignado"
            explicacion="Cuando la academia te asigne un programa, aquí vas a ver en qué módulo estás y qué vas a aprender."
          />
        ) : (
          <>
            <div id="tour-modulo" className="animate-rise">
              <TarjetaHero
                sobretitulo={`Mi avance · Semana ${modulo.semanaActual} de ${modulo.duracionSemanas}`}
                titulo={modulo.nombre}
                icono={<IconoProgreso size={24} />}
              >
                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${avance}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white/75">{avance}% del módulo</p>
                </div>
              </TarjetaHero>
            </div>

            <Seccion numero={1} titulo="Lo que se aprende aquí" delay={120}>
              <div className="zr-card space-y-4 p-5">
                {modulo.resumen ? (
                  <p className="text-[15px] leading-relaxed text-zr-text-muted">{modulo.resumen}</p>
                ) : !modulo.competencias?.length ? (
                  <p className="text-sm text-zr-text-muted">
                    Todavía no se ha cargado el contenido de este módulo.
                  </p>
                ) : null}

                {modulo.competencias && modulo.competencias.length > 0 && (
                  <ul className="space-y-3">
                    {modulo.competencias.map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] text-zr-text">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zr-blue/15 text-zr-blue-mid ring-1 ring-zr-blue/25">
                          <IconoCheck size={13} />
                        </span>
                        <span className="min-w-0 break-words">{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-zr-text-muted">
                <IconoAviso size={15} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                Las competencias no se califican en esta fase. Están aquí para que sepas hacia dónde vas.
              </p>
            </Seccion>

            <Seccion numero={2} titulo="Sigue por aquí" delay={200}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/unidades" className="zr-card flex items-center gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zr-blue/15 text-zr-blue-mid ring-1 ring-zr-blue/25">
                    <IconoDocumento size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-zr-text">Ir a Unidades</span>
                    <span className="mt-0.5 block text-xs text-zr-text-muted">Material, exámenes y tareas</span>
                  </span>
                  <IconoChevron size={18} className="shrink-0 -rotate-90 text-zr-text-muted" />
                </Link>
                <Link href="/malla" className="zr-card flex items-center gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zr-blue/15 text-zr-blue-mid ring-1 ring-zr-blue/25">
                    <IconoCarpeta size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-zr-text">Malla curricular</span>
                    <span className="mt-0.5 block text-xs text-zr-text-muted">Todos los módulos del programa</span>
                  </span>
                  <IconoChevron size={18} className="shrink-0 -rotate-90 text-zr-text-muted" />
                </Link>
              </div>
            </Seccion>
          </>
        )}
      </div>
    </div>
  )
}
