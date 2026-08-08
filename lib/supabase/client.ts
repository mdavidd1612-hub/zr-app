import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

const TIMEOUT_MS = 15_000

/**
 * Una conexión TCP que quedó "muerta" (la laptop durmió, el wifi cambió de
 * red, el router se reinició) no siempre avisa: el navegador puede quedarse
 * esperando una respuesta que nunca llega, sin error y sin límite de
 * tiempo. Sin este timeout, cualquier pantalla que dependiera de esa
 * petición se quedaba en "Cargando…" para siempre — la única salida era
 * abrir una pestaña nueva, que sí arranca una conexión fresca.
 *
 * Con esto, toda petición del cliente de Supabase (auth, tablas, Edge
 * Functions) falla como muy tarde a los 15s con un error real que la
 * pantalla ya sabe mostrar, en vez de colgarse en silencio.
 */
function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controlador = new AbortController()
  const aviso = setTimeout(() => controlador.abort(), TIMEOUT_MS)

  return fetch(input, { ...init, signal: init?.signal ?? controlador.signal })
    .finally(() => clearTimeout(aviso))
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchConTimeout } },
  )
}
