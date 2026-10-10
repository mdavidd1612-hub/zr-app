import { createClient } from '@/lib/supabase/client'
import { comprimirSiPesa, type ResultadoCompresion } from '@/lib/comprimir'

/**
 * Prepara un archivo para subirlo: si pasa del límite de "archivo pesado"
 * (system_config → content.aviso_pesado_mb, nunca escrito en el código) se
 * intenta comprimir automáticamente. Ver lib/comprimir.ts.
 */
export async function prepararArchivo(archivo: File): Promise<ResultadoCompresion> {
  const { data } = await createClient()
    .from('system_config').select('value').eq('key', 'content.aviso_pesado_mb').maybeSingle()
  const limiteMB = Number(data?.value)
  return comprimirSiPesa(archivo, Number.isFinite(limiteMB) && limiteMB > 0 ? limiteMB * 1024 * 1024 : 0)
}
