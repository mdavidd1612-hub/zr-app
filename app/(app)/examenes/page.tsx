'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'

/**
 * T-305 · Lista de exámenes del estudiante.
 *
 * Un examen `oculto` NO aparece aquí. No se filtra en el cliente por cortesía:
 * las políticas de RLS de la migración 012 devuelven cero filas. El `.in(...)`
 * de abajo es solo para no traer los cerrados de hace tres meses.
 */

type EstadoIntento = 'no_iniciado' | 'en_progreso' | 'entregado' | 'calificado' | 'abandonado'

interface Examen {
  id: string
  titulo: string
  modulo: string
  estadoExamen: string
  estadoIntento: EstadoIntento
  intentoId: string | null
  puntaje: number | null
  puntajeMaximo: number
  cierra: string | null
}

const ESTADO: Record<EstadoIntento, { texto: string; tono: 'exito' | 'aviso' | 'info' | 'neutro' }> = {
  no_iniciado: { texto: 'Sin presentar', tono: 'info'   },
  en_progreso: { texto: 'A medias',      tono: 'aviso'  },
  entregado:   { texto: 'Entregado',     tono: 'aviso'  },
  calificado:  { texto: 'Calificado',    tono: 'exito'  },
  abandonado:  { texto: 'Abandonado',    tono: 'neutro' },
}

export default function Examenes() {
  const router = useRouter()
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [cargando, setCargando] = useState(true)
  const [rehab, setRehab] = useState<{ examenId: string; intentoId: string } | null>(null)
  const [rehabMotivo, setRehabMotivo] = useState('')
  const [enviandoRehab, setEnviandoRehab] = useState(false)
  const [rehabEnviada, setRehabEnviada] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    let userId = ''

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      userId = user.id

      const { data: datos, error } = await supabase
        .from('exams')
        .select('id, title, max_score, status, closes_at, modules(name)')
        .in('status', ['habilitado', 'cerrado', 'calificado'])
        .order('closes_at', { ascending: true, nullsFirst: false })

      if (error || !datos) {
        setExamenes([])
        setCargando(false)
        return
      }

      const filas = datos as unknown as {
        id: string; title: string; max_score: number; status: string
        closes_at: string | null; modules: { name: string } | null
      }[]

      const conIntento = await Promise.all(
        filas.map(async (e) => {
          const { data: intento } = await supabase
            .from('exam_attempts')
            .select('id, status, total_score')
            .eq('exam_id', e.id)
            .eq('student_id', user.id)
            .maybeSingle()

          return {
            id: e.id,
            titulo: e.title,
            modulo: e.modules?.name ?? 'Módulo',
            estadoExamen: e.status,
            estadoIntento: (intento?.status ?? 'no_iniciado') as EstadoIntento,
            intentoId: intento?.id ?? null,
            puntaje: intento?.total_score ?? null,
            puntajeMaximo: Number(e.max_score),
            cierra: e.closes_at,
          }
        }),
      )

      setExamenes(conIntento)
      setCargando(false)

      // Rehab ya enviadas (para no mostrar el botón si ya solicitaron)
      if (conIntento.some(e => e.estadoIntento === 'abandonado' && e.intentoId)) {
        const intentosAbandonados = conIntento
          .filter(e => e.estadoIntento === 'abandonado' && e.intentoId)
          .map(e => e.intentoId!)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: solicitudesExistentes } = await (supabase as any)
          .from('exam_rehabilitation_requests')
          .select('attempt_id')
          .in('attempt_id', intentosAbandonados)

        if (solicitudesExistentes) {
          setRehabEnviada(new Set((solicitudesExistentes as { attempt_id: string }[]).map(s => s.attempt_id)))
        }
      }
    }

    cargar()

    // Suscripción en tiempo real: cuando el profesor califica o aprueba rehabilitación,
    // el estudiante ve el cambio sin tener que recargar la página.
    const canal = supabase
      .channel('mis-intentos')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exam_attempts', filter: `student_id=eq.${userId}` },
        (payload) => {
          const { id, status, total_score } = payload.new as {
            id: string; status: string; total_score: number | null
          }
          setExamenes((prev) =>
            prev.map((e) =>
              e.intentoId === id
                ? { ...e, estadoIntento: status as EstadoIntento, puntaje: total_score }
                : e,
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando exámenes…</p>
      </div>
    )
  }

  async function enviarSolicitudRehab() {
    if (!rehab || enviandoRehab || !rehabMotivo.trim()) return
    setEnviandoRehab(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEnviandoRehab(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('exam_rehabilitation_requests')
      .insert({
        attempt_id: rehab.intentoId,
        student_id: user.id,
        exam_id: rehab.examenId,
        reason: rehabMotivo.trim(),
      })

    if (!error) {
      setRehabEnviada((prev) => new Set([...prev, rehab.intentoId]))
      setRehab(null)
      setRehabMotivo('')
    }
    setEnviandoRehab(false)
  }

  // Presentable solo si el examen sigue habilitado y no lo ha entregado ni abandonado.
  const sePuedePresentar = (e: Examen) =>
    e.estadoExamen === 'habilitado' &&
    e.estadoIntento !== 'entregado' &&
    e.estadoIntento !== 'calificado' &&
    e.estadoIntento !== 'abandonado'

  const pendientes = examenes.filter(sePuedePresentar)
  const cerrados = examenes.filter((e) => !sePuedePresentar(e))

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      {/* Modal de solicitud de rehabilitación */}
      {rehab && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-5 sm:items-center">
          <div className="zr-card w-full max-w-sm animate-rise p-6 space-y-4">
            <p className="zr-display text-xl text-zr-text">Solicitar nueva oportunidad</p>
            <p className="text-sm text-zr-text-muted">
              Explícale al profesor por qué saliste del examen. Él decidirá si te rehabilita para presentarlo de nuevo.
            </p>
            <textarea
              value={rehabMotivo}
              onChange={(e) => setRehabMotivo(e.target.value)}
              placeholder="Mi teléfono se apagó, tuve que atender una emergencia…"
              className="w-full min-h-24 resize-none rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setRehab(null); setRehabMotivo('') }}
                disabled={enviandoRehab}
                className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSolicitudRehab}
                disabled={enviandoRehab || !rehabMotivo.trim()}
                className="flex-1 rounded-lg bg-zr-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {enviandoRehab ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-11">
        <header className="animate-rise">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Evaluaciones
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Exámenes</h1>
          <p className="mt-3 text-base text-zr-text-muted">
            {pendientes.length === 0
              ? 'No tienes exámenes por presentar.'
              : `Tienes ${pendientes.length} por presentar.`}
          </p>
        </header>

        <Regla delay={60} />

        {examenes.length === 0 && (
          <div className="zr-card animate-rise p-8" style={{ animationDelay: '120ms' }}>
            <p className="text-base font-semibold text-zr-text">Todavía no hay exámenes</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Tu profesor publica los exámenes cuando el programa llega a esa parte del módulo.
              Aparecerán aquí en cuanto lo haga.
            </p>
          </div>
        )}

        {pendientes.length > 0 && (
          <Seccion numero={1} titulo="Por presentar" delay={120}>
            <div className="space-y-3">
              {pendientes.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/examenes/${e.id}`)}
                  className="zr-card zr-card-interactive w-full animate-rise p-5 text-left"
                  style={{ animationDelay: `${160 + i * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{e.titulo}</p>
                      <p className="mt-1.5 text-sm text-zr-text-muted">
                        {e.modulo} · {e.puntajeMaximo} puntos
                      </p>
                    </div>
                    <Etiqueta tono={ESTADO[e.estadoIntento].tono}>
                      {ESTADO[e.estadoIntento].texto}
                    </Etiqueta>
                  </div>
                </button>
              ))}
            </div>
          </Seccion>
        )}

        {cerrados.length > 0 && (
          <Seccion
            numero={pendientes.length > 0 ? 2 : 1}
            titulo="Ya presentados"
            delay={pendientes.length > 0 ? 240 : 120}
          >
            <div className="space-y-3">
              {cerrados.map((e) => (
                <div key={e.id} className="zr-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{e.titulo}</p>
                      <p className="mt-1.5 text-sm text-zr-text-muted">{e.modulo}</p>
                      {e.estadoIntento === 'calificado' && (
                        <div className="mt-3 flex items-center gap-4">
                          {e.puntaje !== null && (
                            <p>
                              <span className="zr-metric text-2xl text-zr-blue">{e.puntaje}</span>
                              <span className="ml-1 text-sm text-zr-text-muted">
                                / {e.puntajeMaximo} pts
                              </span>
                            </p>
                          )}
                          <button
                            onClick={() => router.push(`/examenes/${e.id}/revision`)}
                            className="rounded-lg border border-zr-blue px-3 py-1.5 text-xs font-semibold text-zr-blue"
                          >
                            Ver revisión
                          </button>
                        </div>
                      )}
                      {e.estadoIntento === 'entregado' && (
                        <p className="mt-2 text-xs text-zr-text-muted">
                          Tu profesor todavía tiene que calificar las redacciones.
                        </p>
                      )}
                      {e.estadoIntento === 'abandonado' && (
                        <div className="mt-3">
                          {e.intentoId && rehabEnviada.has(e.intentoId) ? (
                            <p className="text-xs text-zr-text-muted">
                              Solicitud enviada · Espera la respuesta del profesor.
                            </p>
                          ) : (
                            <button
                              onClick={() => e.intentoId && setRehab({ examenId: e.id, intentoId: e.intentoId! })}
                              className="rounded-lg border border-zr-blue px-4 py-2 text-xs font-semibold text-zr-blue"
                            >
                              Solicitar nueva oportunidad
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <Etiqueta tono={ESTADO[e.estadoIntento].tono}>
                      {ESTADO[e.estadoIntento].texto}
                    </Etiqueta>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}
      </div>
    </div>
  )
}
