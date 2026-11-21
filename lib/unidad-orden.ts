import type { createClient } from '@/lib/supabase/client'

type Cliente = ReturnType<typeof createClient>

// Con huecos en order_index (tras quitar un ítem), contar filas + 1 choca con
// UNIQUE (unit_id, order_index). Siempre se parte del máximo real.
export async function siguienteOrdenUnidad(supabase: Cliente, unitId: string): Promise<number> {
  const { data } = await supabase
    .from('unit_items')
    .select('order_index')
    .eq('unit_id', unitId)
    .order('order_index', { ascending: false })
    .limit(1)
  return (data?.[0]?.order_index ?? 0) + 1
}
