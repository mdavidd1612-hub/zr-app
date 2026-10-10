import { createClient } from '@/lib/supabase/client'
import { comprimirSiPesa, type ResultadoCompresion } from '@/lib/comprimir'

/**
 * Prepara un archivo para subirlo: si pasa del límite de "archivo pesado"
 * (system_config → content.aviso_pesado_mb, nunca escrito en el código) se
 * intenta comprimir automáticamente (lib/comprimir.ts). Además se LEE el
 * archivo completo a memoria antes de subirlo: un archivo que vive en una
 * carpeta sincronizada (OneDrive, Google Drive) y se lee "a pedido" mientras
 * el navegador lo sube puede cortar la subida a mitad.
 */
export async function prepararArchivo(archivo: File): Promise<ResultadoCompresion> {
  const { data } = await createClient()
    .from('system_config').select('value').eq('key', 'content.aviso_pesado_mb').maybeSingle()
  const limiteMB = Number(data?.value)
  const r = await comprimirSiPesa(archivo, Number.isFinite(limiteMB) && limiteMB > 0 ? limiteMB * 1024 * 1024 : 0)

  const MAX_EN_MEMORIA = 150 * 1024 * 1024
  if (r.archivo.size <= MAX_EN_MEMORIA) {
    try {
      const bytes = await r.archivo.arrayBuffer()
      return { ...r, archivo: new File([bytes], r.archivo.name, { type: r.archivo.type, lastModified: r.archivo.lastModified }) }
    } catch {
      // Si no se puede leer, la subida mostrará el error real.
    }
  }
  return r
}

/**
 * Sube al bucket 'contenido' con reintentos: una subida larga puede cortarse
 * por un tropiezo de la red ("signal is aborted without reason", "Failed to
 * fetch"). La ruta lleva un UUID propio, así que reintentar sobre ella es
 * seguro (upsert).
 */
export async function subirAlBucket(
  ruta: string,
  archivo: File,
  intentos = 3,
): Promise<{ error: { message: string } | null }> {
  let ultimo: { message: string } | null = null
  for (let i = 1; i <= intentos; i++) {
    const { error } = await createClient().storage
      .from('contenido')
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: true })
    if (!error) return { error: null }
    ultimo = error
    if (!/abort|network|fetch|failed|timeout|load/i.test(error.message)) break
    await new Promise((r) => setTimeout(r, 1500 * i))
  }
  return { error: ultimo }
}
