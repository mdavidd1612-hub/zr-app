'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoAviso } from '@/components/ui/Iconos'

/**
 * Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 5): el estudiante manda una
 * duda corta, y puede editar o borrar solo las suyas mientras no la haya
 * respondido el profesor (esa parte del profesor no se construye en esta
 * fase). No es anónima — RLS en supabase/migrations/034_doubts.sql.
 */

interface Duda {
  id: string
  body: string
  createdAt: string
}

export default function Dudas() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [dudas, setDudas] = useState<Duda[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)

  async function cargarDudas(uid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('doubts')
      .select('id, body, created_at')
      .eq('student_id', uid)
      .order('created_at', { ascending: false })

    setDudas((data ?? []).map((d) => ({ id: d.id, body: d.body, createdAt: d.created_at })))
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
    const { error } = await supabase.from('doubts').insert({ student_id: userId, body: texto.trim() })
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

        <Seccion numero={1} titulo="Mandar una duda" delay={60}>
          <div id="tour-dudas" className="zr-card space-y-4 p-5">
            <div>
              <label htmlFor="d-txt" className="mb-2 block text-sm font-semibold text-zr-text">
                ¿Qué es lo que no te quedó claro? Escríbelo como pregunta.
              </label>
              <textarea
                id="d-txt"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Por ejemplo: ¿por qué se revisa primero lo que está a la vista?"
                className="min-h-[96px] w-full rounded-lg border border-zr-border bg-zr-bg p-4 text-sm text-zr-text outline-none focus:border-zr-blue"
              />
            </div>
            <button
              onClick={enviarDuda}
              disabled={!texto.trim() || enviando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white transition-colors active:bg-zr-blue-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar mi duda
            </button>
          </div>

          <div className="flex gap-3 rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
            <IconoAviso size={18} className="mt-0.5 shrink-0 text-zr-blue-mid" />
            <p className="text-sm leading-relaxed text-zr-text">
              Tu profesor las agrupa y responde las más repetidas el sábado.{' '}
              <b>No es anónima</b>, para que pueda volver contigo.
            </p>
          </div>
        </Seccion>

        <Regla delay={100} />

        <Seccion numero={2} titulo="Las que has mandado" delay={140}>
          {dudas.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Todavía no has mandado ninguna duda.</p>
          ) : (
            <div className="space-y-3">
              {dudas.map((d) => (
                <div key={d.id} className="zr-card p-4">
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
                      <p className="text-sm leading-relaxed text-zr-text">{d.body}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-zr-text-muted">
                          {new Date(d.createdAt).toLocaleDateString('es-VE', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        <div className="flex gap-4">
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
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
