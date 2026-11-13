'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { siguienteOrdenUnidad } from '@/lib/unidad-orden'
import { cohorteParaModulo } from '@/lib/cohorte-unidad'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { BannerUnidad, PALETA_BANNER, HUES_BANNER, type ColorBanner } from '@/components/ui/BannerUnidad'
import { acentoDe, hexARgba } from '@/lib/banner-unidad'
import { prepararArchivo } from '@/lib/subida'
import { PestanasUnidad, type PestanaUnidad } from '@/components/ui/PestanasUnidad'
import { Recorrido, Paso } from '@/components/ui/Recorrido'
import { IconoDocumento, IconoExamen, IconoDuda, IconoCheck, IconoLapiz } from '@/components/ui/Iconos'
import { estadoUnidad } from '@/lib/estado-unidad'
import { eyebrowMaterial } from '@/lib/material'
import { iconoDeMaterial } from '@/components/ui/IconoMaterial'
import { ModalEvaluacionAgregada } from '@/components/ui/ModalEvaluacionAgregada'
import { sumaPesoOcupado, mensajeSiExcedePeso } from '@/lib/peso-notas'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconoArrastrar } from '@/components/ui/Iconos'

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
 * Dirección Académica y super_admin entran por esta misma pantalla COMO
 * ELLOS MISMOS (sin el banner de simulación -- ver app/(profesor)/layout.tsx)
 * y pueden administrar todo igual que el profesor: RLS por is_staff() ya se
 * los permite, sin tocar nada más.
 *
 * La lectura usa el mismo recorrido (components/ui/Recorrido) que el
 * estudiante -- pedido del coordinador (nov. 2026): unificar la estética; y
 * cada ítem navega a su "Ver" (material → visor del docente, examen → su
 * constructor, tarea → entregas, dudas → panel de dudas de la unidad).
 */

interface Item {
  id: string
  type: 'material' | 'quiz' | 'tarea' | 'dudas'
  required: boolean
  orderIndex: number
  titulo: string
  assignmentId: string | null
  contentItemId: string | null
  examId: string | null
  esTexto: boolean
  cuerpoTexto: string | null
  esVideoOAudio: boolean
  materialTipo: string | null
  esCertificacion: boolean
  checkQuizId: string | null
  checkQuizTitulo: string | null
  // Pedido explícito (8-nov-2026): el profesor no tenía ninguna forma de
  // ver si administración ya aprobó/rechazó su material, ni por qué --
  // solo para type==='material'; texto/enlace se publican solos (sin
  // approval_status real que mostrar).
  approvalStatus: string | null
  reviewMessage: string | null
}

interface Opcion { id: string; title: string }

/**
 * Arrastrar para reordenar (pedido explícito del coordinador, 8-nov-2026:
 * "mantenerla presionada y moverla"). `useSortable` es un hook -- no se
 * puede llamar dentro del `.map()` de la lista, por eso vive en su propio
 * componente envolvente con render-prop. El `delay` del sensor (ver
 * `sensores` más abajo) es justamente lo de "mantener presionado": sin eso,
 * cualquier scroll normal del dedo se interpretaría como un arrastre.
 */
function FilaOrdenable({
  id,
  children,
}: {
  id: string
  children: (ctx: { setNodeRef: (el: HTMLElement | null) => void; style: React.CSSProperties; asa: React.ReactNode }) => React.ReactElement
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  }
  const asa = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Arrastrar para reordenar"
      className="flex h-8 w-7 shrink-0 touch-none cursor-grab items-center justify-center text-zr-text-muted active:cursor-grabbing"
    >
      <IconoArrastrar size={18} />
    </button>
  )
  return children({ setNodeRef, style, asa })
}

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
  const [miniChequeosDisponibles, setMiniChequeosDisponibles] = useState<Opcion[]>([])
  const [asignandoChequeo, setAsignandoChequeo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Pedido explícito (8-nov-2026): al profesor no le llegaba ningún aviso
  // (ni dónde ir a ver) cuando administración aprobaba o rechazaba su
  // material -- toca la etiqueta de estado para ver el motivo si lo rechazaron.
  const [verMotivoId, setVerMotivoId] = useState<string | null>(null)

  // Tarea nueva (sin pantalla propia todavía -- se crea aquí mismo).
  const [tareaTitulo, setTareaTitulo] = useState('')
  const [tareaFecha, setTareaFecha] = useState('')
  // Fusión con Notas (H.33, migración 193): % que vale en la nota del
  // módulo -- la tarea, al crearse, ya es una evaluación en Notas.
  const [tareaPeso, setTareaPeso] = useState<number | ''>('')
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [confirmandoTarea, setConfirmandoTarea] = useState(false)
  const [pesoTareaConfirmada, setPesoTareaConfirmada] = useState(0)

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

  // Banner personalizable (migración 194, pedido #4 del coordinador): imagen
  // o color a elegir, y el aspecto clásico/moderno de la unidad entera. Lo
  // configura quien edita; lo ve igual cualquier perfil que entre.
  const [bannerImagePath, setBannerImagePath] = useState<string | null>(null)
  const [bannerPosicion, setBannerPosicion] = useState(50)
  const [bannerColor, setBannerColor] = useState<ColorBanner | null>(null)
  const [subiendoBanner, setSubiendoBanner] = useState(false)

  async function cargar() {
    const supabase = createClient()
    const { data: unidad } = await supabase
      .from('units')
      .select('title, module_id, open_at, close_at, manual_status, banner_image_path, banner_color, banner_image_position')
      .eq('id', unitId).maybeSingle()
    if (!unidad) { router.replace('/unidades-docente'); return }
    setTitulo(unidad.title)
    setOpenAt(unidad.open_at ? unidad.open_at.slice(0, 16) : '')
    setCloseAt(unidad.close_at ? unidad.close_at.slice(0, 16) : '')
    setManualStatus(unidad.manual_status)
    setModuleId(unidad.module_id)
    setBannerImagePath(unidad.banner_image_path)
    setBannerColor(unidad.banner_color as ColorBanner | null)
    setBannerPosicion(unidad.banner_image_position ?? 50)

    // El bloque de texto se guarda como content_items (RLS exige cohort_id +
    // module_id que el profesor realmente dicta -- mismo requisito que el
    // material subido por archivo, policy "profesor: escribir contenido").
    setCohortId(await cohorteParaModulo(supabase, unidad.module_id))

    const { data: filas } = await supabase
      .from('unit_items')
      .select('id, type, required, order_index, assignment_id, content_item_id, exam_id, content_items(title, type, description, check_quiz_id, check_quiz:exams!content_items_check_quiz_id_fkey(title), approval_status, review_message), exams(title, kind), assignments(title)')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: true })

    setItems(
      (filas ?? []).map((f) => {
        const ci = f.content_items as unknown as {
          title: string; type: string; description: string | null
          check_quiz_id: string | null; check_quiz: { title: string } | null
          approval_status: string | null; review_message: string | null
        } | null
        const ex = f.exams as unknown as { title: string; kind: string } | null
        const ta = f.assignments as unknown as { title: string } | null
        return {
          id: f.id, type: f.type, required: f.required, orderIndex: f.order_index,
          titulo: ci?.title ?? ex?.title ?? ta?.title ?? (f.type === 'dudas' ? 'Dudas de esta unidad' : ''),
          assignmentId: f.assignment_id,
          contentItemId: f.content_item_id,
          examId: f.exam_id,
          esTexto: ci?.type === 'texto',
          cuerpoTexto: ci?.type === 'texto' ? (ci.description ?? '') : null,
          esVideoOAudio: ci?.type === 'video' || ci?.type === 'audio',
          materialTipo: ci?.type ?? null,
          esCertificacion: f.type === 'quiz' && ex?.kind === 'certificacion',
          checkQuizId: ci?.check_quiz_id ?? null,
          checkQuizTitulo: ci?.check_quiz?.title ?? null,
          approvalStatus: ci?.approval_status ?? null,
          reviewMessage: ci?.review_message ?? null,
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

  // Banner (migración 194): imagen en el bucket público 'banners-unidad',
  // ruta guardada en units.banner_image_path. Subir una nueva borra la
  // vieja (si había) para no acumular archivos huérfanos. Pasa por el mismo
  // comprimidor que el material (lib/subida.ts, prepararArchivo) -- si pesa
  // más del límite de system_config, se reduce antes de subir.
  async function subirImagenBanner(archivo: File) {
    if (!archivo.type.startsWith('image/')) {
      setError('Elige un archivo de imagen.')
      return
    }
    setSubiendoBanner(true)
    setError(null)
    const { archivo: listo } = await prepararArchivo(archivo)
    if (listo.size > 8 * 1024 * 1024) {
      setError('La imagen pesa demasiado incluso comprimida. Prueba con otra.')
      setSubiendoBanner(false)
      return
    }
    const supabase = createClient()
    const ext = listo.type === 'image/jpeg' ? 'jpg' : (listo.name.split('.').pop() || 'jpg')
    const ruta = `${unitId}-${Date.now()}.${ext}`
    const { error: errSubida } = await supabase.storage
      .from('banners-unidad').upload(ruta, listo, { upsert: false })
    if (errSubida) {
      setError(errSubida.message)
      setSubiendoBanner(false)
      return
    }
    const anterior = bannerImagePath
    const { error: errUnidad } = await supabase
      .from('units').update({ banner_image_path: ruta, banner_image_position: 50 }).eq('id', unitId)
    if (errUnidad) {
      setError(errUnidad.message)
      await supabase.storage.from('banners-unidad').remove([ruta])
      setSubiendoBanner(false)
      return
    }
    if (anterior) await supabase.storage.from('banners-unidad').remove([anterior])
    setBannerImagePath(ruta)
    setBannerPosicion(50)
    setSubiendoBanner(false)
  }

  async function quitarImagenBanner() {
    if (!bannerImagePath) return
    setSubiendoBanner(true)
    const supabase = createClient()
    await supabase.from('units').update({ banner_image_path: null }).eq('id', unitId)
    await supabase.storage.from('banners-unidad').remove([bannerImagePath])
    setBannerImagePath(null)
    setSubiendoBanner(false)
  }

  async function elegirColorBanner(color: ColorBanner) {
    setBannerColor(color)
    const supabase = createClient()
    await supabase.from('units').update({ banner_color: color }).eq('id', unitId)
  }

  // Posición vertical de la imagen (pedido explícito: "que pueda agarrarla y
  // subirla o bajarla para donde quiera"). Se actualiza en pantalla en cada
  // movimiento del control, pero solo se guarda en la base al soltar -- no
  // hace falta escribir en cada pixel de arrastre.
  function moverPosicionBanner(valor: number) {
    setBannerPosicion(valor)
  }
  async function guardarPosicionBanner() {
    const supabase = createClient()
    await supabase.from('units').update({ banner_image_position: bannerPosicion }).eq('id', unitId)
  }

  const urlBanner = bannerImagePath
    ? createClient().storage.from('banners-unidad').getPublicUrl(bannerImagePath).data.publicUrl
    : null

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
    const { error: err } = await supabase.from('unit_items').insert({
      unit_id: unitId,
      type: tipo,
      order_index: await siguienteOrdenUnidad(supabase, unitId),
      content_item_id: tipo === 'material' ? refId : null,
      exam_id: tipo === 'quiz' ? refId : null,
    })
    if (err) setError(err.message)
    else await cargar()
    setAgregando(false)
  }

  async function crearTarea() {
    if (!tareaTitulo.trim()) return
    const pesoCreado = tareaPeso === '' ? 0 : tareaPeso
    setError(null)

    // Bug real de la reunión 7-nov-2026: una tarea creada con 0% nunca suma
    // en Notas aunque se califique (sale "0 de 0") -- se exige un % real.
    if (pesoCreado <= 0) {
      setError('La tarea tiene que valer más de 0% en la nota del módulo.')
      return
    }

    const supabase = createClient()

    const ocupado = await sumaPesoOcupado(supabase, moduleId, cohortId)
    const msgPeso = mensajeSiExcedePeso(ocupado, pesoCreado)
    if (msgPeso) { setError(msgPeso); return }

    setCreandoTarea(true)
    const { data: tarea, error: err } = await supabase
      .from('assignments')
      .insert({
        unit_id: unitId,
        title: tareaTitulo.trim(),
        due_at: tareaFecha ? new Date(tareaFecha).toISOString() : null,
        weight: pesoCreado,
      })
      .select('id')
      .single()
    if (err || !tarea) {
      setError(err?.message ?? 'No se pudo crear la tarea.')
      setCreandoTarea(false)
      return
    }
    const { error: falloEnlace } = await supabase.from('unit_items').insert({
      unit_id: unitId, type: 'tarea', order_index: await siguienteOrdenUnidad(supabase, unitId), assignment_id: tarea.id,
    })
    if (falloEnlace) {
      setError(`La tarea se creó pero no se pudo agregar a la unidad: ${falloEnlace.message}`)
      setCreandoTarea(false)
      return
    }
    setTareaTitulo('')
    setTareaFecha('')
    setTareaPeso('')
    setPesoTareaConfirmada(pesoCreado)
    setCreandoTarea(false)
    setConfirmandoTarea(true)
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
    const { error: falloEnlace } = await supabase.from('unit_items').insert({
      unit_id: unitId, type: 'material', order_index: await siguienteOrdenUnidad(supabase, unitId), content_item_id: contenido.id,
    })
    if (falloEnlace) {
      setError(`El bloque se creó pero no se pudo agregar a la unidad: ${falloEnlace.message}`)
      setCreandoTexto(false)
      return
    }
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

  // Reordenar: arrastrar (pedido explícito del coordinador, 8-nov-2026) o las
  // flechas subir/bajar (quedan como respaldo sin tacto/accesible). Las dos
  // vías terminan en `guardarOrden` con la lista ya en el orden que debe
  // quedar -- se reescriben TODOS los order_index en dos fases (primero
  // temporales negativos únicos, después los finales 1..N) porque
  // unit_items tiene UNIQUE (unit_id, order_index): escribir cualquier
  // valor final de una que ya esté ocupado por otro ítem falla.
  async function guardarOrden(nuevoOrden: Item[]) {
    setItems(nuevoOrden) // optimista: se ve el nuevo orden de inmediato
    const supabase = createClient()
    await Promise.all(nuevoOrden.map((it, i) => supabase.from('unit_items').update({ order_index: -(i + 1) }).eq('id', it.id)))
    await Promise.all(nuevoOrden.map((it, i) => supabase.from('unit_items').update({ order_index: i + 1 }).eq('id', it.id)))
    await cargar()
  }

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function alTerminarArrastre(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const viejo = items.findIndex((i) => i.id === active.id)
    const nuevo = items.findIndex((i) => i.id === over.id)
    if (viejo === -1 || nuevo === -1) return
    void guardarOrden(arrayMove(items, viejo, nuevo))
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  // Color de acento de la unidad (migración 194/195): pedido explícito del
  // coordinador -- "todos los botones y contornos" lo usan, no solo el
  // banner y el nodo del recorrido. Una sola constante para toda la pantalla.
  const acento = acentoDe(bannerColor)
  const acentoSuave = hexARgba(acento, 0.12)

  const tieneDudas = items.some((i) => i.type === 'dudas')

  // Lectura: misma idea que app/(app)/unidades/[unitId]/page.tsx -- el
  // estudiante no ve "Borrador"/"Programada" (RLS se lo esconde), pero el
  // profesor sí necesita saber en qué estado está lo que está viendo.
  const estado = estadoUnidad(openAt, closeAt, manualStatus)

  if (!modoEdicion) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="space-y-7">
          <BotonVolver href="/unidades-docente" />

          <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades-docente" />
        </div>

        <div className="mt-7 space-y-9">
          <BannerUnidad
            sobretitulo="Aula Virtual · Vista del estudiante"
            titulo={titulo}
            imagenUrl={urlBanner}
            posicionImagen={bannerPosicion}
            color={bannerColor}
            accion={
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
                {estado.texto}
              </span>
            }
          />

          <section className="animate-rise space-y-6">
            <p className="zr-eyebrow">01 — CONTENIDO DE LA UNIDAD</p>

            {items.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Todavía no has agregado nada. Toca &quot;Editar unidad&quot; para empezar.</p>
            ) : (
              <Recorrido>
                {items.map((item, idx) => {
                  const ultimo = idx === items.length - 1

                  // Bloque de texto: sin archivo, se lee completo en el camino
                  // (mismo trato que en la vista del estudiante).
                  if (item.esTexto) {
                    return (
                      <Paso
                        key={item.id}
                        estado="disponible"
                        icono={IconoDocumento}
                        eyebrow="Lectura"
                        titulo={item.titulo}
                        meta={item.required ? <Etiqueta tono="aviso">Obligatorio</Etiqueta> : undefined}
                        ultimo={ultimo}
                        delay={80 + idx * 50}
                        acento={acento}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zr-text-muted">
                          {item.cuerpoTexto}
                        </p>
                      </Paso>
                    )
                  }

                  // Cada ítem navega a su "Ver": material → visor del docente,
                  // examen → su constructor (ver cómo quedó), tarea → entregas,
                  // dudas → el panel de dudas filtrado por esta unidad.
                  let Icono = IconoDocumento
                  let eyebrow = 'Material'
                  let href = '#'
                  if (item.type === 'material') {
                    Icono = iconoDeMaterial(item.materialTipo)
                    eyebrow = eyebrowMaterial(item.materialTipo ?? '')
                    href = item.contentItemId ? `/unidades-docente/${unitId}/material/${item.contentItemId}` : '#'
                  } else if (item.type === 'quiz') {
                    Icono = IconoExamen
                    eyebrow = item.esCertificacion ? 'Certificación' : 'Examen'
                    // "Ver" va a la lista de estudiantes que lo presentaron,
                    // no al constructor (pedido explícito del coordinador,
                    // 7-nov-2026) -- editar la estructura del examen sigue
                    // disponible desde ahí ("Editar examen").
                    href = item.examId ? `/calificar/${item.examId}` : '#'
                  } else if (item.type === 'tarea') {
                    Icono = IconoLapiz
                    eyebrow = 'Tarea'
                    href = item.assignmentId ? `/unidades-docente/tarea/${item.assignmentId}` : '#'
                  } else if (item.type === 'dudas') {
                    Icono = IconoDuda
                    eyebrow = 'Dudas'
                    href = `/dudas-docente?unidad=${unitId}`
                  }

                  // Pedido explícito (8-nov-2026): el estado de aprobación
                  // también se ve en la vista de lectura, no solo en editar.
                  const meta = (
                    <>
                      {item.required && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                      {item.esCertificacion && <Etiqueta tono="info">Certificación</Etiqueta>}
                      {item.type === 'material' && item.approvalStatus === 'aprobado' && (
                        <Etiqueta tono="exito">Aprobado</Etiqueta>
                      )}
                      {item.type === 'material' && item.approvalStatus === 'pendiente' && (
                        <Etiqueta tono="neutro">En espera de aprobación</Etiqueta>
                      )}
                      {item.type === 'material' && item.approvalStatus === 'rechazado' && (
                        <Etiqueta tono="aviso">Rechazado</Etiqueta>
                      )}
                    </>
                  )

                  return (
                    <Paso
                      key={item.id}
                      estado="disponible"
                      icono={Icono}
                      eyebrow={eyebrow}
                      titulo={item.titulo}
                      meta={item.required || item.esCertificacion || item.approvalStatus ? meta : undefined}
                      href={href === '#' ? undefined : href}
                      ultimo={ultimo}
                      delay={80 + idx * 50}
                      acento={acento}
                    />
                  )
                })}
              </Recorrido>
            )}
          </section>
        </div>

        {/* Pedido explícito del coordinador: "el profesor debería verlo
            similar [al estudiante]... y abajo un botón de editar." */}
        <button
          onClick={() => setModoEdicion(true)}
          style={{ backgroundColor: acento }}
          className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex min-h-14 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] lg:bottom-8"
        >
          <IconoLapiz size={18} />
          Editar unidad
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh space-y-11 bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <BotonVolver href="/unidades-docente" />
        <button
          onClick={() => setModoEdicion(false)}
          style={{ color: acento }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold"
        >
          <IconoCheck size={16} />
          Listo
        </button>
      </div>

      <Encabezado sobretitulo="Unidad · Editando" titulo={titulo} />

      {/* Banner personalizable (migración 194/195, pedido #4 del
          coordinador): imagen (con control de posición) o color. El mismo
          color tiñe el fondo del banner (sin imagen) o los botones y
          contornos de la unidad (con imagen) -- pedido explícito. Lo ve
          igual cualquier perfil que entre. Cada control se guarda solo al
          tocarlo, sin un botón "Guardar" aparte. */}
      <div className="zr-card space-y-5 p-5">
        <p className="zr-eyebrow">Banner de la unidad</p>

        <BannerUnidad
          sobretitulo="Vista previa"
          titulo={titulo}
          imagenUrl={urlBanner}
          posicionImagen={bannerPosicion}
          color={bannerColor}
        />

        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Imagen propia (opcional)</label>
          <div className="flex gap-2">
            <label
              style={{ borderColor: acento, color: acento }}
              className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed text-sm font-bold"
            >
              {subiendoBanner ? 'Subiendo…' : bannerImagePath ? 'Cambiar imagen' : '+ Subir imagen'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={subiendoBanner}
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) subirImagenBanner(archivo)
                  e.target.value = ''
                }}
              />
            </label>
            {bannerImagePath && (
              <button
                onClick={quitarImagenBanner}
                disabled={subiendoBanner}
                style={{ borderColor: acento, color: acento }}
                className="min-h-12 rounded-lg border px-4 text-sm font-bold"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-zr-text-muted">
            Se comprime sola si pesa mucho, igual que al subir material.
          </p>
        </div>

        {bannerImagePath && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Posición de la imagen</label>
            <input
              type="range"
              min={0}
              max={100}
              value={bannerPosicion}
              onChange={(e) => moverPosicionBanner(Number(e.target.value))}
              onMouseUp={guardarPosicionBanner}
              onTouchEnd={guardarPosicionBanner}
              style={{ accentColor: acento }}
              className="w-full"
            />
            <p className="mt-1 flex justify-between text-xs text-zr-text-muted">
              <span>Arriba</span><span>Abajo</span>
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">
            Color {bannerImagePath ? '(botones y contornos de la unidad)' : ''}
          </label>
          {/* 3 tonalidades por color (pedido explícito, reunión 7-nov-2026):
              una fila por tonalidad, el mismo orden de tonos en cada una. */}
          <div className="space-y-2">
            {(['claro', 'medio', 'oscuro'] as const).map((tono) => (
              <div key={tono} className="flex gap-2">
                {HUES_BANNER.map((hue) => {
                  const c = (tono === 'medio' ? hue : `${hue}_${tono}`) as ColorBanner
                  return (
                    <button
                      key={c}
                      onClick={() => elegirColorBanner(c)}
                      title={PALETA_BANNER[c].etiqueta}
                      aria-label={PALETA_BANNER[c].etiqueta}
                      className="h-9 w-9 shrink-0 rounded-full"
                      style={{
                        backgroundColor: PALETA_BANNER[c].muestra,
                        boxShadow: (bannerColor ?? 'azul') === c ? `0 0 0 2px var(--zr-bg), 0 0 0 4px ${PALETA_BANNER[c].muestra}` : undefined,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

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
            style={{ backgroundColor: acento }}
            className="min-h-12 w-full rounded-lg text-sm font-bold text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar fechas'}
          </button>
        </div>
      </Seccion>

      <Regla delay={140} />

      <Seccion numero={2} titulo="Contenido de la unidad" delay={180}>
        {items.length === 0 && <p className="text-sm text-zr-text-muted">Todavía no has agregado nada.</p>}
        {items.length > 1 && (
          <p className="text-xs text-zr-text-muted">Mantén presionada la asa para arrastrar.</p>
        )}
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alTerminarArrastre}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
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
                        style={{ backgroundColor: acento }}
                        className="min-h-11 flex-1 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                      >
                        {guardandoEdicionTexto ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <FilaOrdenable key={item.id} id={item.id}>
                  {({ setNodeRef, style, asa }) => (
                    <div
                      ref={setNodeRef}
                      style={{ ...style, borderColor: acento, backgroundColor: acentoSuave }}
                      className="space-y-2 rounded-r-lg border-l-4 py-4 pl-4 pr-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {asa}
                          <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                          <button onClick={() => empezarEdicionTexto(item)} style={{ color: acento }} className="text-xs font-bold">
                            Editar
                          </button>
                          <button onClick={() => quitarItem(item.id)} className="text-xs font-bold text-zr-error">
                            Quitar
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-zr-text-muted">{item.cuerpoTexto}</p>
                    </div>
                  )}
                </FilaOrdenable>
              )
            }
            const Icono = item.type === 'material' ? iconoDeMaterial(item.materialTipo) : item.type === 'quiz' ? IconoExamen : IconoDuda
            return (
              <FilaOrdenable key={item.id} id={item.id}>
                {({ setNodeRef, style, asa }) => (
              <div ref={setNodeRef} style={style} className="zr-card space-y-4 p-5">
                {/* Pedido explícito del coordinador (8-nov-2026, segunda
                    vuelta): icono arriba a la izquierda (junto a la asa, sin
                    las flechitas de subir/bajar -- se mantiene presionada la
                    asa para arrastrar), el título en su propia fila a todo
                    el ancho de la tarjeta (antes compartía fila con el icono
                    y los botones, y se partía feo en títulos largos en
                    mayúsculas), y los botones (Quitar / Obligatorio-
                    Opcional) en una fila propia abajo. */}
                <div className="flex items-center gap-3">
                  {asa}
                  <div
                    style={{ backgroundColor: acentoSuave, color: acento }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Icono size={20} />
                  </div>
                </div>
                <div>
                  <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                  {item.type === 'tarea' && item.assignmentId && (
                    <button
                      onClick={() => router.push(`/unidades-docente/tarea/${item.assignmentId}`)}
                      style={{ color: acento }}
                      className="mt-1.5 text-xs font-bold"
                    >
                      Ver entregas y calificar ›
                    </button>
                  )}
                  {item.type === 'dudas' && (
                    <button
                      onClick={() => router.push(`/dudas-docente?unidad=${unitId}`)}
                      style={{ color: acento }}
                      className="mt-1.5 text-xs font-bold"
                    >
                      Ver y responder dudas ›
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-zr-border/60 pt-3">
                  <button onClick={() => quitarItem(item.id)} className="text-xs font-bold text-zr-error">
                    Quitar
                  </button>
                  {item.type === 'material' && (
                    <button onClick={() => alternarObligatorio(item.id, item.required)}>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          item.required
                            ? 'border-zr-warning/40 bg-zr-warning/15 text-zr-warning'
                            : 'border-zr-border bg-zr-surface text-zr-text-muted'
                        }`}
                      >
                        {item.required ? 'Obligatorio (toca para quitar)' : 'Opcional (toca para hacer obligatorio)'}
                      </span>
                    </button>
                  )}
                  {/* Pedido explícito (8-nov-2026): el profesor no tenía
                      ninguna forma de ver si administración ya aprobó/
                      rechazó su material, ni por qué. */}
                  {item.type === 'material' && item.approvalStatus && (
                    <button
                      type="button"
                      onClick={() => item.approvalStatus === 'rechazado' && setVerMotivoId(verMotivoId === item.id ? null : item.id)}
                    >
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          item.approvalStatus === 'aprobado'
                            ? 'border-zr-success/40 bg-zr-success/15 text-zr-success'
                            : item.approvalStatus === 'rechazado'
                              ? 'border-zr-error/40 bg-zr-error/15 text-zr-error'
                              : 'border-zr-border bg-zr-surface text-zr-text-muted'
                        }`}
                      >
                        {item.approvalStatus === 'aprobado'
                          ? 'Aprobado'
                          : item.approvalStatus === 'rechazado'
                            ? 'Rechazado -- toca para ver por qué'
                            : 'En espera de aprobación'}
                      </span>
                    </button>
                  )}
                </div>
                {item.type === 'material' && item.approvalStatus === 'rechazado' && verMotivoId === item.id && (
                  <p className="rounded-lg border border-zr-error/30 bg-zr-error/10 p-3 text-sm text-zr-text">
                    {item.reviewMessage?.trim() || 'Administración lo rechazó sin dejar un motivo escrito.'}
                  </p>
                )}

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
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-xs text-zr-text"
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
                        style={{ backgroundColor: acento }}
                        className="shrink-0 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50"
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
                )}
              </FilaOrdenable>
            )
          })}
        </div>
        </SortableContext>
        </DndContext>

        <div className="zr-card space-y-5 p-5">
          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Agregar material ya subido</label>
            <div className="flex gap-2">
              <select
                id="sel-material"
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
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
                style={{ backgroundColor: acento }}
                className="shrink-0 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            <Link
              href={`/contenido-docente?unitId=${unitId}`}
              style={{ color: acento }}
              className="mt-1 inline-block text-xs font-bold"
            >
              + Subir material nuevo para esta unidad ›
            </Link>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Examen</label>
            {/* Pedido explícito del coordinador (reunión 7-nov-2026): se quitó
                "agregar examen ya creado" -- confundía (quedaba un examen
                borrado del aula pero seguía ocupando % en Notas, ver fix de
                la migración 199) y en la práctica nunca se reusaba un examen
                entre unidades. El examen se crea desde DENTRO de la unidad;
                /crear-examen/nuevo ya sabe preseleccionar el módulo y, al
                guardar, engancharse solo aquí. */}
            <Link
              href={`/crear-examen/nuevo?unitId=${unitId}`}
              style={{ color: acento }}
              className="inline-block text-xs font-bold"
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
              style={{ backgroundColor: acento }}
              className="min-h-12 w-full rounded-lg text-sm font-bold text-white disabled:opacity-40"
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
            <input
              type="number"
              min={1}
              max={100}
              value={tareaPeso}
              onChange={(e) => setTareaPeso(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="% que vale en la nota del módulo"
              className="mb-1 min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm tabular-nums text-zr-text outline-none focus:border-zr-blue"
            />
            <p className="mb-2 text-xs text-zr-text-muted">
              Esta tarea ya queda registrada como evaluación en Notas -- no hay que crearla ahí aparte. Tiene que valer más de 0%.
            </p>
            <button
              onClick={crearTarea}
              disabled={!tareaTitulo.trim() || !tareaPeso || creandoTarea}
              style={{ backgroundColor: acento }}
              className="min-h-12 w-full rounded-lg text-sm font-bold text-white disabled:opacity-40"
            >
              {creandoTarea ? 'Creando…' : 'Crear tarea'}
            </button>
          </div>

          {!tieneDudas && (
            <button
              onClick={() => agregarItem('dudas')}
              style={{ borderColor: acento, color: acento }}
              className="min-h-12 w-full rounded-lg border border-dashed text-sm font-bold"
            >
              + Agregar sección de Dudas a esta unidad
            </button>
          )}
        </div>
      </Seccion>

      {confirmandoTarea && (
        <ModalEvaluacionAgregada
          peso={pesoTareaConfirmada}
          onCerrar={() => setConfirmandoTarea(false)}
        />
      )}
    </div>
  )
}
