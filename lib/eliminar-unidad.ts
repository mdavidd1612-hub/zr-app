import { createClient } from '@/lib/supabase/client'

/**
 * Eliminar o renombrar una unidad completa (pedido explícito del
 * coordinador, 7-nov-2026: "si quiero eliminar inglés 1"). `units` tiene
 * varias foreign keys hacia ella (verificado contra el esquema real antes
 * de construir esto):
 *
 *   - assignments.unit_id    → ON DELETE CASCADE (la tarea se borra sola)
 *   - submissions.assignment_id → ON DELETE CASCADE (la entrega se borra sola)
 *   - unit_items.unit_id     → ON DELETE CASCADE (los enlaces se borran solos)
 *   - doubts.unit_id         → ON DELETE SET NULL (la duda queda, sin unidad)
 *
 * Lo que la base NO hace sola (y la migración 197 + esta función sí hacen):
 *   1. Los ARCHIVOS subidos en Storage (entregas en el bucket 'tareas', la
 *      imagen del banner en 'banners-unidad') -- Postgres no puede tocar
 *      Storage. Se leen las rutas y se borran ANTES de llamar al RPC, que
 *      es lo que realmente borra las filas.
 *      IMPORTANTE: el bucket 'tareas' no tenía ninguna política de DELETE
 *      (ni para el estudiante ni para el personal) -- sin eso, RLS bloqueaba
 *      el borrado de archivos para todos. Se agregó en la migración 197.
 *   2. Los bloques de texto (content_items tipo 'texto'): se enlazan por
 *      unit_items, no por una columna propia -- el RPC `fn_eliminar_unidad`
 *      los borra a mano antes de borrar la unidad.
 *   3. Material y exámenes REUTILIZADOS (no son de tipo 'texto') NUNCA se
 *      borran -- solo se desenlazan (así es como ya funciona "Agregar
 *      material/examen ya subido"): pueden estar en otra unidad o en la
 *      lista general de Material.
 *
 * Si alguna tarea de esta unidad ya tenía nota cargada en Notas (fusión
 * H.33, migración 193), esa evaluación se queda en Notas con su nota --
 * solo pierde el enlace automático (source_assignment_id → null). No se
 * borra una nota real de un estudiante por borrar la unidad.
 */

export interface ResumenUnidad {
  materialesEnlazados: number
  examenesEnlazados: number
  tareas: number
  entregas: number
  bloquesTexto: number
  dudas: number
}

export async function resumenAntesDeEliminar(unitId: string): Promise<ResumenUnidad> {
  const supabase = createClient()

  const { data: filas } = await supabase
    .from('unit_items')
    .select('type, content_item_id, exam_id, assignment_id, content_items(type)')
    .eq('unit_id', unitId)

  const items = (filas ?? []) as unknown as {
    type: string; content_item_id: string | null; exam_id: string | null; assignment_id: string | null
    content_items: { type: string } | null
  }[]

  const tareaIds = items.filter((i) => i.assignment_id).map((i) => i.assignment_id as string)
  const { count: entregas } = tareaIds.length
    ? await supabase.from('submissions').select('id', { count: 'exact', head: true }).in('assignment_id', tareaIds)
    : { count: 0 }
  const { count: dudas } = await supabase
    .from('doubts').select('id', { count: 'exact', head: true }).eq('unit_id', unitId)

  return {
    materialesEnlazados: items.filter((i) => i.type === 'material' && i.content_items?.type !== 'texto').length,
    examenesEnlazados: items.filter((i) => i.type === 'quiz').length,
    tareas: tareaIds.length,
    entregas: entregas ?? 0,
    bloquesTexto: items.filter((i) => i.content_items?.type === 'texto').length,
    dudas: dudas ?? 0,
  }
}

export async function eliminarUnidad(unitId: string): Promise<{ error: string | null }> {
  const supabase = createClient()

  // 1. Qué hay enlazado, mientras todavía existe la fila de unit_items.
  const { data: filas } = await supabase
    .from('unit_items')
    .select('assignment_id')
    .eq('unit_id', unitId)

  const idsTareas = (filas ?? []).map((i) => i.assignment_id).filter(Boolean) as string[]

  // 2. Archivos de las entregas (bucket 'tareas') -- se borran antes de
  //    llamar al RPC, que se lleva las filas (y sus file_path) en cascada.
  if (idsTareas.length > 0) {
    const { data: entregas } = await supabase
      .from('submissions').select('file_path').in('assignment_id', idsTareas)
    const rutas = (entregas ?? []).map((e) => e.file_path).filter(Boolean) as string[]
    if (rutas.length > 0) {
      const { error: errorStorage } = await supabase.storage.from('tareas').remove(rutas)
      if (errorStorage) return { error: errorStorage.message }
    }
  }

  // 3. Imagen del banner (bucket 'banners-unidad'), si tenía.
  const { data: unidad } = await supabase.from('units').select('banner_image_path').eq('id', unitId).maybeSingle()
  if (unidad?.banner_image_path) {
    await supabase.storage.from('banners-unidad').remove([unidad.banner_image_path])
  }

  // 4. La unidad y todo lo que cuelga de ella: en un solo RPC atómico
  //    (migración 197) -- si algo falla a mitad de camino, se revierte todo.
  const { error } = await supabase.rpc('fn_eliminar_unidad', { p_unit_id: unitId })
  return { error: error?.message ?? null }
}

export async function renombrarUnidad(unitId: string, titulo: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const limpio = titulo.trim()
  if (!limpio) return { error: 'El título no puede quedar vacío.' }
  const { error } = await supabase.from('units').update({ title: limpio }).eq('id', unitId)
  return { error: error?.message ?? null }
}
