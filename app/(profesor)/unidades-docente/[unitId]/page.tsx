'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { BannerUnidad } from '@/components/ui/BannerUnidad'
import { PestanasUnidad, type PestanaUnidad } from '@/components/ui/PestanasUnidad'
import { IconoDocumento, IconoExamen, IconoDuda, IconoCheck, IconoLapiz } from '@/components/ui/Iconos'
import { estadoUnidad } from '@/lib/estado-unidad'

/**
 * Aula Virtual — el profesor administra el contenido de UNA unidad: fechas
 * de apertura/cierre, y sus elementos (material existente, examen existente,
 * tarea nueva). El material y los exámenes se crean en sus pantallas de
 * siempre (contenido-docente, crear-examen) -- aquí solo se ENLAZAN a la
 * unidad, para no duplicar esos flujos.
 *
 * Pedido explícito del coordinador (reunión 31-oct-2026, con video de
 * referencia de un aula virtual real): el profesor tiene que ver la unidad
 * TAL CUAL la ve el estudiante -- no un formulario de administración aparte
 * -- y un botón "Editar" abajo revela la gestión. Por eso esta pantalla
 * tiene dos modos (`modoEdicion`): por defecto es una lectura igual a
 * `app/(app)/unidades/[unitId]/page.tsx` (mismo orden de ítems, mismos
 * iconos, misma idea de "obligatorio"/"completado"); el modo edición es el
 * formulario que ya existía (fechas, agregar/quitar, crear tarea).
 * Dirección Académica entra por la misma pantalla (vista de recorrido del
 * layout de profesor) y hereda esto automáticamente, sin tocar nada más.
 */

interface Item {
  id: string
  type: 'material' | 'quiz' | 'tarea' | 'dudas'
  required: boolean
  titulo: string
  assignmentId: string | null
  contentItemId: string | null
  examId: string | null
  esTexto: boolean
  cuerpoTexto: string | null
  esVideoOAudio: boolean
  checkQuizId: string | null
  checkQuizTitulo: string | null
}

interface Opcion { id: string; title: string }

export default function UnidadDocenteDetalle() {
  const router = useRouter()
  const params = useParams()
  const unitId = params.unitId as string

  const [modoEdicion, setModoEdicion] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [manualStatus, setManualStatus] = useState<'abierta' | 'cerrada' | null>(null)
  const [unidades, setUnidades] = useState<PestanaUnidad[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [materialesDisponibles, setMaterialesDisponibles] = useState<Opcion[]>([])
  const [examenesDisponibles, setExamenesDisponibles] = useState<Opcion[]>([])
  const [miniChequeosDisponibles, setMiniChequeosDisponibles] = useState<Opcion[]>([])
  const [asignandoChequeo, setAsignandoChequeo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tarea nueva (sin pantalla propia todavía -- se crea aquí mismo).
  const [tareaTitulo, setTareaTitulo] = useState('')
  const [tareaFecha, setTareaFecha] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)

  // Bloque de texto (migración 187): título + párrafo escritos directo aquí,
  // sin archivo -- se guarda como content_items tipo 'texto'.
  const [moduleId, setModuleId] = useState('')
  const [cohortId, setCohortId] = useState<string | null>(null)
  const [textoTitulo, setTextoTitulo] = useState('')
  const [textoCuerpo, setTextoCuerpo] = useState('')
  const [creandoTexto, setCreandoTexto] = useState(false)

  // Editar un bloque de texto ya creado (pedido explícito del coordinador,
  // nov 2026): antes solo se podía "Quitar", no corregir un título o un
  // párrafo que se escribió mal.
  const [editandoTextoId, setEditandoTextoId] = useState<string | null>(null)
  const [editTextoTitulo, setEditTextoTitulo] = useState('')
  const [editTextoCuerpo, setEditTextoCuerpo] = useState('')
  const [guardandoEdicionTexto, setGuardandoEdicionTexto] = useState(false)

  async function cargar() {
    const supabase = createClient()
    const { data: unidad } = await supabase
      .from('units').select('title, module_id, open_at, close_at, manual_status').eq('id', unitId).maybeSingle()
    if (!unidad) { router.replace('/unidades-docente'); return }
    setTitulo(unidad.title)
    setOpenAt(unidad.open_at ? unidad.open_at.slice(0, 16) : '')
    setCloseAt(unidad.close_at ? unidad.close_at.slice(0, 16) : '')
    setManualStatus(unidad.manual_status)
    setModuleId(unidad.module_id)

    // El bloque de texto se guarda como content_items (RLS exige cohort_id +
    // module_id que el profesor realmente dicta -- mismo requisito que el
    // material subido por archivo, policy "profesor: escribir contenido").
    const { data: asignaciones } = await supabase.rpc('mis_asignaciones_docente')
    const asignacion = (asignaciones ?? []).find((a: { module_id: string }) => a.module_id === unidad.module_id)
    setCohortId(asignacion?.cohort_id ?? null)

    const { data: filas } = await supabase
      .from('unit_items')
      .select('id, type, required, assignment_id, content_item_id, exam_id, content_items(title, type, description, check_quiz_id, check_quiz:exams!content_items_check_quiz_id_fkey(title)), exams(title), assignments(title)')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: true })

    setItems(
      (filas ?? []).map((f) => {
        const ci = f.content_items as unknown as {
          title: string; type: string; description: string | null
          check_quiz_id: string | null; check_quiz: { title: string } | null
        } | null
        const ex = f.exams as unknown as { title: string } | null
        const ta = f.assignments as unknown as { title: string } | null
        return {
          id: f.id, type: f.type, required: f.required,
          titulo: ci?.title ?? ex?.title ?? ta?.title ?? (f.type === 'dudas' ? 'Dudas de esta unidad' : ''),
          assignmentId: f.assignment_id,
          contentItemId: f.content_item_id,
          examId: f.exam_id,
          esTexto: ci?.type === 'texto',
          cuerpoTexto: ci?.type === 'texto' ? (ci.description ?? '') : null,
          esVideoOAudio: ci?.type === 'video' || ci?.type === 'audio',
          checkQuizId: ci?.check_quiz_id ?? null,
          checkQuizTitulo: ci?.check_quiz?.title ?? null,
        }
      }),
    )

    // Materiales "ya subidos" para el selector: solo archivos/enlaces reales
    // -- los bloques de texto se crean directo aquí, no tiene sentido
    // listarlos para "agregar ya existente".
    // Casteo: 'texto' entra en el enum content_type en la migración 186; los
    // tipos generados se regeneran en el próximo barrido.
    const { data: materiales } = await supabase
      .from('content_items').select('id, title').eq('module_id', unidad.module_id)
      .neq('type', 'texto' as unknown as 'pdf').order('title')
    const { data: examenes } = await supabase
      .from('exams').select('id, title, kind').eq('module_id', unidad.module_id).order('title')

    setMaterialesDisponibles((materiales ?? []) as Opcion[])
    setExamenesDisponibles((examenes ?? []) as Opcion[])
    // Mini-chequeo (migración 177): solo exámenes formativos tiene sentido
    // ofrecer -- uno de certificación ya tiene su propio flujo (compuerta).
    setMiniChequeosDisponibles(
      ((examenes ?? []) as unknown as { id: string; title: string; kind: string }[])
        .filter((e) => e.kind === 'formativo'),
    )

    // Fila de pestañas: TODAS las unidades del módulo (a diferencia del
    // estudiante, el profesor ve también borrador/programada, con su color
    // de siempre -- así sabe de un vistazo cuál todavía no ve nadie más).
    const { data: hermanas } = await supabase
      .from('units').select('id, title, order_index, open_at, close_at, manual_status')
      .eq('module_id', unidad.module_id).order('order_index', { ascending: true })
    setUnidades(
      (hermanas ?? []).map((h) => ({
        id: h.id, title: h.title,
        tono: estadoUnidad(h.open_at, h.close_at, h.manual_status).tono,
      })),
    )

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

  const [agregando, setAgregando] = useState(false)

  async function agregarItem(tipo: 'material' | 'quiz' | 'dudas', refId?: string) {
    if ((tipo === 'material' || tipo === 'quiz') && !refId) return
    setError(null)

    // Bug real reportado por el coordinador (reunión 31-oct-2026): agregar
    // dos veces el mismo material o examen a la unidad no debe duplicarlo --
    // se avisa en vez de insertar de nuevo. `agregando` evita además el
    // doble clic mientras la primera inserción todavía no vuelve.
    if (tipo === 'material' && items.some((i) => i.contentItemId === refId)) {
      setError('Este material ya está en esta unidad.')
      return
    }
    if (tipo === 'quiz' && items.some((i) => i.examId === refId)) {
      setError('Este examen ya está en esta unidad.')
      return
    }

    setAgregando(true)
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
    setAgregando(false)
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

  async function crearBloqueTexto() {
    if (!textoTitulo.trim() || !textoCuerpo.trim()) return
    if (!cohortId) {
      setError('No se encontró la cohorte de esta unidad para guardar el bloque. Avisa a Dirección Académica.')
      return
    }
    setCreandoTexto(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreandoTexto(false); return }
    const { data: contenido, error: err } = await supabase
      .from('content_items')
      .insert({
        module_id: moduleId,
        cohort_id: cohortId,
        title: textoTitulo.trim(),
        // Casteo: 'texto' entra en el enum content_type en la migración 186.
        type: 'texto' as unknown as 'pdf',
        description: textoCuerpo.trim(),
        uploaded_by: user.id,
        // Sin archivo que revisar (no hay riesgo de contenido subido): se
        // publica directo, a diferencia del material con archivo que queda
        // "pendiente" hasta que administración lo revise.
        is_published: true,
      })
      .select('id')
      .single()
    if (err || !contenido) {
      setError(err?.message ?? 'No se pudo crear el bloque de texto.')
      setCreandoTexto(false)
      return
    }
    const siguienteOrden = items.length > 0 ? items.length + 1 : 1
    await supabase.from('unit_items').insert({
      unit_id: unitId, type: 'material', order_index: siguienteOrden, content_item_id: contenido.id,
    })
    setTextoTitulo('')
    setTextoCuerpo('')
    setCreandoTexto(false)
    await cargar()
  }

  function empezarEdicionTexto(item: Item) {
    setEditandoTextoId(item.id)
    setEditTextoTitulo(item.titulo)
    setEditTextoCuerpo(item.cuerpoTexto ?? '')
    setError(null)
  }

  async function guardarEdicionTexto(item: Item) {
    if (!editTextoTitulo.trim() || !editTextoCuerpo.trim() || !item.contentItemId) return
    setGuardandoEdicionTexto(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('content_items')
      .update({ title: editTextoTitulo.trim(), description: editTextoCuerpo.trim() })
      .eq('id', item.contentItemId)
    if (err) setError(err.message)
    else {
      setEditandoTextoId(null)
      await cargar()
    }
    setGuardandoEdicionTexto(false)
  }

  async function asociarMiniChequeo(contentItemId: string, examId: string) {
    setAsignandoChequeo(contentItemId)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('content_items').update({ check_quiz_id: examId }).eq('id', contentItemId)
    if (err) setError(err.message)
    else await cargar()
    setAsignandoChequeo(null)
  }

  async function quitarMiniChequeo(contentItemId: string) {
    setAsignandoChequeo(contentItemId)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('content_items').update({ check_quiz_id: null }).eq('id', contentItemId)
    if (err) setError(err.message)
    else await cargar()
    setAsignandoChequeo(null)
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

  // Lectura: misma idea que app/(app)/unidades/[unitId]/page.tsx -- el
  // estudiante no ve "Borrador"/"Programada" (RLS se lo esconde), pero el
  // profesor sí necesita saber en qué estado está lo que está viendo.
  const estado = estadoUnidad(openAt, closeAt, manualStatus)

  if (!modoEdicion) {
    return (
      <div className="space-y-7 pb-28">
        <BotonVolver href="/unidades-docente" />

        <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades-docente" />

        <BannerUnidad
          sobretitulo="Aula Virtual · Vista del estudiante"
          titulo={titulo}
          accion={
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
              {estado.texto}
            </span>
          }
        />

        <div className="space-y-11">
        <Seccion numero={1} titulo="Contenido de la unidad" delay={100}>
          {items.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Todavía no has agregado nada. Toca &quot;Editar&quot; para empezar.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                if (item.esTexto) {
                  return (
                    <div key={item.id} className="space-y-2 rounded-r-lg border-l-4 border-zr-blue bg-zr-blue/[0.06] py-4 pl-4 pr-5">
                      <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zr-text-muted">{item.cuerpoTexto}</p>
                    </div>
                  )
                }
                const Icono = item.type === 'material' ? IconoDocumento : item.type === 'quiz' ? IconoExamen : IconoDuda
                return (
                  <div key={item.id} className="zr-card flex items-center gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue">
                      <Icono size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {item.required && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                      </div>
                    </div>
                    {item.type === 'tarea' && item.assignmentId && (
                      <button
                        onClick={() => router.push(`/unidades-docente/tarea/${item.assignmentId}`)}
                        className="shrink-0 text-xs font-bold text-zr-blue-mid"
                      >
                        Ver entregas ›
                      </button>
                    )}
                    {item.type === 'dudas' && (
                      <button
                        onClick={() => router.push(`/dudas-docente?unidad=${unitId}`)}
                        className="shrink-0 text-xs font-bold text-zr-blue-mid"
                      >
                        Ver dudas ›
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Seccion>
        </div>

        {/* Pedido explícito del coordinador: "el profesor debería verlo
            similar [al estudiante]... y abajo un botón de editar." */}
        <button
          onClick={() => setModoEdicion(true)}
          className="fixed bottom-24 left-1/2 flex min-h-14 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-zr-blue text-base font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] lg:bottom-8"
        >
          <IconoLapiz size={18} />
          Editar unidad
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-11 pb-20">
      <div className="flex items-center justify-between gap-3">
        <BotonVolver href="/unidades-docente" />
        <button
          onClick={() => setModoEdicion(false)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-zr-blue-mid"
        >
          <IconoCheck size={16} />
          Listo
        </button>
      </div>

      <Encabezado sobretitulo="Unidad · Editando" titulo={titulo} />

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
            if (item.esTexto) {
              if (editandoTextoId === item.id) {
                return (
                  <div key={item.id} className="zr-card space-y-3 p-5">
                    <input
                      value={editTextoTitulo}
                      onChange={(e) => setEditTextoTitulo(e.target.value)}
                      className="min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm font-bold text-zr-text outline-none focus:border-zr-blue"
                    />
                    <textarea
                      value={editTextoCuerpo}
                      onChange={(e) => setEditTextoCuerpo(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text outline-none focus:border-zr-blue"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditandoTextoId(null)}
                        className="min-h-11 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => guardarEdicionTexto(item)}
                        disabled={!editTextoTitulo.trim() || !editTextoCuerpo.trim() || guardandoEdicionTexto}
                        className="min-h-11 flex-1 rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-40"
                      >
                        {guardandoEdicionTexto ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={item.id} className="space-y-2 rounded-r-lg border-l-4 border-zr-blue bg-zr-blue/[0.06] py-4 pl-4 pr-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                    <div className="flex shrink-0 gap-3">
                      <button onClick={() => empezarEdicionTexto(item)} className="text-xs font-bold text-zr-blue-mid">
                        Editar
                      </button>
                      <button onClick={() => quitarItem(item.id)} className="text-xs font-bold text-zr-error">
                        Quitar
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-zr-text-muted">{item.cuerpoTexto}</p>
                </div>
              )
            }
            const Icono = item.type === 'material' ? IconoDocumento : item.type === 'quiz' ? IconoExamen : IconoDuda
            return (
              <div key={item.id} className="zr-card space-y-3 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue">
                    <Icono size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
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
                    {item.type === 'dudas' && (
                      <button
                        onClick={() => router.push(`/dudas-docente?unidad=${unitId}`)}
                        className="mt-1 text-xs font-bold text-zr-blue-mid"
                      >
                        Ver y responder dudas ›
                      </button>
                    )}
                  </div>
                  <button onClick={() => quitarItem(item.id)} className="shrink-0 text-xs font-bold text-zr-error">
                    Quitar
                  </button>
                </div>

                {/* Mini-chequeo (migración 177, spec §6.3): solo video/audio --
                    al terminarlo, el estudiante ve un examen cortico ya
                    existente del módulo; aprobarlo valida el material. */}
                {item.esVideoOAudio && item.contentItemId && (
                  item.checkQuizId ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-zr-border bg-zr-bg px-3 py-2">
                      <p className="text-xs text-zr-text-muted">
                        Mini-chequeo: <span className="font-bold text-zr-text">{item.checkQuizTitulo ?? 'Examen'}</span>
                      </p>
                      <button
                        onClick={() => quitarMiniChequeo(item.contentItemId as string)}
                        disabled={asignandoChequeo === item.contentItemId}
                        className="shrink-0 text-xs font-bold text-zr-error disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : miniChequeosDisponibles.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        id={`sel-chequeo-${item.id}`}
                        className="min-h-10 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-xs text-zr-text"
                        defaultValue=""
                      >
                        <option value="" disabled>Mini-chequeo al terminar (opcional)…</option>
                        {miniChequeosDisponibles.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          const sel = document.getElementById(`sel-chequeo-${item.id}`) as HTMLSelectElement
                          if (sel.value) asociarMiniChequeo(item.contentItemId as string, sel.value)
                        }}
                        disabled={asignandoChequeo === item.contentItemId}
                        className="shrink-0 rounded-lg bg-zr-blue px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Asociar
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-zr-text-muted">
                      Para ponerle mini-chequeo, primero crea un examen formativo en este módulo.
                    </p>
                  )
                )}
              </div>
            )
          })}
        </div>

        <div className="zr-card space-y-5 p-5">
          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
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
                disabled={agregando}
                className="shrink-0 rounded-lg bg-zr-blue px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            <Link
              href={`/contenido-docente?unitId=${unitId}`}
              className="mt-1 inline-block text-xs font-bold text-zr-blue-mid"
            >
              + Subir material nuevo para esta unidad ›
            </Link>
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
                disabled={agregando}
                className="shrink-0 rounded-lg bg-zr-blue px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            {/* Pedido explícito del coordinador (reunión 31-oct-2026): el examen
                se crea desde DENTRO de la unidad, no en una pantalla aparte que
                luego hay que ir a buscar y enlazar. /crear-examen/nuevo ya sabe
                preseleccionar el módulo y, al guardar, engancharse solo aquí. */}
            <Link
              href={`/crear-examen/nuevo?unitId=${unitId}`}
              className="mt-1 inline-block text-xs font-bold text-zr-blue-mid"
            >
              + Crear examen nuevo para esta unidad ›
            </Link>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Nuevo bloque de texto</label>
            <p className="mb-2 text-xs text-zr-text-muted">
              Título y párrafo escritos directo aquí, sin subir ningún archivo.
            </p>
            <input
              value={textoTitulo}
              onChange={(e) => setTextoTitulo(e.target.value)}
              placeholder="Título del bloque"
              className="mb-2 min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <textarea
              value={textoCuerpo}
              onChange={(e) => setTextoCuerpo(e.target.value)}
              placeholder="Escribe el párrafo…"
              rows={4}
              className="mb-2 w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <button
              onClick={crearBloqueTexto}
              disabled={!textoTitulo.trim() || !textoCuerpo.trim() || creandoTexto}
              className="min-h-12 w-full rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-40"
            >
              {creandoTexto ? 'Creando…' : 'Agregar bloque de texto'}
            </button>
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
