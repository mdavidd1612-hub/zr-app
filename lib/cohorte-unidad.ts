import type { createClient } from '@/lib/supabase/client'

type Cliente = ReturnType<typeof createClient>

// El material y los exámenes son por cohorte. Desde la migración 241 la unidad también
// tiene su corte: si lo tiene, todo lo que se crea dentro va a ese corte. Si la unidad
// es general (sin corte, las de antes), la cohorte sale de las asignaciones reales de
// quien lo crea para ESE módulo; si hay varias, gana la que eligió en el selector.
export async function cohorteParaModulo(
  supabase: Cliente,
  moduleId: string,
  corteDeLaUnidad?: string | null,
): Promise<string | null> {
  if (corteDeLaUnidad) return corteDeLaUnidad
  const { data } = await supabase.rpc('mis_asignaciones_docente')
  const cohortes = (data ?? [])
    .filter((a: { module_id: string }) => a.module_id === moduleId)
    .map((a: { cohort_id: string }) => a.cohort_id)
  if (cohortes.length === 0) return null
  let elegida: string | null = null
  try { elegida = window.sessionStorage.getItem('zr_ctx_cohort') } catch { /* sessionStorage bloqueado */ }
  return elegida && cohortes.includes(elegida) ? elegida : cohortes[0]
}
