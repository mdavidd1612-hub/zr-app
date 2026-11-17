import { createClient } from '@/lib/supabase/client'

/**
 * Llama a la Edge Function `asistente-examenes` (IA que SOLO sugiere al
 * profesor: nunca guarda notas ni cambia preguntas). Devuelve el resultado o un
 * mensaje listo para mostrar.
 */
export async function llamarAsistente<T>(cuerpo: Record<string, unknown>): Promise<{ datos: T | null; mensaje: string | null }> {
  const { data, error } = await createClient().functions.invoke('asistente-examenes', { body: cuerpo })
  if (!error) return { datos: data as T, mensaje: null }

  let codigo = ''
  let texto = ''
  try {
    const cuerpoError = await (error as unknown as { context: Response }).context.json()
    codigo = cuerpoError?.error?.code ?? ''
    texto = cuerpoError?.error?.message ?? ''
  } catch {
    // sin detalle: se usa el mensaje genérico
  }
  if (codigo === 'SIN_CONFIGURAR') return { datos: null, mensaje: 'El asistente de IA todavía no está activado en este entorno.' }
  if (codigo === 'DATOS_INVALIDOS' && texto) return { datos: null, mensaje: texto }
  return { datos: null, mensaje: 'La IA no respondió ahora mismo. Inténtalo de nuevo o continúa a mano.' }
}
