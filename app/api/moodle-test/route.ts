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
 *
 * MOODLE_TOKEN ahora es un token contra el servicio móvil oficial de Moodle
 * ("moodle_mobile_app", el mismo que usa su app de celular) en vez del
 * servicio propio que armamos función por función -- trae ~400 funciones ya
 * conectadas de fábrica. Por eso este diagnóstico ya no solo confirma que
 * hay conexión: también jala un curso y una nota reales, de un estudiante de
 * prueba (`v-30000002`, cédula ficticia), para probar el catálogo completo
 * desde el entorno real, no solo con curl en la máquina de Marco.
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

    // Prueba adicional: jalar un curso y una nota reales del estudiante de
    // prueba, para confirmar que el catálogo completo del servicio móvil
    // responde igual que cuando lo probamos con curl.
    let prueba: {
      estudiante: string
      cursos: { id: number; nombre: string }[]
      notas: { actividad: string; nota: string }[]
    } | null = null

    try {
      const [usuario] = await moodleCall<{ id: number; fullname: string }[]>(
        'core_user_get_users_by_field',
        { field: 'username', 'values[0]': 'v-30000002' },
      )

      if (usuario) {
        const cursos = await moodleCall<{ id: number; fullname: string }[]>(
          'core_enrol_get_users_courses',
          { userid: String(usuario.id) },
        )

        const primerCurso = cursos[0]
        let notas: { actividad: string; nota: string }[] = []
        if (primerCurso) {
          const notasResp = await moodleCall<{
            usergrades: { gradeitems: { itemname: string | null; gradeformatted: string }[] }[]
          }>('gradereport_user_get_grade_items', {
            courseid: String(primerCurso.id),
            userid: String(usuario.id),
          })
          notas = (notasResp.usergrades[0]?.gradeitems ?? [])
            .filter((g) => g.itemname)
            .map((g) => ({ actividad: g.itemname as string, nota: g.gradeformatted }))
        }

        prueba = {
          estudiante: usuario.fullname,
          cursos: cursos.map((c) => ({ id: c.id, nombre: c.fullname })),
          notas,
        }
      }
    } catch {
      // Si esta parte falla (ej. no existe el estudiante de prueba en este
      // Moodle), no tumba el diagnóstico principal -- solo se omite.
    }

    return Response.json({
      conectado: true,
      sitio: info.sitename,
      version: info.release,
      url: info.siteurl,
      prueba,
    })
  } catch (err) {
    return Response.json({ conectado: false, error: (err as Error).message }, { status: 502 })
  }
}
