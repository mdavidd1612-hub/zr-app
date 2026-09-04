import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * generar-casos · Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, ajuste).
 *
 * Genera UN caso (no los 5 de golpe — eso tardaba demasiado y a veces la IA
 * no alcanzaba a responder completo) para un módulo y un día de la semana.
 * Se llama de dos formas:
 *  1. Automática, por el cron diario (fn_generar_caso_del_dia en Postgres):
 *     sábado genera el lunes, lunes genera el martes, y así — el profesor
 *     no tiene que tocar nada. Se identifica con el header
 *     `x-cron-secret` en vez de un token de usuario.
 *  2. Manual, por un profesor/admin autenticado (por si hace falta
 *     regenerar uno a mano).
 *
 * verify_jwt está en false porque el cron no tiene usuario — la
 * autenticación la hace este código: o el secreto del cron, o un JWT válido
 * de personal. Nunca se salta esa validación (regla 2 de AGENTS.md).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function okResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function userClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  )
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

const NOMBRE_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { moduleId, weekday } = await req.json()
    if (!moduleId || !weekday || weekday < 1 || weekday > 5) {
      return errorResponse('DATOS_INVALIDOS', 'Falta moduleId o weekday (1-5)')
    }

    // Autenticación: o es el cron (secreto compartido), o es personal con
    // sesión válida. Nunca se genera nada sin pasar por una de las dos.
    const cronSecret = req.headers.get('x-cron-secret')
    const esCron = Boolean(cronSecret) && cronSecret === Deno.env.get('CRON_SECRET')

    let generatedBy: string | null = null
    if (!esCron) {
      const user = userClient(req)
      const { data: { user: authUser }, error: authError } = await user.auth.getUser()
      if (authError || !authUser) return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)

      const { data: perfil } = await user.from('profiles').select('role').eq('id', authUser.id).single()
      if (!['profesor', 'admin', 'super_admin', 'direccion_academica'].includes(perfil?.role ?? '')) {
        return errorResponse('NO_AUTORIZADO', 'Solo personal puede generar casos', 403)
      }
      generatedBy = authUser.id
    }

    const admin = adminClient()
    const { data: modulo } = await admin.from('modules').select('name, description').eq('id', moduleId).single()
    if (!modulo) return errorResponse('MODULO_NO_ENCONTRADO', 'El módulo no existe')

    const apiKey = Deno.env.get('NVIDIA_API_KEY')
    if (!apiKey) return errorResponse('SIN_CONFIGURAR', 'Falta la clave de NVIDIA en el servidor', 500)

    const prompt = `Eres un instructor de mecánica automotriz. Genera UN caso corto de diagnóstico para estudiantes de 15 a 25 años, para el ${NOMBRE_DIA[weekday]}, relacionado con el módulo "${modulo.name}"${modulo.description ? ` (${modulo.description})` : ''}.

Reglas estrictas:
- Conceptual, sin cifras ni medidas exactas.
- El caso: un escenario breve (2-4 líneas), 2 preguntas de opción múltiple con 4 opciones cada una (la primera opción SIEMPRE es la correcta, luego reordena los índices), una pregunta de reflexión de respuesta libre, y una referencia con: qué es la respuesta correcta y por qué, por qué las otras 3 opciones de cada pregunta NO son correctas (agrupado, 3 líneas), y una idea final de una línea.
- Español de Venezuela, tono cercano, sin tecnicismos innecesarios.

Responde SOLO con un objeto JSON con esta forma exacta, sin explicación adicional:
{"titulo": "...", "escenario": "...", "preguntas": [{"pregunta": "...", "opciones": ["...","...","...","..."], "correcta": 0}, {"pregunta": "...", "opciones": ["...","...","...","..."], "correcta": 0}], "reflexion": "...", "referencia": {"que": "...", "porQueNo": ["...","...","..."], "quedaClaro": "..."}}`

    // La IA (capa gratuita de NVIDIA) a veces responde con un HTTP no-ok, o
    // con un texto que no es JSON válido — no es raro, pasaba antes también,
    // solo que el profesor lo tapaba con su botón de "reintentar a mano".
    // Ahora que nadie toca esto (a pedido explícito), el reintento tiene que
    // vivir aquí: hasta 2 intentos antes de rendirse, para que un tropiezo
    // puntual de la IA no deje un día entero sin caso hasta el sábado
    // siguiente.
    let caso: Record<string, unknown> | null = null
    let ultimoError: { code: string; message: string } | null = null

    for (let intento = 1; intento <= 2 && !caso; intento++) {
      const respuesta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta/llama-3.2-11b-vision-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 700,
        }),
      })

      if (!respuesta.ok) {
        const detalle = await respuesta.text()
        console.error(`generar-casos: intento ${intento}, NVIDIA respondió`, respuesta.status, detalle)
        ultimoError = { code: 'IA_NO_DISPONIBLE', message: 'No se pudo generar el caso ahora mismo' }
        continue
      }

      const cuerpo = await respuesta.json()
      const texto = cuerpo.choices?.[0]?.message?.content ?? '{}'

      try {
        const match = texto.match(/\{[\s\S]*\}/)
        caso = JSON.parse(match ? match[0] : texto)
      } catch {
        console.error(`generar-casos: intento ${intento}, no se pudo parsear la respuesta de la IA`, texto)
        ultimoError = { code: 'IA_RESPUESTA_INVALIDA', message: 'La IA no devolvió un formato válido' }
      }
    }

    if (!caso) {
      return errorResponse(ultimoError?.code ?? 'IA_NO_DISPONIBLE', ultimoError?.message ?? 'No se pudo generar el caso ahora mismo', 502)
    }

    const { error: guardarError } = await admin.from('ai_cases').upsert({
      module_id: moduleId,
      weekday,
      titulo: (caso.titulo as string) ?? `Caso del ${NOMBRE_DIA[weekday]}`,
      escenario: (caso.escenario as string) ?? '',
      preguntas: caso.preguntas ?? [],
      reflexion: (caso.reflexion as string) ?? '',
      referencia: caso.referencia ?? {},
      generated_by: generatedBy,
    }, { onConflict: 'module_id,weekday' })

    if (guardarError) {
      console.error('generar-casos: fallo al guardar', guardarError.message)
      return errorResponse('ERROR_GUARDANDO', 'El caso se generó pero no se pudo guardar', 500)
    }

    return okResponse({ ok: true })
  } catch (error) {
    console.error('generar-casos error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
