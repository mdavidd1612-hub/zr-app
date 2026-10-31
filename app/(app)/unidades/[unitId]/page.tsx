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
import { IconoDocumento, IconoExamen, IconoDuda, IconoCheck, IconoChevron } from '@/components/ui/Iconos'

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
      const { data: todas } = await supabase
        .from('v_units_status').select('id, title, order_index').order('order_index', { ascending: true })
      setUnidades(
        (todas ?? [])
          .filter((u): u is { id: string; title: string; order_index: number } => !!u.id && !!u.title)
          .map((u) => ({ id: u.id, title: u.title })),
      )

      const { data: filas } = await supabase
        .from('unit_items')
        .select(`
          id, type, required, content_item_id, exam_id, assignment_id, order_index,
          content_items ( title ),
          exams ( title ),
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
          const ci = f.content_items as unknown as { title: string } | null
          const ex = f.exams as unknown as { title: string } | null
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
          }
        }),
      )
      setCargando(false)
    }
    cargar()
  }, [unitId, router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

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

        <Seccion numero={1} titulo="Contenido de la unidad" delay={100}>
          {items.length === 0 ? (
            <p className="text-sm text-zr-text-muted">Tu profesor todavía no agregó nada aquí.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const Icono = ICONO[item.type]
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
