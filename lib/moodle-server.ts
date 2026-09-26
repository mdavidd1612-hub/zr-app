import 'server-only'

/**
 * Cliente de Moodle -- SOLO servidor (regla 4 de AGENTS.md: el token nunca
 * puede llegar al navegador, igual que la clave de servicio de Supabase).
 *
 * Etapa actual: conexión de prueba contra un Moodle temporal (un túnel sobre
 * la instancia local, mientras se decide dónde vive Moodle de verdad) --
 * MOODLE_URL va a cambiar cuando eso se resuelva. Nada de esto todavía
 * calcula notas ni aprobaciones (regla 2): solo lee y muestra lo que Moodle
 * ya calculó.
 */

interface MoodleError {
  exception?: string
  errorcode?: string
  message?: string
}

export async function moodleCall<T>(wsfunction: string, params: Record<string, string> = {}): Promise<T> {
  const url = process.env.MOODLE_URL
  const token = process.env.MOODLE_TOKEN
  if (!url || !token) {
    throw new Error('Moodle no está configurado (falta MOODLE_URL o MOODLE_TOKEN).')
  }

  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: 'json',
    ...params,
  })

  const res = await fetch(`${url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Moodle respondió ${res.status}.`)
  }

  const json = (await res.json()) as T | MoodleError
  if (json && typeof json === 'object' && 'exception' in json) {
    throw new Error((json as MoodleError).message ?? 'Error desconocido de Moodle.')
  }

  return json as T
}
