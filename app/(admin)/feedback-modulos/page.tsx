'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { ordenarCohortesPorPrioridad } from '@/lib/cohortes'
import type { UserRole } from '@/lib/types'

/**
 * Feedback de módulo — pedido explícito del coordinador (sept. 2026), exclusivo
 * de Dirección Académica y super_admin (`esDireccionAcademica`, mismo criterio
 * que Cobertura y Notas). Es la pantalla nueva sobre `feedback_macro`
 * (migración 008), que existía en la base pero nunca se había conectado a
 * ninguna pantalla, y `feedback_macro_windows` (migración 097) para "abrir"
 * el formulario por cohorte y módulo -- nunca de forma global, porque cada
 * cohorte termina un módulo en fecha distinta.
 *
 * El resumen numérico (`v_feedback_macro_summary`) ya viene agregado y con
 * el mínimo de respuestas aplicado desde la base (nunca respuesta por
 * estudiante, mismo criterio que el feedback por clase). El resumen de
 * texto libre lo arma un modelo de lenguaje del lado del servidor
 * (/api/feedback-macro/resumen) -- nunca se procesa aquí ni se guarda
 * automáticamente, se pide bajo demanda.
 */

interface Cohorte {
  id: string
  nombre: string
  moduloId: string | null
  moduloNombre: string | null
}

interface FilaResumen {
  pregunta: string
  promedio: number
  respuestas: number
}

export default function FeedbackModulos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState<string | null>(null)

  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [guardandoVentana, setGuardandoVentana] = useState(false)
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

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const rol = perfil?.role as UserRole | undefined
      if (!esDireccionAcademica(rol)) {
        setAutorizado(false)
        setCargando(false)
        return
      }
      setAutorizado(true)

      const { data: cohs } = await supabase
        .from('cohorts')
        .select('id, name, current_module_id, modules(name)')
        .eq('status', 'activa')

      setCohortes(
        ordenarCohortesPorPrioridad((cohs ?? []) as unknown as { id: string; name: string }[])
          .map((c) => {
            const fila = (cohs ?? []).find((x) => x.id === c.id) as unknown as {
              current_module_id: string | null; modules: { name: string } | null
            }
            return {
              id: c.id, nombre: c.name,
              moduloId: fila?.current_module_id ?? null,
              moduloNombre: fila?.modules?.name ?? null,
            }
          }),
      )
      setCargando(false)
    }

    cargar()
  }, [router])

  async function elegirCohorte(c: Cohorte) {
    setCohorteId(c.id)
    setResumenIA(null)
    setCantidadComentarios(null)
    setErrorResumen(null)
    if (!c.moduloId) { setFilas([]); return }

    setCargandoDetalle(true)
    const supabase = createClient()

    const [{ data: ventana }, { data: resumen }] = await Promise.all([
      supabase
        .from('feedback_macro_windows')
        .select('closed_at')
        .eq('cohort_id', c.id).eq('module_id', c.moduloId)
        .maybeSingle(),
      supabase
        .from('v_feedback_macro_summary')
        .select('question, avg_score, response_count')
        .eq('cohort_id', c.id).eq('module_id', c.moduloId),
    ])

    setVentanaAbierta(Boolean(ventana) && ventana?.closed_at === null)
    setFilas((resumen ?? []).map((r) => ({
      pregunta: r.question ?? '', promedio: Number(r.avg_score), respuestas: Number(r.response_count),
    })))
    setCargandoDetalle(false)
  }

  async function alternarVentana(c: Cohorte) {
    if (!c.moduloId) return
    setGuardandoVentana(true)
    const supabase = createClient()

    if (ventanaAbierta) {
      await supabase.from('feedback_macro_windows')
        .update({ closed_at: new Date().toISOString() })
        .eq('cohort_id', c.id).eq('module_id', c.moduloId)
      setVentanaAbierta(false)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      // Reabrir = volver a poner closed_at en null, nunca duplicar fila
      // (unique(cohort_id, module_id), migración 097).
      await supabase.from('feedback_macro_windows').upsert(
        { cohort_id: c.id, module_id: c.moduloId, opened_by: user?.id ?? null, opened_at: new Date().toISOString(), closed_at: null },
        { onConflict: 'cohort_id,module_id' },
      )
      setVentanaAbierta(true)
    }
    setGuardandoVentana(false)
  }

  async function pedirResumenIA(c: Cohorte) {
    if (!c.moduloId) return
    setPidiendoResumen(true)
    setErrorResumen(null)
    setResumenIA(null)

    try {
      const res = await fetch('/api/feedback-macro/resumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId: c.id, moduleId: c.moduloId }),
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

  if (!autorizado) {
    return (
      <div className="space-y-5 px-5 pt-14">
        <BotonVolver href="/panel" />
        <p className="text-sm text-zr-text-muted">Solo Dirección Académica o super_admin pueden entrar aquí.</p>
      </div>
    )
  }

  const cohorteActual = cohortes.find((c) => c.id === cohorteId) ?? null

  return (
    <div className="space-y-9 px-5 pb-16 pt-14">
      {cohorteActual ? (
        <button
          onClick={() => setCohorteId(null)}
          className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-zr-text-muted transition-colors active:text-zr-text"
        >
          ‹ Elegir otra cohorte
        </button>
      ) : (
        <BotonVolver href="/panel" />
      )}

      <Encabezado
        sobretitulo="Dirección académica"
        titulo="Feedback de módulo"
        descripcion={cohorteActual ? cohorteActual.nombre : 'Elige la cohorte para abrir o revisar su formulario.'}
      />

      <Regla delay={60} />

      {!cohorteActual ? (
        cohortes.length === 0 ? (
          <EstadoVacio titulo="Sin cohortes activas" explicacion="No hay ninguna cohorte activa todavía." />
        ) : (
          <div className="space-y-3">
            {cohortes.map((c) => (
              <button
                key={c.id}
                onClick={() => elegirCohorte(c)}
                className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zr-text">{c.nombre}</p>
                  <p className="mt-0.5 text-sm text-zr-text-muted">
                    {c.moduloNombre ?? 'Sin módulo asignado todavía'}
                  </p>
                </div>
                <span className="shrink-0 text-zr-text-muted">›</span>
              </button>
            ))}
          </div>
        )
      ) : !cohorteActual.moduloId ? (
        <EstadoVacio titulo="Esta cohorte no tiene módulo actual" explicacion="Asígnale un módulo antes de abrir el formulario de feedback." />
      ) : cargandoDetalle ? (
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      ) : (
        <>
          <Seccion numero={1} titulo="Formulario" delay={120}>
            <div className="zr-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zr-text">{cohorteActual.moduloNombre}</p>
                  <p className="mt-0.5 text-xs text-zr-text-muted">
                    {ventanaAbierta ? 'Abierto — los estudiantes ya pueden responder' : 'Cerrado'}
                  </p>
                </div>
                <button
                  onClick={() => alternarVentana(cohorteActual)}
                  disabled={guardandoVentana}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                    ventanaAbierta ? 'bg-zr-error' : 'bg-zr-blue'
                  }`}
                >
                  {guardandoVentana ? '…' : ventanaAbierta ? 'Cerrar' : 'Abrir formulario'}
                </button>
              </div>
            </div>
          </Seccion>

          <Seccion numero={2} titulo="Resultados" delay={180}>
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

          <Seccion numero={3} titulo="Resumen con IA" delay={240}>
            <p className="text-xs text-zr-text-muted">
              Resume los comentarios de texto libre — necesita al menos 3 para generar algo (mismo
              criterio de anonimato que los promedios de arriba).
            </p>
            <button
              onClick={() => pedirResumenIA(cohorteActual)}
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
