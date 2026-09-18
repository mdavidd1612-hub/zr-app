'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { ResultadosFeedback, type FilaResumenFeedback } from '@/components/ui/ResultadosFeedback'
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
 * estudiante, mismo criterio que el feedback por clase). Sin resumen con IA
 * por ahora (decisión del coordinador, sept. 2026): solo estadística.
 */

interface Cohorte {
  id: string
  nombre: string
  moduloId: string | null
  moduloNombre: string | null
}

interface Pregunta {
  id: string
  texto: string
  tipo: 'escala_1_5' | 'redaccion'
}

export default function FeedbackModulos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState<string | null>(null)

  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [maxPreguntas, setMaxPreguntas] = useState(6)
  const [guardandoPreguntas, setGuardandoPreguntas] = useState(false)
  const [errorPreguntas, setErrorPreguntas] = useState<string | null>(null)
  const [huboCambioPreguntas, setHuboCambioPreguntas] = useState(false)

  const [ventanaAbierta, setVentanaAbierta] = useState(false)
  const [guardandoVentana, setGuardandoVentana] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const [filas, setFilas] = useState<FilaResumenFeedback[]>([])

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

      const [{ data: cohs }, { data: cfgPreguntas }, { data: cfgMax }] = await Promise.all([
        supabase
          .from('cohorts')
          .select('id, name, current_module_id, modules(name)')
          .eq('status', 'activa'),
        supabase.from('system_config').select('value').eq('key', 'feedback.macro_questions').maybeSingle(),
        supabase.from('system_config').select('value').eq('key', 'feedback.macro_max_questions').maybeSingle(),
      ])

      setPreguntas((cfgPreguntas?.value as unknown as Pregunta[]) ?? [])
      setMaxPreguntas(typeof cfgMax?.value === 'number' ? cfgMax.value : 6)

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

  function agregarPregunta() {
    if (preguntas.length >= maxPreguntas) return
    setPreguntas((p) => [...p, { id: `pregunta_${Date.now()}`, texto: '', tipo: 'escala_1_5' }])
    setHuboCambioPreguntas(true)
  }

  function editarPregunta(id: string, texto: string) {
    setPreguntas((p) => p.map((q) => (q.id === id ? { ...q, texto } : q)))
    setHuboCambioPreguntas(true)
  }

  function cambiarTipoPregunta(id: string, tipo: Pregunta['tipo']) {
    setPreguntas((p) => p.map((q) => (q.id === id ? { ...q, tipo } : q)))
    setHuboCambioPreguntas(true)
  }

  function borrarPregunta(id: string) {
    setPreguntas((p) => p.filter((q) => q.id !== id))
    setHuboCambioPreguntas(true)
  }

  async function guardarPreguntas() {
    if (preguntas.some((p) => !p.texto.trim())) {
      setErrorPreguntas('Ninguna pregunta puede quedar vacía. Bórrala o escríbele algo.')
      return
    }
    setGuardandoPreguntas(true)
    setErrorPreguntas(null)

    const { error: fallo } = await createClient()
      .from('system_config')
      .update({ value: preguntas as never })
      .eq('key', 'feedback.macro_questions')

    if (fallo) {
      setErrorPreguntas('No se pudo guardar. Intenta de nuevo.')
      setGuardandoPreguntas(false)
      return
    }

    setHuboCambioPreguntas(false)
    setGuardandoPreguntas(false)
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

      {!cohorteActual && (
        <Seccion numero={1} titulo="Preguntas del formulario" delay={90}>
          <p className="text-xs text-zr-text-muted">
            Las mismas preguntas aplican para todas las cohortes. Cada una se responde en escala
            de 1 a 5. Máximo {maxPreguntas} preguntas.
          </p>
          <div className="space-y-3">
            {preguntas.map((p, i) => (
              <div key={p.id} className="zr-card space-y-2.5 p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-3 shrink-0 text-xs font-bold text-zr-text-muted">{i + 1}</span>
                  <textarea
                    value={p.texto}
                    onChange={(e) => editarPregunta(p.id, e.target.value)}
                    rows={2}
                    placeholder="Escribe la pregunta…"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                  />
                  <button
                    onClick={() => borrarPregunta(p.id)}
                    className="mt-1 shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-zr-error"
                  >
                    Borrar
                  </button>
                </div>
                <div className="ml-6 flex gap-2">
                  {(['escala_1_5', 'redaccion'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => cambiarTipoPregunta(p.id, t)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        p.tipo === t ? 'bg-zr-blue text-white' : 'bg-zr-bg text-zr-text-muted'
                      }`}
                    >
                      {t === 'escala_1_5' ? 'Escala 1-5' : 'Redacción'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={agregarPregunta}
            disabled={preguntas.length >= maxPreguntas}
            className="w-full rounded-lg border border-zr-blue/40 py-2.5 text-sm font-bold text-zr-blue-mid disabled:cursor-not-allowed disabled:opacity-30"
          >
            + Agregar pregunta
          </button>

          {errorPreguntas && (
            <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
              {errorPreguntas}
            </p>
          )}

          <button
            onClick={guardarPreguntas}
            disabled={!huboCambioPreguntas || guardandoPreguntas}
            className="w-full rounded-lg bg-zr-blue py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {guardandoPreguntas ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </Seccion>
      )}

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
            <ResultadosFeedback filas={filas} />
          </Seccion>
        </>
      )}
    </div>
  )
}
