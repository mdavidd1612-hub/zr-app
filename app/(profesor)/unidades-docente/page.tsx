'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { ContextoDocente, type ContextoSel } from '@/components/ui/ContextoDocente'
import { IconoChevron } from '@/components/ui/Iconos'
import { estadoUnidad } from '@/lib/estado-unidad'
import { eliminarUnidad, renombrarUnidad, resumenAntesDeEliminar, type ResumenUnidad } from '@/lib/eliminar-unidad'

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
  manual_status: 'abierta' | 'cerrada' | null
}

function UnidadesInterno({ ctx }: { ctx: ContextoSel }) {
  const [unidades, setUnidades] = useState<UnidadFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Renombrar/eliminar unidad (pedido explícito del coordinador, 7-nov-2026:
  // "si quiero eliminar inglés 1 etcétera").
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [tituloEdicion, setTituloEdicion] = useState('')
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [resumenBorrado, setResumenBorrado] = useState<ResumenUnidad | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  function limpiarAcciones() {
    setEditandoId(null)
    setBorrandoId(null)
    setResumenBorrado(null)
    setErrorAccion(null)
  }

  async function abrirBorrado(u: UnidadFila) {
    setEditandoId(null)
    setBorrandoId(u.id)
    setErrorAccion(null)
    setCargandoResumen(true)
    setResumenBorrado(await resumenAntesDeEliminar(u.id))
    setCargandoResumen(false)
  }

  async function confirmarRenombrar() {
    if (!editandoId) return
    setGuardandoAccion(true)
    const { error: err } = await renombrarUnidad(editandoId, tituloEdicion)
    setGuardandoAccion(false)
    if (err) { setErrorAccion(err); return }
    limpiarAcciones()
    await cargar()
  }

  async function confirmarBorrado() {
    if (!borrandoId) return
    setGuardandoAccion(true)
    const { error: err } = await eliminarUnidad(borrandoId)
    setGuardandoAccion(false)
    if (err) { setErrorAccion(err); return }
    limpiarAcciones()
    await cargar()
  }

  async function cargar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('units')
      .select('id, title, order_index, open_at, close_at, manual_status')
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
    <div className="space-y-11 px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      {/* Bug real reportado en la reunión del 7-nov-2026: esta pantalla no
          tenía NINGÚN padding propio -- a diferencia de las otras pantallas
          de docencia que también usan ContextoDocente (contenido-docente,
          dudas-docente, feedback-modulo-docente, temario-docente), esta le
          dejaba el margen entero a ContextoDocente, que no le da ninguno
          cuando el programa/módulo ya está elegido. El texto quedaba pegado
          a los bordes de la pantalla. */}
      {/* Pedido explícito del coordinador (reunión 31-oct-2026): examen y
          material se crean DENTRO de la unidad -- no hacen falta botones de
          crear/subir fuera de ella. (Los que estaban aquí, de la tarde
          anterior, se quitan.) */}
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
              const estado = estadoUnidad(u.open_at, u.close_at, u.manual_status)
              const editandoEsta = editandoId === u.id
              const borrandoEsta = borrandoId === u.id
              return (
                <div key={u.id} className="zr-card space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/unidades-docente/${u.id}`} className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">Unidad {i + 1}</p>
                      <p className="mt-1 break-words text-base font-bold text-zr-text">{u.title}</p>
                      <div className="mt-2"><Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta></div>
                    </Link>
                    <Link href={`/unidades-docente/${u.id}`}>
                      <IconoChevron size={20} className="shrink-0 text-zr-text-muted" />
                    </Link>
                  </div>

                  {!editandoEsta && !borrandoEsta && (
                    <div className="flex gap-3 border-t border-zr-border pt-3">
                      <button
                        onClick={() => { limpiarAcciones(); setEditandoId(u.id); setTituloEdicion(u.title) }}
                        className="min-h-10 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                      >
                        Corregir nombre
                      </button>
                      <button
                        onClick={() => abrirBorrado(u)}
                        className="min-h-10 flex-1 rounded-lg border border-zr-error/40 text-sm font-semibold text-zr-error"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}

                  {editandoEsta && (
                    <div className="space-y-3 border-t border-zr-border pt-3">
                      <input
                        value={tituloEdicion}
                        onChange={(e) => setTituloEdicion(e.target.value)}
                        className="min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
                      />
                      {errorAccion && <p className="text-sm font-medium text-zr-error">{errorAccion}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={limpiarAcciones}
                          className="min-h-11 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmarRenombrar}
                          disabled={!tituloEdicion.trim() || guardandoAccion}
                          className="min-h-11 flex-1 rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-40"
                        >
                          {guardandoAccion ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {borrandoEsta && (
                    <div className="space-y-3 border-t border-zr-border pt-3">
                      <div className="rounded-lg border border-zr-error/30 bg-zr-error/10 p-4">
                        <p className="text-sm font-medium text-zr-error">
                          ¿Eliminar &quot;{u.title}&quot;? No se puede deshacer.
                        </p>
                        {cargandoResumen ? (
                          <p className="mt-2 text-xs text-zr-text-muted">Revisando qué tiene dentro…</p>
                        ) : resumenBorrado && (
                          <ul className="mt-2 space-y-1 text-xs text-zr-text-muted">
                            {resumenBorrado.materialesEnlazados > 0 && (
                              <li>{resumenBorrado.materialesEnlazados} material{resumenBorrado.materialesEnlazados === 1 ? '' : 'es'} enlazado{resumenBorrado.materialesEnlazados === 1 ? '' : 's'} (no se borra, solo se desenlaza)</li>
                            )}
                            {resumenBorrado.examenesEnlazados > 0 && (
                              <li>{resumenBorrado.examenesEnlazados} examen{resumenBorrado.examenesEnlazados === 1 ? '' : 'es'} enlazado{resumenBorrado.examenesEnlazados === 1 ? '' : 's'} (no se borra, solo se desenlaza)</li>
                            )}
                            {resumenBorrado.tareas > 0 && (
                              <li className="font-semibold text-zr-error">
                                {resumenBorrado.tareas} tarea{resumenBorrado.tareas === 1 ? '' : 's'} con {resumenBorrado.entregas} entrega{resumenBorrado.entregas === 1 ? '' : 's'} de estudiantes -- se borran para siempre
                              </li>
                            )}
                            {resumenBorrado.bloquesTexto > 0 && (
                              <li>{resumenBorrado.bloquesTexto} bloque{resumenBorrado.bloquesTexto === 1 ? '' : 's'} de texto -- se borra{resumenBorrado.bloquesTexto === 1 ? '' : 'n'}</li>
                            )}
                            {resumenBorrado.dudas > 0 && (
                              <li>{resumenBorrado.dudas} duda{resumenBorrado.dudas === 1 ? '' : 's'} -- se queda{resumenBorrado.dudas === 1 ? '' : 'n'}, sin esta unidad</li>
                            )}
                          </ul>
                        )}
                      </div>
                      {errorAccion && <p className="text-sm font-medium text-zr-error">{errorAccion}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={limpiarAcciones}
                          className="min-h-11 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmarBorrado}
                          disabled={guardandoAccion || cargandoResumen}
                          className="min-h-11 flex-1 rounded-lg bg-zr-error text-sm font-bold text-white disabled:opacity-40"
                        >
                          {guardandoAccion ? 'Eliminando…' : 'Sí, eliminar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
