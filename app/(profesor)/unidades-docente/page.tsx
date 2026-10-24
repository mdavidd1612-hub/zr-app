'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { ContextoDocente, type ContextoSel } from '@/components/ui/ContextoDocente'
import { IconoChevron } from '@/components/ui/Iconos'

/**
 * Aula Virtual — el profesor crea y administra las unidades de su módulo.
 * Mismo patrón de selección de contexto (programa/módulo) que el resto de
 * las pantallas de docencia (contenido-docente, crear-examen).
 */

interface UnidadFila {
  id: string
  title: string
  order_index: number
  open_at: string | null
  close_at: string | null
}

function ESTADO(u: UnidadFila): { texto: string; tono: 'exito' | 'aviso' | 'neutro' } {
  const ahora = Date.now()
  if (!u.open_at) return { texto: 'Borrador', tono: 'neutro' }
  if (new Date(u.open_at).getTime() > ahora) return { texto: 'Programada', tono: 'aviso' }
  if (u.close_at && new Date(u.close_at).getTime() < ahora) return { texto: 'Cerrada', tono: 'neutro' }
  return { texto: 'Abierta', tono: 'exito' }
}

function UnidadesInterno({ ctx }: { ctx: ContextoSel }) {
  const [unidades, setUnidades] = useState<UnidadFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('units')
      .select('id, title, order_index, open_at, close_at')
      .eq('module_id', ctx.moduleId)
      .order('order_index', { ascending: true })
    setUnidades((data ?? []) as UnidadFila[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [ctx.moduleId]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  async function crearUnidad() {
    if (!titulo.trim()) return
    setCreando(true)
    setError(null)
    const supabase = createClient()
    const siguienteOrden = unidades.length > 0 ? Math.max(...unidades.map((u) => u.order_index)) + 1 : 1
    const { error: err } = await supabase.from('units').insert({
      module_id: ctx.moduleId,
      title: titulo.trim(),
      order_index: siguienteOrden,
    })
    if (err) {
      setError(err.message)
    } else {
      setTitulo('')
      setFormAbierto(false)
      await cargar()
    }
    setCreando(false)
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  return (
    <div className="space-y-11">
      <Seccion numero={1} titulo="Nueva unidad" delay={60}>
        {!formAbierto ? (
          <button
            onClick={() => setFormAbierto(true)}
            className="min-h-14 w-full rounded-lg border border-dashed border-zr-border text-sm font-bold text-zr-text-muted"
          >
            + Agregar unidad
          </button>
        ) : (
          <div className="zr-card space-y-4 p-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Título de la unidad</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Diagnóstico de inyección electrónica"
                className="min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
              />
            </div>
            <p className="text-xs text-zr-text-muted">
              Se crea como borrador (no la ve ningún estudiante). Entra a la unidad para agregar
              material, examen o tarea, y para programar cuándo se abre.
            </p>
            {error && <p className="text-sm text-zr-error">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={crearUnidad}
                disabled={!titulo.trim() || creando}
                className="flex-1 rounded-lg bg-zr-blue py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {creando ? 'Creando…' : 'Crear unidad'}
              </button>
              <button
                onClick={() => { setFormAbierto(false); setTitulo('') }}
                className="flex-1 rounded-lg border border-zr-border py-3 text-sm font-semibold text-zr-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Seccion>

      <Regla delay={100} />

      <Seccion numero={2} titulo="Unidades de este módulo" delay={140}>
        {unidades.length === 0 ? (
          <p className="text-sm text-zr-text-muted">Todavía no has creado ninguna unidad.</p>
        ) : (
          <div className="space-y-3">
            {unidades.map((u, i) => {
              const estado = ESTADO(u)
              return (
                <Link
                  key={u.id}
                  href={`/unidades-docente/${u.id}`}
                  className="zr-card zr-card-interactive flex items-center justify-between gap-3 p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">Unidad {i + 1}</p>
                    <p className="mt-1 truncate text-base font-bold text-zr-text">{u.title}</p>
                    <div className="mt-2"><Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta></div>
                  </div>
                  <IconoChevron size={20} className="shrink-0 text-zr-text-muted" />
                </Link>
              )
            })}
          </div>
        )}
      </Seccion>
    </div>
  )
}

export default function UnidadesDocente() {
  return (
    <ContextoDocente sobretitulo="Aula Virtual" titulo="Unidades">
      {(ctx) => <UnidadesInterno ctx={ctx} />}
    </ContextoDocente>
  )
}
