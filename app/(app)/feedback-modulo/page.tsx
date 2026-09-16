'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoCheck } from '@/components/ui/Iconos'

/**
 * Formulario de feedback de módulo, del lado del estudiante — pedido
 * explícito del coordinador (sept. 2026). Solo se puede responder mientras
 * Dirección Académica tenga la ventana abierta para la cohorte + módulo del
 * estudiante (`feedback_macro_windows`, migración 097) -- la propia RLS de
 * `feedback_macro` ya lo exige del lado del servidor, esta pantalla solo
 * evita que alguien vea un formulario que de todas formas no se va a poder
 * enviar.
 *
 * Las preguntas viven en `system_config` ('feedback.macro_questions'),
 * nunca escritas en el código (regla 5 de AGENTS.md) — Dirección Académica
 * las puede cambiar sin que nadie despliegue nada nuevo.
 */

interface Pregunta {
  id: string
  texto: string
  tipo: 'escala_1_5' | 'redaccion'
}

export default function FeedbackModulo() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState<'sin_ventana' | 'ya_enviado' | 'listo' | 'sin_modulo'>('sin_modulo')
  const [moduloId, setModuloId] = useState<string | null>(null)
  const [moduloNombre, setModuloNombre] = useState('')
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: est }, { data: cfg }] = await Promise.all([
        supabase.from('students').select('cohort_id, cohorts(current_module_id, modules(name))').eq('id', user.id).single(),
        supabase.from('system_config').select('value').eq('key', 'feedback.macro_questions').maybeSingle(),
      ])

      const fila = est as unknown as {
        cohort_id: string | null
        cohorts: { current_module_id: string | null; modules: { name: string } | null } | null
      } | null

      const mId = fila?.cohorts?.current_module_id ?? null
      if (!fila?.cohort_id || !mId) {
        setEstado('sin_modulo')
        setCargando(false)
        return
      }
      setModuloId(mId)
      setModuloNombre(fila.cohorts?.modules?.name ?? 'este módulo')

      const listaPreguntas = ((cfg?.value as unknown as Pregunta[]) ?? [])
        .map((p) => ({ id: p.id, texto: p.texto, tipo: p.tipo ?? 'escala_1_5' }))
      setPreguntas(listaPreguntas)

      const [{ data: ventana }, { data: yaRespondio }] = await Promise.all([
        supabase.from('feedback_macro_windows').select('closed_at')
          .eq('cohort_id', fila.cohort_id).eq('module_id', mId).maybeSingle(),
        supabase.from('feedback_macro').select('id').eq('student_id', user.id).eq('module_id', mId).maybeSingle(),
      ])

      if (yaRespondio) {
        setEstado('ya_enviado')
      } else if (!ventana || ventana.closed_at !== null) {
        setEstado('sin_ventana')
      } else {
        setEstado('listo')
      }
      setCargando(false)
    }

    cargar()
  }, [router])

  async function enviar() {
    if (!moduloId) return
    const preguntasEscala = preguntas.filter((p) => p.tipo === 'escala_1_5')
    if (preguntasEscala.some((p) => respuestas[p.id] === undefined)) {
      setError('Responde todas las preguntas de escala antes de enviar.')
      return
    }
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const answers = preguntasEscala.map((p) => ({ q: p.texto, a: respuestas[p.id] }))
    const openAnswers = preguntas
      .filter((p) => p.tipo === 'redaccion')
      .map((p) => ({ q: p.texto, a: (textos[p.id] ?? '').trim() }))
      .filter((o) => o.a)

    const { error: fallo } = await supabase.from('feedback_macro').insert({
      student_id: user.id,
      module_id: moduloId,
      answers,
      open_answers: openAnswers,
    })

    if (fallo) {
      setError('No se pudo enviar. Intenta de nuevo.')
      setEnviando(false)
      return
    }

    setEstado('ya_enviado')
    setEnviando(false)
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
      <BotonVolver href="/" />

      <Encabezado sobretitulo="Tu opinión" titulo="Feedback del módulo" descripcion={moduloNombre} />

      <Regla delay={60} />

      {estado === 'sin_modulo' ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">No hay ningún módulo activo todavía</p>
        </div>
      ) : estado === 'sin_ventana' ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no hay un formulario abierto</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zr-text-muted">
            Cuando termine el módulo, administración académica abre el formulario y va a aparecer aquí.
          </p>
        </div>
      ) : estado === 'ya_enviado' ? (
        <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
          <IconoCheck size={28} className="text-zr-success" />
          <p className="text-base font-semibold text-zr-text">¡Gracias por tu feedback!</p>
          <p className="max-w-sm text-sm text-zr-text-muted">
            Ya quedó registrado. Tus respuestas son anónimas para el profesor y para Dirección Académica.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {preguntas.map((p) =>
            p.tipo === 'redaccion' ? (
              <div key={p.id} className="zr-card space-y-3 p-5">
                <p className="text-sm font-semibold text-zr-text">{p.texto} <span className="font-normal text-zr-text-muted">(opcional)</span></p>
                <textarea
                  value={textos[p.id] ?? ''}
                  onChange={(e) => setTextos((t) => ({ ...t, [p.id]: e.target.value }))}
                  rows={4}
                  placeholder="Escribe aquí…"
                  className="w-full resize-none rounded-lg border border-zr-border bg-zr-bg p-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                />
              </div>
            ) : (
              <div key={p.id} className="zr-card space-y-4 p-5">
                <p className="text-sm font-semibold text-zr-text">{p.texto}</p>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRespuestas((r) => ({ ...r, [p.id]: n }))}
                      className={`flex h-12 flex-1 items-center justify-center rounded-lg border text-base font-bold transition-colors ${
                        respuestas[p.id] === n
                          ? 'border-zr-blue bg-zr-blue text-white'
                          : 'border-zr-border text-zr-text-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-zr-text-muted">
                  <span>Muy poco</span>
                  <span>Mucho</span>
                </div>
              </div>
            ),
          )}

          {error && (
            <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
              {error}
            </p>
          )}

          <button
            onClick={enviar}
            disabled={enviando}
            className="flex min-h-14 w-full items-center justify-center rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar feedback'}
          </button>
        </div>
      )}
    </div>
  )
}
