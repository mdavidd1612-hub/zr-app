import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * resumir-dudas · Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint C).
 *
 * Agrupa las dudas de los estudiantes en 3 preguntas generales, con
 * NVIDIA NIM (ya hay una NVIDIA_API_KEY configurada para este proyecto).
 * Solo recibe los TEXTOS de las dudas — nunca nombres ni cédulas
 * (metodología/01_MODELO.md §5.1). Server-side siempre: la clave nunca
 * viaja al navegador (regla 4 de AGENTS.md).
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = userClient(req)
    const { data: { user: authUser }, error: authError } = await user.auth.getUser()
    if (authError || !authUser) {
      return errorResponse('NO_AUTORIZADO', 'Token inválido', 403)
    }

    const { data: perfil } = await user.from('profiles').select('role').eq('id', authUser.id).single()
    if (!['profesor', 'admin', 'super_admin', 'direccion_academica'].includes(perfil?.role ?? '')) {
      return errorResponse('NO_AUTORIZADO', 'Solo personal puede pedir este resumen', 403)
    }

    const admin = adminClient()
    const { data: dudas } = await admin
      .from('doubts')
      .select('body')
      .order('created_at', { ascending: false })
      .limit(60)

    const textos = (dudas ?? []).map((d) => d.body)

    if (textos.length < 3) {
      return okResponse({ ok: true, digest: [], mensaje: 'Todavía no hay suficientes dudas para resumir.' })
    }

    const apiKey = Deno.env.get('NVIDIA_API_KEY')
    if (!apiKey) {
      return errorResponse('SIN_CONFIGURAR', 'Falta la clave de NVIDIA en el servidor', 500)
    }

    const prompt = `Estas son dudas que estudiantes de mecánica automotriz escribieron sobre su clase:\n\n${
      textos.map((t, i) => `${i + 1}. ${t}`).join('\n')
    }\n\nAgrúpalas en exactamente 3 preguntas generales que cubran la mayoría de estas dudas. Responde SOLO con un array JSON de 3 strings en español, sin explicación adicional. Ejemplo: ["¿Pregunta 1?", "¿Pregunta 2?", "¿Pregunta 3?"]`

    const respuesta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    })

    if (!respuesta.ok) {
      const detalle = await respuesta.text()
      console.error('resumir-dudas: NVIDIA respondió', respuesta.status, detalle)
      return errorResponse('IA_NO_DISPONIBLE', 'No se pudo generar el resumen ahora mismo', 502)
    }

    const cuerpo = await respuesta.json()
    const texto = cuerpo.choices?.[0]?.message?.content ?? '[]'

    let digest: string[] = []
    try {
      const match = texto.match(/\[[\s\S]*\]/)
      digest = JSON.parse(match ? match[0] : texto)
    } catch {
      digest = []
    }

    return okResponse({ ok: true, digest: digest.slice(0, 3) })
  } catch (error) {
    console.error('resumir-dudas error:', error)
    return errorResponse('ERROR_INTERNO', error instanceof Error ? error.message : 'Error desconocido', 500)
  }
})
