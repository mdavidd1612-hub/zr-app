'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoDocumento, IconoExamen, IconoDuda } from '@/components/ui/Iconos'

/**
 * Aula Virtual — el profesor administra el contenido de UNA unidad: fechas
 * de apertura/cierre, y sus elementos (material existente, examen existente,
 * tarea nueva). El material y los exámenes se crean en sus pantallas de
 * siempre (contenido-docente, crear-examen) -- aquí solo se ENLAZAN a la
 * unidad, para no duplicar esos flujos.
 */

interface Item {
  id: string
  type: 'material' | 'quiz' | 'tarea' | 'dudas'
  required: boolean
  titulo: string
  assignmentId: string | null
}

interface Opcion { id: string; title: string }

export default function UnidadDocenteDetalle() {
  const router = useRouter()
  const params = useParams()
  const unitId = params.unitId as string

  const [titulo, setTitulo] = useState('')
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [materialesDisponibles, setMaterialesDisponibles] = useState<Opcion[]>([])
  const [examenesDisponibles, setExamenesDisponibles] = useState<Opcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tarea nueva (sin pantalla propia todavía -- se crea aquí mismo).
  const [tareaTitulo, setTareaTitulo] = useState('')
  const [tareaFecha, setTareaFecha] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)

  async function cargar() {
    const supabase = createClient()
    const { data: unidad } = await supabase
      .from('units').select('title, module_id, open_at, close_at').eq('id', unitId).maybeSingle()
    if (!unidad) { router.replace('/unidades-docente'); return }
    setTitulo(unidad.title)
    setOpenAt(unidad.open_at ? unidad.open_at.slice(0, 16) : '')
    setCloseAt(unidad.close_at ? unidad.close_at.slice(0, 16) : '')

    const { data: filas } = await supabase
      .from('unit_items')
      .select('id, type, required, assignment_id, content_items(title), exams(title), assignments(title)')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: true })

    setItems(
      (filas ?? []).map((f) => {
        const ci = f.content_items as unknown as { title: string } | null
        const ex = f.exams as unknown as { title: string } | null
        const ta = f.assignments as unknown as { title: string } | null
        return {
          id: f.id, type: f.type, required: f.required,
          titulo: ci?.title ?? ex?.title ?? ta?.title ?? (f.type === 'dudas' ? 'Dudas de esta unidad' : ''),
          assignmentId: f.assignment_id,
        }
      }),
    )

    const { data: materiales } = await supabase
      .from('content_items').select('id, title').eq('module_id', unidad.module_id).order('title')
    const { data: examenes } = await supabase
      .from('exams').select('id, title').eq('module_id', unidad.module_id).order('title')

    setMaterialesDisponibles((materiales ?? []) as Opcion[])
    setExamenesDisponibles((examenes ?? []) as Opcion[])

    setCargando(false)
  }

  useEffect(() => { cargar() }, [unitId]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  async function guardarFechas() {
    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('units')
      .update({
        open_at: openAt ? new Date(openAt).toISOString() : null,
        close_at: closeAt ? new Date(closeAt).toISOString() : null,
      })
      .eq('id', unitId)
    if (err) setError(err.message)
    setGuardando(false)
  }

  async function agregarItem(tipo: 'material' | 'quiz' | 'dudas', refId?: string) {
    if ((tipo === 'material' || tipo === 'quiz') && !refId) return
    setError(null)
    const supabase = createClient()
    const siguienteOrden = items.length > 0 ? items.length + 1 : 1
    const { error: err } = await supabase.from('unit_items').insert({
      unit_id: unitId,
      type: tipo,
      order_index: siguienteOrden,
      content_item_id: tipo === 'material' ? refId : null,
      exam_id: tipo === 'quiz' ? refId : null,
    })
    if (err) setError(err.message)
    else await cargar()
  }

  async function crearTarea() {
    if (!tareaTitulo.trim()) return
    setCreandoTarea(true)
    setError(null)
    const supabase = createClient()
    const { data: tarea, error: err } = await supabase
      .from('assignments')
      .insert({
        unit_id: unitId,
        title: tareaTitulo.trim(),
        due_at: tareaFecha ? new Date(tareaFecha).toISOString() : null,
      })
      .select('id')
      .single()
    if (err || !tarea) {
      setError(err?.message ?? 'No se pudo crear la tarea.')
      setCreandoTarea(false)
      return
    }
    const siguienteOrden = items.length > 0 ? items.length + 1 : 1
    await supabase.from('unit_items').insert({
      unit_id: unitId, type: 'tarea', order_index: siguienteOrden, assignment_id: tarea.id,
    })
    setTareaTitulo('')
    setTareaFecha('')
    setCreandoTarea(false)
    await cargar()
  }

  async function alternarObligatorio(itemId: string, actual: boolean) {
    const supabase = createClient()
    await supabase.from('unit_items').update({ required: !actual }).eq('id', itemId)
    await cargar()
  }

  async function quitarItem(itemId: string) {
    const supabase = createClient()
    await supabase.from('unit_items').delete().eq('id', itemId)
    await cargar()
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  const tieneDudas = items.some((i) => i.type === 'dudas')

  return (
    <div className="space-y-11 pb-20">
      <BotonVolver href="/unidades-docente" />

      <Encabezado sobretitulo="Unidad" titulo={titulo} />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Apertura y cierre" delay={100}>
        <div className="zr-card space-y-4 p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Se abre</label>
            <input
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <p className="mt-1 text-xs text-zr-text-muted">Vacío = sigue como borrador, nadie la ve.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Se cierra (opcional)</label>
            <input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <p className="mt-1 text-xs text-zr-text-muted">Pasada esta fecha, el estudiante la sigue viendo como repaso.</p>
          </div>
          {error && <p className="text-sm text-zr-error">{error}</p>}
          <button
            onClick={guardarFechas}
            disabled={guardando}
            className="min-h-12 w-full rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar fechas'}
          </button>
        </div>
      </Seccion>

      <Regla delay={140} />

      <Seccion numero={2} titulo="Contenido de la unidad" delay={180}>
        {items.length === 0 && <p className="text-sm text-zr-text-muted">Todavía no has agregado nada.</p>}
        <div className="space-y-3">
          {items.map((item) => {
            const Icono = item.type === 'material' ? IconoDocumento : item.type === 'quiz' ? IconoExamen : IconoDuda
            return (
              <div key={item.id} className="zr-card flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue">
                  <Icono size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-zr-text">{item.titulo}</p>
                  {item.type === 'material' && (
                    <button
                      onClick={() => alternarObligatorio(item.id, item.required)}
                      className="mt-1"
                    >
                      <Etiqueta tono={item.required ? 'aviso' : 'neutro'}>
                        {item.required ? 'Obligatorio (toca para quitar)' : 'Opcional (toca para hacer obligatorio)'}
                      </Etiqueta>
                    </button>
                  )}
                  {item.type === 'tarea' && item.assignmentId && (
                    <button
                      onClick={() => router.push(`/unidades-docente/tarea/${item.assignmentId}`)}
                      className="mt-1 text-xs font-bold text-zr-blue-mid"
                    >
                      Ver entregas y calificar ›
                    </button>
                  )}
                </div>
                <button onClick={() => quitarItem(item.id)} className="shrink-0 text-xs font-bold text-zr-error">
                  Quitar
                </button>
              </div>
            )
          })}
        </div>

        <div className="zr-card space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Agregar material ya subido</label>
            <div className="flex gap-2">
              <select
                id="sel-material"
                className="min-h-12 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
                defaultValue=""
              >
                <option value="" disabled>Elige un material…</option>
                {materialesDisponibles.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <button
                onClick={() => {
                  const sel = document.getElementById('sel-material') as HTMLSelectElement
                  if (sel.value) agregarItem('material', sel.value)
                }}
                className="shrink-0 rounded-lg bg-zr-blue px-4 text-sm font-bold text-white"
              >
                Agregar
              </button>
            </div>
            <p className="mt-1 text-xs text-zr-text-muted">Súbelo primero en &quot;Material&quot; si todavía no existe.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Agregar examen ya creado</label>
            <div className="flex gap-2">
              <select
                id="sel-examen"
                className="min-h-12 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
                defaultValue=""
              >
                <option value="" disabled>Elige un examen…</option>
                {examenesDisponibles.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <button
                onClick={() => {
                  const sel = document.getElementById('sel-examen') as HTMLSelectElement
                  if (sel.value) agregarItem('quiz', sel.value)
                }}
                className="shrink-0 rounded-lg bg-zr-blue px-4 text-sm font-bold text-white"
              >
                Agregar
              </button>
            </div>
            <p className="mt-1 text-xs text-zr-text-muted">
              Créalo primero en &quot;Crear examen&quot; — ahí eliges si es certificación (bloqueante) y cuántos intentos.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Nueva tarea en PDF</label>
            <input
              value={tareaTitulo}
              onChange={(e) => setTareaTitulo(e.target.value)}
              placeholder="Título de la tarea"
              className="mb-2 min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <input
              type="datetime-local"
              value={tareaFecha}
              onChange={(e) => setTareaFecha(e.target.value)}
              className="mb-2 min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <button
              onClick={crearTarea}
              disabled={!tareaTitulo.trim() || creandoTarea}
              className="min-h-12 w-full rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-40"
            >
              {creandoTarea ? 'Creando…' : 'Crear tarea'}
            </button>
          </div>

          {!tieneDudas && (
            <button
              onClick={() => agregarItem('dudas')}
              className="min-h-12 w-full rounded-lg border border-dashed border-zr-border text-sm font-bold text-zr-text-muted"
            >
              + Agregar sección de Dudas a esta unidad
            </button>
          )}
        </div>
      </Seccion>
    </div>
  )
}
