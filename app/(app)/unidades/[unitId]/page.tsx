'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Etiqueta } from '@/components/ui/Editorial'
import { Recorrido, Paso, type EstadoPaso } from '@/components/ui/Recorrido'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { BannerUnidad, type ColorBanner } from '@/components/ui/BannerUnidad'
import { PestanasUnidad, type PestanaUnidad } from '@/components/ui/PestanasUnidad'
import { IconoDocumento, IconoExamen, IconoDuda, IconoLapiz, IconoCandado } from '@/components/ui/Iconos'

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
}

const ICONO: Record<ItemFila['type'], typeof IconoDocumento> = {
  material: IconoDocumento,
  quiz: IconoExamen,
  tarea: IconoLapiz,
  dudas: IconoDuda,
}

function eyebrowDe(item: ItemFila): string {
  if (item.type === 'quiz') return item.esCertificacion ? 'Certificación' : 'Examen'
  if (item.type === 'tarea') return 'Tarea'
  if (item.type === 'dudas') return 'Dudas'
  return item.esTexto ? 'Lectura' : 'Material'
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
  const [bannerColor, setBannerColor] = useState<ColorBanner | null>(null)
  const [bannerAspecto, setBannerAspecto] = useState<'moderno' | 'clasico'>('moderno')

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
        .select('title, banner_image_path, banner_color, banner_aspecto')
        .eq('id', unitId).maybeSingle()
      if (!unidad) {
        router.replace('/unidades')
        return
      }
      setTitulo(unidad.title)
      setBannerColor(unidad.banner_color as ColorBanner | null)
      setBannerAspecto((unidad.banner_aspecto as 'moderno' | 'clasico') ?? 'moderno')
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
          exams ( title, kind ),
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

      setItems(
        (filas ?? []).map((f) => {
          const ci = f.content_items as unknown as { title: string; type: string; description: string | null } | null
          const ex = f.exams as unknown as { title: string; kind: string } | null
          const ta = f.assignments as unknown as { title: string } | null
          return {
            id: f.id,
            type: f.type,
            required: f.required,
            content_item_id: f.content_item_id,
            exam_id: f.exam_id,
            assignment_id: f.assignment_id,
            titulo: ci?.title ?? ex?.title ?? ta?.title ?? (f.type === 'dudas' ? 'Dudas de esta unidad' : 'Sin título'),
            completado: f.content_item_id ? completos.has(f.content_item_id) : false,
            esCertificacion: f.type === 'quiz' && ex?.kind === 'certificacion',
            esTexto: ci?.type === 'texto',
            cuerpoTexto: ci?.type === 'texto' ? (ci.description ?? '') : null,
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
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
        <div className="space-y-7">
          <BotonVolver href="/unidades" />
          <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades" />
        </div>
        <div className="mt-7 space-y-6">
          <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} imagenUrl={bannerUrl} color={bannerColor} />
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
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-7">
        <BotonVolver href="/unidades" />

        <PestanasUnidad unidades={unidades} activaId={unitId} hrefBase="/unidades" />
      </div>

      <div className="mt-7 space-y-9">
        <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} imagenUrl={bannerUrl} color={bannerColor} />

        {/* Avance de obligatorios, tejido sin cuadro: un rótulo, una línea fina
            y el texto de lo que falta. */}
        {hayCertificacion && obligatorios.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                {certificacionTrabada ? 'Para la certificación' : 'Materiales obligatorios listos'}
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
                ? `Te falta${faltanObligatorios === 1 ? '' : 'n'} ${faltanObligatorios} material${faltanObligatorios === 1 ? '' : 'es'} obligatorio${faltanObligatorios === 1 ? '' : 's'} para presentar la certificación.`
                : 'Ya puedes presentar la certificación de esta unidad.'}
            </p>
          </div>
        )}

        <section className="animate-rise space-y-6">
          <p className="zr-eyebrow">01 — CONTENIDO DE LA UNIDAD</p>

          {items.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Tu profesor todavía no agregó nada aquí.</p>
          ) : bannerAspecto === 'clasico' ? (
            // Aspecto clásico (migración 194): el profesor eligió tarjetas
            // apiladas en vez del recorrido conectado para esta unidad.
            <div className="space-y-3">
              {items.map((item) => {
                const trabada = item.esCertificacion && certificacionTrabada
                const contenido = (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">{eyebrowDe(item)}</p>
                    <p className="mt-0.5 text-base font-bold text-zr-text">{item.titulo}</p>
                    <span className="mt-2 flex flex-wrap gap-2">
                      {item.required && !item.completado && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                      {item.esCertificacion && <Etiqueta tono="info">Certificación</Etiqueta>}
                      {item.completado && <Etiqueta tono="exito">Completado</Etiqueta>}
                      {trabada && <Etiqueta tono="neutro">Completa los materiales obligatorios</Etiqueta>}
                    </span>
                    {item.esTexto && (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zr-text-muted">
                        {item.cuerpoTexto}
                      </p>
                    )}
                  </>
                )
                return item.esTexto || trabada ? (
                  <div key={item.id} className="zr-card p-5">{contenido}</div>
                ) : (
                  <Link key={item.id} href={hrefDe(item)} className="zr-card zr-card-interactive block p-5">
                    {contenido}
                  </Link>
                )
              })}
            </div>
          ) : (
            <Recorrido>
              {items.map((item, idx) => {
                const Icono = ICONO[item.type]
                const ultimo = idx === items.length - 1
                const trabada = item.esCertificacion && certificacionTrabada

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
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zr-text-muted">
                        {item.cuerpoTexto}
                      </p>
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
