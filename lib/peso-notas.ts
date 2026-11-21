import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cuánto % ya está ocupado en Notas para un módulo (y su cohorte, si aplica),
 * sin contar una evaluación que se esté editando (`excluirId`). Mismo criterio
 * que usa `RegistrarEvaluacion.tsx` antes de guardar -- se repite aquí porque
 * crear-examen y la tarea de Aula Virtual no pasan por ese componente, pero
 * el bug de la reunión del 7-nov-2026 fue justamente no validar esto antes de
 * guardar (la única señal era la excepción SQL de `fn_validar_suma_pesos`).
 */
export async function sumaPesoOcupado(
  supabase: SupabaseClient,
  moduleId: string,
  cohortId: string | null,
  excluirId?: string,
): Promise<number> {
  let query = supabase
    .from('manual_exam_definitions')
    .select('weight_pct')
    .eq('module_id', moduleId)

  query = cohortId
    ? query.or(`cohort_id.is.null,cohort_id.eq.${cohortId}`)
    : query.is('cohort_id', null)

  if (excluirId) query = query.neq('id', excluirId)

  const { data } = await query
  return (data ?? []).reduce((acc, d) => acc + Number(d.weight_pct ?? 0), 0)
}

/** Mensaje listo para mostrar si `pesoNuevo` no entra en el % disponible. */
export function mensajeSiExcedePeso(ocupado: number, pesoNuevo: number): string | null {
  const disponible = Math.max(0, 100 - ocupado)
  if (ocupado + pesoNuevo > 100) {
    return `Ya hay ${ocupado}% ocupado en Notas de este módulo. Deja como máximo ${disponible}%.`
  }
  return null
}
