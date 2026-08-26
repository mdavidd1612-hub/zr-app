import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * generar-casos · Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint D).
 *
 * Genera los 5 casos de la semana (lunes a viernes, sin sábado — ese día es
 * clase, no caso) para un módulo, con NVIDIA NIM. Cada caso: escenario,
 * 2 preguntas de opción múltiple, una reflexión de respuesta libre, y una
 * referencia (qué es, por qué no las otras, qué queda claro) — mismo
 * formato que el banco fijo de lib/casos-fase0.ts en el estudiante.
 * Solo personal puede pedirlo, y la clave nunca sale del servidor.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { moduleId } = await req.json()
    if (!moduleId) return errorResponse('FALTA_MODULO', 'Falta el id del módulo')

    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }
    const { data: perfil } = await user.from('profiles').select('role').eq('id', authUser.id).single()
    if (!['profesor', 'admin', 'super_admin', 'direccion_academica'].includes(perfil?.role ?? '')) {
      return errorResponse('NO_AUTORIZADO', 'Solo personal puede generar casos', 403)
    }

    const admin = adminClient()
    const { data: modulo } = await admin.from('modules').select('name, description').eq('id', moduleId).single()
    if (!modulo) return errorResponse('MODULO_NO_ENCONTRADO', 'El módulo no existe')

    const apiKey = Deno.env.get('NVIDIA_API_KEY')
    if (!apiKey) return errorResponse('SIN_CONFIGURAR', 'Falta la clave de NVIDIA en el servidor', 500)

    const prompt = `Eres un instructor de mecánica automotriz. Genera 5 casos cortos de diagnóstico para estudiantes de 15 a 25 años, uno para cada día de la semana (lunes a viernes), relacionados con el módulo "${modulo.name}"${modulo.description ? ` (${modulo.description})` : ''}.

Reglas estrictas:
- Conceptuales, sin cifras ni medidas exactas (ver AGENTS.md del proyecto: nada de números de negocio inventados).
- Cada caso: un escenario breve (2-4 líneas), 2 preguntas de opción múltiple con 4 opciones cada una (la primera opción SIEMPRE es la correcta, luego reordena los índices), una pregunta de reflexión de respuesta libre, y una referencia con: qué es la respuesta correcta y por qué, por qué las otras 3 opciones de cada pregunta NO son correctas (agrupado, 3 líneas), y una idea final de una línea.
- Español de Venezuela, tono cercano, sin tecnicismos innecesarios.

Responde SOLO con un array JSON de exactamente 5 objetos, uno por día lunes a viernes en ese orden, con esta forma exacta:
{"titulo": "...", "escenario": "...", "preguntas": [{"pregunta": "...", "opciones": ["...","...","...","..."], "correcta": 0}, {"pregunta": "...", "opciones": ["...","...","...","..."], "correcta": 0}], "reflexion": "...", "referencia": {"que": "...", "porQueNo": ["...","...","..."], "quedaClaro": "..."}}`

    const respuesta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    })

    if (!respuesta.ok) {
      const detalle = await respuesta.text()
      console.error('generar-casos: NVIDIA respondió', respuesta.status, detalle)
      return errorResponse('IA_NO_DISPONIBLE', 'No se pudo generar los casos ahora mismo', 502)
    }

    const cuerpo = await respuesta.json()
    const texto = cuerpo.choices?.[0]?.message?.content ?? '[]'

    let casos: unknown[] = []
    try {
      const match = texto.match(/\[[\s\S]*\]/)
      casos = JSON.parse(match ? match[0] : texto)
    } catch {
      console.error('generar-casos: no se pudo parsear la respuesta de la IA', texto)
      return errorResponse('IA_RESPUESTA_INVALIDA', 'La IA no devolvió un formato válido', 502)
    }

    if (!Array.isArray(casos) || casos.length !== 5) {
      return errorResponse('IA_RESPUESTA_INVALIDA', 'La IA no devolvió los 5 casos esperados', 502)
    }

    const filas = casos.map((c, i) => ({
      module_id: moduleId,
      weekday: i + 1,
      titulo: (c as { titulo?: string }).titulo ?? `Caso del ${NOMBRE_DIA[i + 1]}`,
      escenario: (c as { escenario?: string }).escenario ?? '',
      preguntas: (c as { preguntas?: unknown }).preguntas ?? [],
      reflexion: (c as { reflexion?: string }).reflexion ?? '',
      referencia: (c as { referencia?: unknown }).referencia ?? {},
      generated_by: authUser.id,
    }))

    const { error: guardarError } = await admin
      .from('ai_cases')
      .upsert(filas, { onConflict: 'module_id,weekday' })

    if (guardarError) {
      console.error('generar-casos: fallo al guardar', guardarError.message)
      return errorResponse('ERROR_GUARDANDO', 'Los casos se generaron pero no se pudieron guardar', 500)
    }

    return okResponse({ ok: true, casos: filas.length })
  } catch (error) {
    console.error('generar-casos error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
