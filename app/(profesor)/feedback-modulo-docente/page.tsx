'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Feedback de módulo, del lado del profesor — pedido explícito del
 * coordinador (sept. 2026): "el profesor le va a llegar solamente el del
 * módulo que le corresponde". Nunca ve una fila por estudiante ni el texto
 * libre en crudo — solo el mismo agregado que ve Dirección Académica
 * (`v_feedback_macro_summary`, migración 097) y el resumen con IA bajo
 * demanda. No puede abrir ni cerrar el formulario, eso es de Dirección
 * Académica (/feedback-modulos).
 *
 * No está en la barra fija del profesor a propósito (Fase 0: "las 5
 * secciones que quedan caben todas en la barra") — se llega desde una
 * tarjeta en /hoy, igual que /feedback-clase/[sessionId] se llega desde
 * /sesiones.
 */

interface Par {
  cohorteId: string
  cohorteNombre: string
  moduloId: string
  moduloNombre: string
}

interface FilaResumen {
  pregunta: string
  promedio: number
  respuestas: number
}

export default function FeedbackModuloDocente() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [pares, setPares] = useState<Par[]>([])
  const [seleccion, setSeleccion] = useState<Par | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [filas, setFilas] = useState<FilaResumen[]>([])

  const [resumenIA, setResumenIA] = useState<string | null>(null)
  const [cantidadComentarios, setCantidadComentarios] = useState<number | null>(null)
  const [pidiendoResumen, setPidiendoResumen] = useState(false)
  const [errorResumen, setErrorResumen] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: asignaciones } = await supabase
        .from('teacher_module_assignments').select('module_id').eq('teacher_id', user.id)
      const moduloIds = (asignaciones ?? []).map((a) => a.module_id)

      if (moduloIds.length === 0) {
        setCargando(false)
        return
      }

      const { data: cohs } = await supabase
        .from('cohorts')
        .select('id, name, current_module_id, modules(name)')
        .eq('status', 'activa')
        .in('current_module_id', moduloIds)

      setPares(
        (cohs ?? []).map((c) => ({
          cohorteId: c.id, cohorteNombre: c.name,
          moduloId: c.current_module_id!, moduloNombre: c.modules?.name ?? 'Módulo',
        })),
      )
      setCargando(false)
    }

    cargar()
  }, [router])

  async function elegir(p: Par) {
    setSeleccion(p)
    setResumenIA(null)
    setCantidadComentarios(null)
    setErrorResumen(null)
    setCargandoDetalle(true)

    const { data: resumen } = await createClient()
      .from('v_feedback_macro_summary')
      .select('question, avg_score, response_count')
      .eq('cohort_id', p.cohorteId).eq('module_id', p.moduloId)

    setFilas((resumen ?? []).map((r) => ({
      pregunta: r.question ?? '', promedio: Number(r.avg_score), respuestas: Number(r.response_count),
    })))
    setCargandoDetalle(false)
  }

  async function pedirResumenIA(p: Par) {
    setPidiendoResumen(true)
    setErrorResumen(null)
    setResumenIA(null)
    try {
      const res = await fetch('/api/feedback-macro/resumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId: p.cohorteId, moduleId: p.moduloId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorResumen(json.error ?? 'No se pudo generar el resumen.')
        return
      }
      setResumenIA(json.resumen)
      setCantidadComentarios(json.cantidadComentarios)
    } catch {
      setErrorResumen('No se pudo conectar. Intenta de nuevo.')
    } finally {
      setPidiendoResumen(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-9 px-5 pb-16 pt-14">
      {seleccion ? (
        <button
          onClick={() => setSeleccion(null)}
          className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-zr-text-muted transition-colors active:text-zr-text"
        >
          ‹ Elegir otra cohorte
        </button>
      ) : (
        <BotonVolver href="/hoy" />
      )}

      <Encabezado
        sobretitulo="Docencia"
        titulo="Feedback de módulo"
        descripcion={seleccion ? `${seleccion.moduloNombre} · ${seleccion.cohorteNombre}` : 'Solo de los módulos que dictas tú.'}
      />

      <Regla delay={60} />

      {!seleccion ? (
        pares.length === 0 ? (
          <EstadoVacio
            titulo="Nada por aquí todavía"
            explicacion="Cuando Dirección Académica abra el formulario de un módulo que dictas, aparece en esta lista."
          />
        ) : (
          <div className="space-y-3">
            {pares.map((p) => (
              <button
                key={`${p.cohorteId}-${p.moduloId}`}
                onClick={() => elegir(p)}
                className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zr-text">{p.moduloNombre}</p>
                  <p className="mt-0.5 text-sm text-zr-text-muted">{p.cohorteNombre}</p>
                </div>
                <span className="shrink-0 text-zr-text-muted">›</span>
              </button>
            ))}
          </div>
        )
      ) : cargandoDetalle ? (
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      ) : (
        <>
          <Seccion numero={1} titulo="Promedio del grupo" delay={120}>
            {filas.length === 0 ? (
              <EstadoVacio
                titulo="Todavía no hay suficientes respuestas"
                explicacion="El promedio solo se muestra a partir de 3 respuestas — así nadie puede adivinar quién dijo qué."
              />
            ) : (
              <div className="space-y-3">
                {filas.map((f) => (
                  <div key={f.pregunta} className="zr-card p-6">
                    <p className="text-sm font-semibold text-zr-text">{f.pregunta}</p>
                    <div className="mt-4 flex items-end gap-2">
                      <span className="zr-metric text-3xl text-zr-blue">{f.promedio.toFixed(1)}</span>
                      <span className="pb-1 text-sm text-zr-text-muted">/ 5</span>
                      <span className="ml-auto pb-1 text-xs text-zr-text-muted">
                        {f.respuestas} respuesta{f.respuestas === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Seccion>

          <Seccion numero={2} titulo="Resumen con IA" delay={180}>
            <p className="text-xs text-zr-text-muted">
              Resume los comentarios de texto libre — necesita al menos 3 para generar algo.
            </p>
            <button
              onClick={() => pedirResumenIA(seleccion)}
              disabled={pidiendoResumen}
              className="w-full rounded-lg border border-zr-blue/40 py-3 text-sm font-bold text-zr-blue-mid disabled:opacity-50"
            >
              {pidiendoResumen ? 'Generando…' : 'Generar resumen con IA'}
            </button>
            {errorResumen && (
              <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
                {errorResumen}
              </p>
            )}
            {resumenIA && (
              <div className="zr-card space-y-2 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-zr-blue-mid">
                  A partir de {cantidadComentarios} comentario{cantidadComentarios === 1 ? '' : 's'}
                </p>
                <p className="text-sm leading-relaxed text-zr-text">{resumenIA}</p>
              </div>
            )}
          </Seccion>
        </>
      )}
    </div>
  )
}
