import { createClient as createServerClient } from '@/lib/supabase/server'

// ZR Coffee (pedido explícito del coordinador, sept. 2026): la tasa del día
// se trae de Al Cambio (alcambio.app) en vez de escribirla a mano cada vez.
// Su web es una SPA que consulta su propio backend GraphQL público
// (api.alcambio.app/graphql, sin autenticación -- el mismo que usa
// cualquier visitante de su página) para pedir la tasa oficial BCV de
// Venezuela. Se llama desde el servidor de ZR App, no desde el navegador,
// para no depender de que ese dominio permita CORS y para tener un solo
// lugar si su API cambia de forma.
const ALCAMBIO_GRAPHQL = 'https://api.alcambio.app/graphql'

const QUERY = `query TasaVE($countryCode: String!) {
  getCountryConversions(payload: { countryCode: $countryCode }) {
    dateBcv
    conversionRates {
      baseValue
      official
      type
      rateCurrency { code }
    }
  }
}`

interface RespuestaAlCambio {
  data?: {
    getCountryConversions?: {
      dateBcv: number | null
      conversionRates: {
        baseValue: number
        official: boolean
        type: string
        rateCurrency: { code: string }
      }[]
    }
  }
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  // Misma comprobación que hace la pantalla del lado del cliente: RLS de
  // `zr_coffee_managers` (migración 090) ya solo deja ver la propia fila a
  // quien esté en la lista de gestores, así que a un no-gestor esta consulta
  // le devuelve vacío en vez de la fila.
  const { data: gestor } = await supabase
    .from('zr_coffee_managers').select('profile_id').eq('profile_id', user.id).maybeSingle()
  if (!gestor) {
    return Response.json({ error: 'No tienes acceso a ZR Coffee.' }, { status: 403 })
  }

  let json: RespuestaAlCambio
  try {
    const res = await fetch(ALCAMBIO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { countryCode: 'VE' } }),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`alcambio.app respondió ${res.status}`)
    json = await res.json()
  } catch {
    return Response.json({ error: 'No se pudo conectar con Al Cambio. Intenta de nuevo o regístrala a mano.' }, { status: 502 })
  }

  // La tasa oficial BCV dólar/bolívar es la fila SECONDARY+official=true de
  // USD -- es el mismo campo que usa la propia página de Al Cambio para
  // mostrar "Dólar BCV" (confirmado comparando contra su web el 11/09/2026).
  const fila = json.data?.getCountryConversions?.conversionRates.find(
    (r) => r.type === 'SECONDARY' && r.official && r.rateCurrency.code === 'USD',
  )
  if (!fila || !(fila.baseValue > 0)) {
    return Response.json({ error: 'Al Cambio no devolvió una tasa válida.' }, { status: 502 })
  }

  return Response.json({ tasa: fila.baseValue })
}
