'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { BannerUnidad } from '@/components/ui/BannerUnidad'
import { PestanasUnidad, type PestanaUnidad } from '@/components/ui/PestanasUnidad'
import { IconoDocumento, IconoExamen, IconoDuda, IconoCheck, IconoChevron, IconoCandado } from '@/components/ui/Iconos'

/**
 * Aula Virtual — detalle de una unidad: sus elementos en orden (material,
 * examen, tarea, dudas). RLS de unit_items (migración 174) ya decide qué
 * elementos están visibles ahora mismo; aquí solo se pintan.
 *
 * Pedido explícito del coordinador (reunión 31-oct-2026, con video de
 * referencia de un aula virtual real): que se parezca "demasiado" a eso,
 * con nuestra identidad -- de ahí la fila de pestañas arriba (una por
 * unidad, como el video) y el banner de marca en vez de foto de archivo
 * (ver components/ui/PestanasUnidad.tsx y BannerUnidad.tsx).
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
  tarea: IconoDocumento,
  dudas: IconoDuda,
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

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: unidad } = await supabase.from('units').select('title').eq('id', unitId).maybeSingle()
      if (!unidad) {
        router.replace('/unidades')
        return
      }
      setTitulo(unidad.title)

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
          <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} />
          <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
            <IconoCandado size={32} className="text-zr-text-muted" />
            <p className="text-base font-bold text-zr-text">Esta unidad todavía está cerrada</p>
            <p className="text-sm text-zr-text-muted">
              Se abre cuando apruebes la certificación de la unidad anterior. Vuelve cuando la tengas lista.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Barra de obligatorios: hasta no completar los materiales obligatorios, no
  // se puede presentar la certificación (lo valida el servidor; aquí se avisa
  // antes, con una barra, para que el estudiante sepa qué le falta).
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

      <div className="mt-7 space-y-11">
        <BannerUnidad sobretitulo="Aula Virtual" titulo={titulo} />

        {hayCertificacion && obligatorios.length > 0 && (
          <div className="zr-card space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-zr-text">
                {certificacionTrabada ? 'Antes de la certificación' : '¡Materiales obligatorios listos!'}
              </p>
              <span className="text-sm font-bold tabular-nums text-zr-blue-mid">
                {obligatoriosCompletos}/{obligatorios.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zr-border">
              <div
                className={`h-full rounded-full transition-all ${certificacionTrabada ? 'bg-zr-warning' : 'bg-zr-success'}`}
                style={{ width: `${pctObligatorios}%` }}
              />
            </div>
            <p className="text-xs text-zr-text-muted">
              {certificacionTrabada
                ? `Completa ${faltanObligatorios} material${faltanObligatorios === 1 ? '' : 'es'} obligatorio${faltanObligatorios === 1 ? '' : 's'} para poder presentar la certificación.`
                : 'Ya puedes presentar la certificación de esta unidad.'}
            </p>
          </div>
        )}

        <Seccion numero={1} titulo="Contenido de la unidad" delay={100}>
          {items.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Tu profesor todavía no agregó nada aquí.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const Icono = ICONO[item.type]
                // Certificación trabada por materiales obligatorios pendientes:
                // se ve con candado y no deja entrar (el servidor igual lo
                // bloquea; esto evita que choque contra el error).
                const trabada = item.esCertificacion && certificacionTrabada
                if (trabada) {
                  return (
                    <div key={item.id} className="zr-card flex items-center gap-4 p-5 opacity-70">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-border/60 text-zr-text-muted">
                        <IconoCandado size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-base font-bold text-zr-text-muted">{item.titulo}</p>
                        <div className="mt-1">
                          <Etiqueta tono="neutro">Completa los materiales obligatorios</Etiqueta>
                        </div>
                      </div>
                    </div>
                  )
                }
                // Bloque de texto (migración 187): sin archivo que abrir, se
                // muestra completo aquí mismo -- no tiene sentido llevarlo a
                // un visor aparte para mostrar un párrafo.
                if (item.esTexto) {
                  return (
                    <div key={item.id} className="zr-card space-y-2 p-5">
                      <div className="flex items-center gap-2">
                        <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                        {item.required && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-zr-text-muted">{item.cuerpoTexto}</p>
                    </div>
                  )
                }
                return (
                  <Link
                    key={item.id}
                    href={hrefDe(item)}
                    className="zr-card zr-card-interactive flex items-center gap-4 p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue">
                      {item.completado ? <IconoCheck size={20} className="text-zr-success" /> : <Icono size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-bold text-zr-text">{item.titulo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {item.required && <Etiqueta tono="aviso">Obligatorio</Etiqueta>}
                        {item.completado && <Etiqueta tono="exito">Completado</Etiqueta>}
                        {item.esCertificacion && <Etiqueta tono="info">Certificación</Etiqueta>}
                      </div>
                    </div>
                    <IconoChevron size={18} className="shrink-0 text-zr-text-muted" />
                  </Link>
                )
              })}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
