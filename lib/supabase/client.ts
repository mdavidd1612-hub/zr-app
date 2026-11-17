import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

const TIMEOUT_MS = 15_000
// Subir o reemplazar un archivo del bucket es una transferencia larga a propósito:
// un PDF de 38 MB tarda más de 15 s con una conexión normal. Con el tope general
// esas subidas se cortaban con "signal is aborted without reason".
const TIMEOUT_TRANSFERENCIA_MS = 15 * 60_000

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
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const metodo = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  const esSubidaDeArchivo = url.includes('/storage/v1/object/') && (metodo === 'POST' || metodo === 'PUT')

  const controlador = new AbortController()
  const aviso = setTimeout(() => controlador.abort(), esSubidaDeArchivo ? TIMEOUT_TRANSFERENCIA_MS : TIMEOUT_MS)

  return fetch(input, { ...init, signal: init?.signal ?? controlador.signal })
    .finally(() => clearTimeout(aviso))
}

/**
 * RENDIMIENTO (16-nov-2026): `auth.getUser()` hace una peticion de red al
 * servidor de autenticacion CADA vez que se llama, y las pantallas lo llaman
 * varias veces por carga (115 llamadas en el codigo; el layout del estudiante
 * solo ya hace 5 seguidas). En el navegador alcanza con leer la sesion local:
 * quien manda de verdad es la base (RLS) y el servidor (proxy.ts verifica la
 * sesion en cada navegacion), no esta lectura. Se redefine getUser para que
 * use la sesion local -- sin tocar ninguno de los 115 sitios.
 */
let instancia: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (instancia) return instancia
  const cliente = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchConTimeout } },
  )
  const getUserRemoto = cliente.auth.getUser.bind(cliente.auth)
  cliente.auth.getUser = (async (jwt?: string) => {
    if (jwt) return getUserRemoto(jwt)
    const { data: { session } } = await cliente.auth.getSession()
    return { data: { user: session?.user ?? null }, error: null }
  }) as typeof cliente.auth.getUser
  if (typeof window !== 'undefined') instancia = cliente
  return cliente
}
