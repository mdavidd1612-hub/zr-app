import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Bloqueo de una unidad por una certificación (migración 208).
 * Valor del selector: 'auto' (por orden, comportamiento de siempre), 'none'
 * (se abre libre) o el id de la certificación de la que depende.
 */
export interface OpcionCertificacion {
  id: string
  label: string
  orden: number
}

export async function certificacionesDelModulo(
  supabase: SupabaseClient,
  moduleId: string,
  hastaOrden?: number,
  cohortId?: string | null,
): Promise<OpcionCertificacion[]> {
  // Unidades por corte (migr. 241): con corte, solo las de ese corte y las generales.
  let consultaUnidades = supabase.from('units').select('id, title, order_index').eq('module_id', moduleId)
  if (cohortId) consultaUnidades = consultaUnidades.or(`cohort_id.is.null,cohort_id.eq.${cohortId}`)
  const [{ data: examenes }, { data: unidades }] = await Promise.all([
    supabase.from('exams').select('id, title, unit_id').eq('module_id', moduleId).eq('kind', 'certificacion'),
    consultaUnidades,
  ])
  const porUnidad = new Map((unidades ?? []).map((u) => [u.id as string, u as { id: string; title: string; order_index: number }]))
  return ((examenes ?? []) as { id: string; title: string; unit_id: string | null }[])
    .filter((e) => e.unit_id && porUnidad.has(e.unit_id))
    .map((e) => {
      const u = porUnidad.get(e.unit_id as string)!
      return { id: e.id, label: `${e.title} (${u.title})`, orden: u.order_index }
    })
    .filter((o) => hastaOrden === undefined || o.orden < hastaOrden)
    .sort((a, b) => a.orden - b.orden)
}

export function valorAColumnas(valor: string): { gate_mode: 'auto' | 'none' | 'exam'; gate_exam_id: string | null } {
  if (valor === 'auto') return { gate_mode: 'auto', gate_exam_id: null }
  if (valor === 'none') return { gate_mode: 'none', gate_exam_id: null }
  return { gate_mode: 'exam', gate_exam_id: valor }
}

export function columnasAValor(modo: string | null | undefined, examId: string | null | undefined): string {
  if (modo === 'none') return 'none'
  if (modo === 'exam' && examId) return examId
  return 'auto'
}
