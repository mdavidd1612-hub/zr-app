'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoAviso, IconoDuda } from '@/components/ui/Iconos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 5): el estudiante manda una
 * duda corta, y puede editar o borrar solo las suyas mientras no la haya
 * respondido el profesor (esa parte del profesor no se construye en esta
 * fase). No es anónima — RLS en supabase/migrations/034_doubts.sql.
 *
 * Aula Virtual (migración 180): la duda se puede ligar a una unidad
 * concreta (si se llega desde /unidades/[id] vía ?unidad=), y se ve el
 * hilo de respuestas -- la oficial, marcada, es la del profesor.
 */

interface Respuesta {
  id: string
  body: string
  isOfficial: boolean
  createdAt: string
}

interface Duda {
  id: string
  body: string
  createdAt: string
  status: string
  unitId: string | null
  respuestas: Respuesta[]
}

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: 'neutro' | 'info' | 'exito' }> = {
  abierta: { texto: 'Abierta', tono: 'neutro' },
  respondida: { texto: 'Respondida', tono: 'info' },
  resuelta: { texto: 'Resuelta', tono: 'exito' },
}

export default function Dudas() {
  return (
    <Suspense fallback={<PantallaEsqueleto />}>
      <DudasInterno />
    </Suspense>
  )
}

function DudasInterno() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unidadPreseleccionada = searchParams.get('unidad')

  const [userId, setUserId] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [dudas, setDudas] = useState<Duda[]>([])
  const [unidadNombre, setUnidadNombre] = useState<Record<string, string>>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)

  async function cargarDudas(uid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('doubts')
      .select('id, body, created_at, status, unit_id, doubt_responses(id, body, is_official, created_at)')
      .eq('student_id', uid)
      .order('created_at', { ascending: false })

    const filas = (data ?? []).map((d) => ({
      id: d.id, body: d.body, createdAt: d.created_at, status: d.status, unitId: d.unit_id,
      respuestas: ((d.doubt_responses ?? []) as unknown as Array<{ id: string; body: string; is_official: boolean; created_at: string }>)
        .map((r) => ({ id: r.id, body: r.body, isOfficial: r.is_official, createdAt: r.created_at })),
    }))
    setDudas(filas)

    // Nombre de la unidad ligada, para mostrarlo en cada duda (antes la
    // conexión existía pero no se veía desde el estudiante).
    const ids = Array.from(new Set(filas.map((d) => d.unitId).filter((x): x is string => !!x)))
    if (unidadPreseleccionada) ids.push(unidadPreseleccionada)
    if (ids.length > 0) {
      const { data: unidades } = await supabase.from('units').select('id, title').in('id', ids)
      setUnidadNombre(Object.fromEntries((unidades ?? []).map((u) => [u.id, u.title])))
    }
  }

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)
      await cargarDudas(user.id)
      setCargando(false)
    }
    cargar()
  }, [router])

  async function enviarDuda() {
    if (!userId || !texto.trim()) return
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.from('doubts').insert({
      student_id: userId,
      body: texto.trim(),
      unit_id: unidadPreseleccionada || null,
    })
    if (!error) {
      setTexto('')
      await cargarDudas(userId)
    }
    setEnviando(false)
  }

  function empezarEdicion(d: Duda) {
    setEditandoId(d.id)
    setTextoEdicion(d.body)
  }

  async function guardarEdicion() {
    if (!userId || !editandoId || !textoEdicion.trim()) return
    const supabase = createClient()
    const { error } = await supabase
      .from('doubts')
      .update({ body: textoEdicion.trim() })
      .eq('id', editandoId)
    if (!error) {
      setEditandoId(null)
      await cargarDudas(userId)
    }
  }

  async function eliminarDuda(id: string) {
    if (!userId) return
    const supabase = createClient()
    const { error } = await supabase.from('doubts').delete().eq('id', id)
    if (!error) await cargarDudas(userId)
  }

  async function marcarResuelta(id: string) {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('doubts').update({ status: 'resuelta' }).eq('id', id)
    await cargarDudas(userId)
  }

  if (cargando) {
    return (
      <PantallaEsqueleto />
    )
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href="/" />

        <Seccion numero={1} titulo="Mandar una duda" delay={60}>
          <div id="tour-dudas" className="space-y-4">
            {unidadPreseleccionada && (
              <p className="flex items-center gap-2 text-xs font-semibold text-zr-blue-mid">
                <IconoDuda size={15} className="shrink-0" />
                Se va a ligar a la unidad{unidadNombre[unidadPreseleccionada] ? `: ${unidadNombre[unidadPreseleccionada]}` : ' desde la que entraste'}.
              </p>
            )}
            <div>
              <label htmlFor="d-txt" className="mb-2 block text-sm font-semibold text-zr-text">
                ¿Qué es lo que no te quedó claro? Escríbelo como pregunta.
              </label>
              <textarea
                id="d-txt"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Por ejemplo: ¿por qué se revisa primero lo que está a la vista?"
                className="min-h-[96px] w-full rounded-xl border border-zr-border bg-zr-surface/40 p-4 text-sm text-zr-text outline-none transition-colors focus:border-zr-blue"
              />
            </div>
            <button
              onClick={enviarDuda}
              disabled={!texto.trim() || enviando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white transition-colors active:bg-zr-blue-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enviando ? 'Enviando…' : 'Enviar mi duda'}
            </button>
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-zr-text-muted">
            <IconoAviso size={15} className="mt-0.5 shrink-0 text-zr-blue-mid" />
            <span>Tu profesor las agrupa y responde las más repetidas el sábado. <b className="text-zr-text">No es anónima</b>, para que pueda volver contigo.</span>
          </p>
        </Seccion>

        <Regla delay={100} />

        <Seccion numero={2} titulo="Las que has mandado" delay={140}>
          {dudas.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Todavía no has mandado ninguna duda.</p>
          ) : (
            <div className="divide-y divide-zr-border/60">
              {dudas.map((d) => {
                const estado = ETIQUETA_ESTADO[d.status] ?? ETIQUETA_ESTADO.abierta
                const unidad = d.unitId ? unidadNombre[d.unitId] : null
                return (
                  <div key={d.id} className="space-y-3 py-4 first:pt-0">
                    {editandoId === d.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={textoEdicion}
                          onChange={(e) => setTextoEdicion(e.target.value)}
                          className="min-h-[80px] w-full rounded-lg border border-zr-border bg-zr-bg p-3 text-sm text-zr-text outline-none focus:border-zr-blue"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={guardarEdicion}
                            disabled={!textoEdicion.trim()}
                            className="flex-1 rounded-lg bg-zr-blue py-2.5 text-sm font-bold text-white disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="flex-1 rounded-lg border border-zr-border py-2.5 text-sm font-semibold text-zr-text"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {unidad && (
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zr-blue-mid">
                            Unidad · {unidad}
                          </p>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm leading-relaxed text-zr-text">{d.body}</p>
                          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                        </div>

                        {d.respuestas.length > 0 && (
                          <div className="space-y-2 border-l-2 border-zr-blue/30 pl-3">
                            {d.respuestas.map((r) => (
                              <div key={r.id}>
                                {r.isOfficial && <Etiqueta tono="exito">Respuesta del profesor</Etiqueta>}
                                <p className="mt-1 text-sm leading-relaxed text-zr-text-muted">{r.body}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-zr-text-muted">
                            {new Date(d.createdAt).toLocaleDateString('es-VE', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                          <div className="flex gap-4">
                            {d.status !== 'resuelta' && (
                              <button onClick={() => marcarResuelta(d.id)} className="text-xs font-bold text-zr-success">
                                Marcar resuelta
                              </button>
                            )}
                            {/* L-8: una vez respondida, no se puede editar ni
                                borrar — si no, el profesor pierde el contexto
                                de lo que respondió. */}
                            {d.respuestas.length === 0 && (
                              <>
                                <button
                                  onClick={() => empezarEdicion(d)}
                                  className="text-xs font-bold text-zr-blue-mid"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => eliminarDuda(d.id)}
                                  className="text-xs font-bold text-zr-error"
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
