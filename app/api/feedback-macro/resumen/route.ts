import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Resumen con IA del feedback de módulo (pedido explícito del coordinador,
 * sept. 2026) — el único texto libre que puede identificar a alguien nunca
 * sale de este endpoint en crudo: entra a resumirlo y solo sale el resumen.
 * Nunca se calcula en el navegador (regla 2 de AGENTS.md).
 *
 * Autorización: se verifica con la sesión normal del usuario (Dirección
 * Académica/super_admin, o el profesor asignado a ESE módulo puntual vía
 * `teacher_module_assignments`) — el mismo criterio que ya protege
 * `v_feedback_macro_summary` (migración 097), pero repetido aquí a mano
 * porque el texto libre se lee con la clave de servicio (nunca se le dio
 * RLS de lectura a nadie sobre `feedback_macro.open_text`, ni siquiera al
 * profesor — solo lo ve resumido).
 */
export async function POST(req: Request) {
  const { cohortId, moduleId } = (await req.json()) as { cohortId?: string; moduleId?: string }
  if (!cohortId || !moduleId) {
    return Response.json({ error: 'Falta la cohorte o el módulo.' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const esAcademico = perfil?.role === 'direccion_academica' || perfil?.role === 'super_admin'

  let autorizado = esAcademico
  if (!autorizado) {
    const { data: asignacion } = await supabase
      .from('teacher_module_assignments')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('module_id', moduleId)
      .maybeSingle()
    autorizado = Boolean(asignacion)
  }
  if (!autorizado) {
    return Response.json({ error: 'No tienes acceso al feedback de este módulo.' }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'El resumen con IA todavía no está configurado (falta ANTHROPIC_API_KEY). Avísale al coordinador.' },
      { status: 501 },
    )
  }

  // Clave de servicio SOLO aquí, del lado del servidor (regla 4 de
  // AGENTS.md) -- ya se verificó a mano el permiso arriba, así que puede
  // saltarse RLS para leer el texto libre crudo.
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: estudiantesCohorte } = await admin.from('students').select('id').eq('cohort_id', cohortId)
  const idsEstudiantes = (estudiantesCohorte ?? []).map((s) => s.id)

  const { data: respuestas } = idsEstudiantes.length
    ? await admin
        .from('feedback_macro')
        .select('open_text')
        .eq('module_id', moduleId)
        .in('student_id', idsEstudiantes)
        .not('open_text', 'is', null)
    : { data: [] }

  const textos = (respuestas ?? [])
    .map((r) => r.open_text?.trim())
    .filter((t): t is string => Boolean(t))

  // Mismo umbral que el resumen numérico (v_feedback_macro_summary,
  // system_config 'feedback.min_responses_to_show') -- menos comentarios
  // que eso y alguien podría reconocer su propia frase.
  const minimo = 3
  if (textos.length < minimo) {
    return Response.json(
      { error: `Hacen falta al menos ${minimo} comentarios de texto libre para generar un resumen.` },
      { status: 400 },
    )
  }

  let respuestaIA: Response
  try {
    respuestaIA = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content:
            'Estos son comentarios anónimos de estudiantes de una academia técnica (mecánica ' +
            'automotriz), sobre un módulo que acaban de terminar. Resume en español de ' +
            'Venezuela, en 4 a 6 líneas, lo que más se repitió -- tanto positivo como negativo. ' +
            'No inventes nada que no esté en los comentarios, y no cites ninguna frase textual ' +
            'completa que pudiera dejar identificable a quien la escribió.\n\n' +
            textos.map((t, i) => `${i + 1}. ${t}`).join('\n'),
        }],
      }),
    })
  } catch {
    return Response.json({ error: 'No se pudo conectar con el servicio de IA. Intenta de nuevo.' }, { status: 502 })
  }

  if (!respuestaIA.ok) {
    return Response.json({ error: 'No se pudo generar el resumen. Intenta de nuevo.' }, { status: 502 })
  }

  const json = (await respuestaIA.json()) as { content?: { type: string; text?: string }[] }
  const resumen = json.content?.find((c) => c.type === 'text')?.text ?? ''

  return Response.json({ resumen, cantidadComentarios: textos.length })
}
