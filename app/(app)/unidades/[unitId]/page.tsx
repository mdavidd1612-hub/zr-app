'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Etiqueta } from '@/components/ui/Editorial'
import { Recorrido, Paso, type EstadoPaso } from '@/components/ui/Recorrido'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { TextoRico } from '@/components/ui/TextoRico'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { BannerUnidad, type ColorBanner } from '@/components/ui/BannerUnidad'
import { acentoDe } from '@/lib/banner-unidad'
import { PestanasUnidad, type PestanaUnidad } from '@/components/ui/PestanasUnidad'
import { IconoDocumento, IconoExamen, IconoDuda, IconoLapiz, IconoCandado } from '@/components/ui/Iconos'
import { iconoDeMaterial } from '@/components/ui/IconoMaterial'
import { eyebrowMaterial } from '@/lib/material'

/**
 * Aula Virtual — detalle de una unidad: sus elementos en orden (material,
 * examen, tarea, dudas) como un recorrido conectado. RLS de unit_items
 * (migración 174) ya decide qué está visible ahora; aquí solo se dibuja.
 *
 * Pedido del coordinador (reunión 31-oct-2026, con video de referencia de un
 * aula virtual real): que se parezca a eso con nuestra identidad — de ahí la
 * fila de pestañas arriba (una por unidad) y el banner de marca. El contenido
 * baja como un camino de pasos, no como cuadros apilados.
 */

interface ItemFila {
  id: string
  type: 'material' | 'quiz' | 'tarea' | 'dudas'
  required: boolean
  content_item_id: string | null
  exam_id: string | null
  assignment_id: string | null
  titulo: string
  completado: boolean
  esCertificacion: boolean
  esTexto: boolean
  cuerpoTexto: string | null
  materialTipo: string | null
  examAbreEl: string | null
}

function iconoDe(item: ItemFila) {
  if (item.type === 'quiz') return IconoExamen
  if (item.type === 'tarea') return IconoLapiz
  if (item.type === 'dudas') return IconoDuda
  return iconoDeMaterial(item.materialTipo)
}

// Pedido explícito del coordinador (reunión 7-nov-2026): el rótulo debe
// decir el tipo real del archivo ("Documento"/"Presentación"/"Imagen"/
// "Video"/"Audio"), no "Material" genérico para todo.
function eyebrowDe(item: ItemFila): string {
  if (item.type === 'quiz') return item.esCertificacion ? 'Certificación' : 'Examen'
  if (item.type === 'tarea') return 'Tarea'
  if (item.type === 'dudas') return 'Dudas'
  return item.esTexto ? 'Lectura' : eyebrowMaterial(item.materialTipo ?? '')
}

export default function UnidadDetalle() {
  const router = useRouter()
  const params = useParams()
  const unitId = params.unitId as string

  const [titulo, setTitulo] = useState('')
  const [unidades, setUnidades] = useState<PestanaUnidad[]>([])
  const [items, setItems] = useState<ItemFila[]>([])
  const [bloqueada, setBloqueada] = useState(false)
  const [cargando, setCargando] = useState(true)
  // Banner personalizable (migración 194): lo configura el profesor desde
  // "Editar unidad"; aquí solo se lee y se dibuja igual.
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [bannerPosicion, setBannerPosicion] = useState(50)
  const [bannerColor, setBannerColor] = useState<ColorBanner | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: unidad } = await supabase
        .from('units')
        .select('title, banner_image_path, banner_color, banner_image_position')
        .eq('id', unitId).maybeSingle()
      if (!unidad) {
        router.replace('/unidades')
        return
      }
      setTitulo(unidad.title)
      setBannerColor(unidad.banner_color as ColorBanner | null)
      setBannerPosicion(unidad.banner_image_position ?? 50)
      setBannerUrl(
        unidad.banner_image_path
          ? supabase.storage.from('banners-unidad').getPublicUrl(unidad.banner_image_path).data.publicUrl
          : null,
      )

      // Fila de pestañas: todas las unidades que RLS ya le deja ver (abierta
      // o cerrada) a este estudiante, en su módulo -- v_units_status aplica
      // la misma política que la lista de /unidades, no hace falta repetirla.
      const { data: todasRaw } = await supabase
        .from('v_units_status').select('id, title, order_index, prerequisite_met').order('order_index', { ascending: true })
      // Casteo: prerequisite_met entra en la vista en la migración 185.
      const todas = (todasRaw ?? []) as unknown as { id: string; title: string; order_index: number; prerequisite_met: boolean }[]
      setUnidades(
        todas
          .filter((u) => !!u.id && !!u.title)
          .map((u) => ({ id: u.id, title: u.title })),
      )
      // Compuerta (migración 185): si esta unidad está bloqueada, su contenido
      // ni siquiera carga (RLS) -- mostramos candado en vez de "sin contenido".
      const estaUnidad = todas.find((u) => u.id === unitId)
      if (estaUnidad && estaUnidad.prerequisite_met === false) {
        setBloqueada(true)
        setCargando(false)
        return
      }

      const { data: filas } = await supabase
        .from('unit_items')
        .select(`
          id, type, required, content_item_id, exam_id, assignment_id, order_index,
          content_items ( title, type, description ),
          exams ( title, kind, opens_at ),
          assignments ( title )
        `)
        .eq('unit_id', unitId)
        .order('order_index', { ascending: true })

      const contentIds = (filas ?? []).map((f) => f.content_item_id).filter((x): x is string => !!x)
      const { data: progresos } = contentIds.length
        ? await supabase
            .from('material_progress')
            .select('content_item_id, completed_at')
            .eq('student_id', user.id)
            .in('content_item_id', contentIds)
        : { data: [] }
      const completos = new Set((progresos ?? []).filter((p) => p.completed_at).map((p) => p.content_item_id))

      // Pedido explícito del coordinador (8-nov-2026): el check de
      // "completado" solo se calculaba para material (material_progress).
      // Un examen entregado/calificado o una tarea ya enviada se quedaban
      // con el mismo color/ícono de siempre, sin ninguna marca -- fácil
      // confundirse sobre qué ya se hizo. Dudas y lecturas (bloque de
      // texto) a propósito NO llevan check: no son algo que se "complete".
      const examIds = (filas ?? []).map((f) => f.exam_id).filter((x): x is string => !!x)
      const { data: intentos } = examIds.length
        ? await supabase
            .from('exam_attempts')
            .select('exam_id, status')
            .eq('student_id', user.id)
            .in('exam_id', examIds)
            .in('status', ['entregado', 'calificado'])
        : { data: [] }
      const examenesCompletos = new Set((intentos ?? []).map((i) => i.exam_id))

      const assignmentIds = (filas ?? []).map((f) => f.assignment_id).filter((x): x is string => !!x)
      const { data: entregas } = assignmentIds.length
        ? await supabase
            .from('submissions')
            .select('assignment_id')
            .eq('student_id', user.id)
            .in('assignment_id', assignmentIds)
        : { data: [] }
      const tareasCompletas = new Set((entregas ?? []).map((e) => e.assignment_id))

      setItems(
        (filas ?? []).map((f) => {
          const ci = f.content_items as unknown as { title: string; type: string; description: string | null } | null
          const ex = f.exams as unknown as { title: string; kind: string; opens_at: string | null } | null
          const ta = f.assignments as unknown as { title: string } | null
          const completado =
            f.type === 'material' ? (f.content_item_id ? completos.has(f.content_item_id) : false) :
            f.type === 'quiz' ? (f.exam_id ? examenesCompletos.has(f.exam_id) : false) :
            f.type === 'tarea' ? (f.assignment_id ? tareasCompletas.has(f.assignment_id) : false) :
            false
          return {
            id: f.id,
            type: f.type,
            required: f.required,
            content_item_id: f.content_item_id,
            exam_id: f.exam_id,
            assignment_id: f.assignment_id,
            titulo: ci?.title ?? ex?.title ?? ta?.title ?? (f.type === 'dudas' ? 'Dudas de esta unidad' : 'Todavía no disponible'),
            completado,
            esCertificacion: f.type === 'quiz' && ex?.kind === 'certificacion',
            esTexto: ci?.type === 'texto',
            cuerpoTexto: ci?.type === 'texto' ? (ci.description ?? '') : null,
            materialTipo: ci?.type ?? null,
            examAbreEl: f.type === 'quiz' ? (ex?.opens_at ?? null) : null,
          }
        }),
      )
      setCargando(false)
    }
    cargar()
  }, [unitId, router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  // Compuerta: unidad bloqueada por no aprobar la certificación anterior.
  if (bloqueada) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="space-y-7">
          <BotonVolver href="/unidades" />
          <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades" />
        </div>
        <div className="mt-7 space-y-6">
          <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} imagenUrl={bannerUrl} posicionImagen={bannerPosicion} color={bannerColor} />
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zr-surface text-zr-text-muted ring-1 ring-zr-border">
              <IconoCandado size={26} />
            </span>
            <p className="text-base font-bold text-zr-text">Esta unidad todavía está cerrada</p>
            <p className="max-w-xs text-sm text-zr-text-muted">
              Se abre cuando apruebes la certificación de la unidad anterior. Vuelve cuando la tengas lista.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Barra de obligatorios: hasta no completar los materiales obligatorios, no
  // se puede presentar la certificación (lo valida el servidor; aquí se avisa
  // antes para que el estudiante sepa qué le falta).
  // Los bloques de texto no pasan por material_progress (no hay visor que
  // marque "visto"), así que nunca cuentan como obligatorio -- quedaría
  // trabada la certificación para siempre si se incluyeran.
  const obligatorios = items.filter((i) => i.type === 'material' && i.required && !i.esTexto)
  const obligatoriosCompletos = obligatorios.filter((i) => i.completado).length
  const faltanObligatorios = obligatorios.length - obligatoriosCompletos
  const hayCertificacion = items.some((i) => i.esCertificacion)
  const certificacionTrabada = faltanObligatorios > 0
  const pctObligatorios = obligatorios.length === 0 ? 100 : Math.round((obligatoriosCompletos / obligatorios.length) * 100)

  function hrefDe(item: ItemFila): string {
    if (item.type === 'material' && item.content_item_id) return `/unidades/${unitId}/material/${item.content_item_id}`
    if (item.type === 'quiz' && item.exam_id) return `/examenes/${item.exam_id}`
    if (item.type === 'tarea' && item.assignment_id) return `/unidades/${unitId}/tarea/${item.assignment_id}`
    if (item.type === 'dudas') return `/dudas?unidad=${unitId}`
    return '#'
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-7">
        <BotonVolver href="/unidades" />

        <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades" />
      </div>

      <div className="mt-7 space-y-9">
        <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} imagenUrl={bannerUrl} posicionImagen={bannerPosicion} color={bannerColor} />

        {/* Avance de obligatorios, tejido sin cuadro: un rótulo, una línea fina
            y el texto de lo que falta. */}
        {obligatorios.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                {hayCertificacion ? (certificacionTrabada ? 'Para la certificación' : 'Materiales obligatorios listos') : 'Tu avance en la unidad'}
              </p>
              <span className="cifra text-sm text-zr-blue-mid">
                {obligatoriosCompletos}/{obligatorios.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zr-border/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${certificacionTrabada ? 'bg-zr-warning' : 'bg-zr-success'}`}
                style={{ width: `${pctObligatorios}%` }}
              />
            </div>
            <p className="text-xs text-zr-text-muted">
              {certificacionTrabada
                ? `Te falta${faltanObligatorios === 1 ? '' : 'n'} ${faltanObligatorios} material${faltanObligatorios === 1 ? '' : 'es'} obligatorio${faltanObligatorios === 1 ? '' : 's'}${hayCertificacion ? ' para presentar la certificación.' : '.'}`
                : hayCertificacion ? 'Ya puedes presentar la certificación de esta unidad.' : 'Ya viste todo lo obligatorio.'}
            </p>
          </div>
        )}

        <section className="animate-rise space-y-6">
          <p className="zr-eyebrow">01 — CONTENIDO DE LA UNIDAD</p>

          {items.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Tu profesor todavía no agregó nada aquí.</p>
          ) : (
            <Recorrido>
              {items.map((item, idx) => {
                const Icono = iconoDe(item)
                const ultimo = idx === items.length - 1
                const trabada = item.esCertificacion && certificacionTrabada
                // Pendiente de la reunión 7-nov-2026: examen con fecha de
                // apertura propia (exams.opens_at) todavía no alcanzada. El
                // servidor ya lo rechaza de verdad (migración 200) -- esto
                // solo evita que el estudiante toque algo que va a fallar.
                const examNoAbre = item.examAbreEl && new Date(item.examAbreEl) > new Date()

                // Bloque de texto (migración 187): sin archivo que abrir, se
                // muestra completo aquí mismo, como una lectura del camino.
                if (item.esTexto) {
                  // Pedido explícito del coordinador (nov 2026): un bloque de
                  // texto no debe verse "como un cuadro más" -- se saca del
                  // patrón de tarjeta-de-archivo (icono + caja) y se trata
                  // como una nota editorial: borde de acento, sin icono.
                  return (
                    <Paso
                      key={item.id}
                      estado="disponible"
                      icono={Icono}
                      eyebrow={eyebrowDe(item)}
                      titulo={item.titulo}
                      meta={item.required ? <Etiqueta tono="aviso">Obligatorio</Etiqueta> : undefined}
                      ultimo={ultimo}
                      delay={80 + idx * 50}
                      acento={acentoDe(bannerColor)}
                    >
                      <TextoRico texto={item.cuerpoTexto ?? ''} />
                    </Paso>
                  )
                }

                // Certificación trabada por materiales obligatorios pendientes:
                // nodo con candado y sin navegar (el servidor igual lo bloquea).
                if (trabada) {
                  return (
                    <Paso
                      key={item.id}
                      estado="bloqueado"
                      eyebrow={eyebrowDe(item)}
                      titulo={item.titulo}
                      meta={<Etiqueta tono="neutro">Completa los materiales obligatorios</Etiqueta>}
                      ultimo={ultimo}
                      delay={80 + idx * 50}
                    />
                  )
                }

                if (examNoAbre) {
                  const fecha = new Date(item.examAbreEl as string).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })
                  return (
                    <Paso
                      key={item.id}
                      estado="bloqueado"
                      eyebrow={eyebrowDe(item)}
                      titulo={item.titulo}
                      meta={<Etiqueta tono="neutro">Se abre el {fecha}</Etiqueta>}
                      ultimo={ultimo}
                      delay={80 + idx * 50}
                    />
                  )
                }

                // Bug real de la reunión 7-nov-2026: si el join a content_items/
                // exams/assignments no trae nada (RLS -- el material sigue
                // pendiente de revisión, o la fecha/cohorte no coincide), el
                // ítem se veía "Sin título" y, al tocarlo, devolvía en bucle a
                // la unidad sin explicar nada. Ahora se muestra bloqueado con
                // el motivo, en vez de navegar a algo que no va a cargar.
                const sinResolver = item.type !== 'dudas' && item.titulo === 'Todavía no disponible'
                if (sinResolver) {
                  return (
                    <Paso
                      key={item.id}
                      estado="bloqueado"
                      eyebrow={eyebrowDe(item)}
                      titulo={item.titulo}
                      meta={<Etiqueta tono="neutro">Avisa a tu profesor si esto no cambia</Etiqueta>}
                      ultimo={ultimo}
                      delay={80 + idx * 50}
                    />
                  )
                }

                const estado: EstadoPaso = item.completado ? 'completado' : 'disponible'
                const meta = (
                  <>
                    {item.required && !item.completado && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                    {item.esCertificacion && <Etiqueta tono="info">Certificación</Etiqueta>}
                    {item.completado && <Etiqueta tono="exito">Completado</Etiqueta>}
                  </>
                )

                return (
                  <Paso
                    key={item.id}
                    estado={estado}
                    icono={item.completado ? undefined : Icono}
                    eyebrow={eyebrowDe(item)}
                    titulo={item.titulo}
                    meta={meta}
                    href={hrefDe(item)}
                    ultimo={ultimo}
                    delay={80 + idx * 50}
                    acento={acentoDe(bannerColor)}
                  />
                )
              })}
            </Recorrido>
          )}
        </section>
      </div>
    </div>
  )
}
