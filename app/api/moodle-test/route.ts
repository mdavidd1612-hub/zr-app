import { createClient as createServerClient } from '@/lib/supabase/server'
import { moodleCall } from '@/lib/moodle-server'

/**
 * Diagnóstico de la conexión con Moodle -- pedido explícito del coordinador
 * (sept. 2026), para confirmar en zr-staging (no solo en la máquina de
 * Marco) que el servidor sí puede hablar con Moodle antes de construir
 * cualquier pantalla real encima. Exclusivo de super_admin: no expone nada
 * a un estudiante ni a un profesor, y nunca revela el token.
 *
 * MOODLE_URL hoy apunta a un túnel temporal sobre el Moodle local -- se va
 * a caer si Marco apaga su máquina. Eso es normal en esta etapa: todavía no
 * se ha decidido dónde vive Moodle de verdad.
 */
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'super_admin') {
    return Response.json({ error: 'Solo super_admin puede ver esto.' }, { status: 403 })
  }

  try {
    const info = await moodleCall<{ sitename: string; release: string; siteurl: string }>(
      'core_webservice_get_site_info',
    )
    return Response.json({
      conectado: true,
      sitio: info.sitename,
      version: info.release,
      url: info.siteurl,
    })
  } catch (err) {
    return Response.json({ conectado: false, error: (err as Error).message }, { status: 502 })
  }
}
