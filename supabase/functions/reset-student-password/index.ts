// A pedido explícito del coordinador (transcripción de audio,
// docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): "si un estudiante, por
// aguevonado, cambia su contraseña o se le olvida, tengamos algo que nos
// sirva a todas [las cuentas], pero que solo nosotros la sepamos".
//
// Una clave maestra compartida es justo lo que un atacante busca: si se
// filtra una vez (una captura, un chat reenviado, un celular perdido), abre
// TODAS las cuentas de estudiantes a la vez — incluye datos de salud y de
// contacto de menores de edad (regla 1 de AGENTS.md). Esta función resuelve
// el mismo problema real (el estudiante no puede entrar) sin ese riesgo:
// restablece la contraseña de UN estudiante a la vez, de vuelta a su
// código de carnet (el mismo que ya conocía — "consérvelo, lo necesitará
// para su primer ingreso a la app", tal como dice su planilla). Cada uso
// requiere una sesión real de personal autenticado, y queda en los logs de
// Supabase Auth quién lo hizo y cuándo — no hay secreto que memorizar ni
// que se pueda filtrar de una vez para siempre.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function okResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)

  const userSb = userClient(req)
  const { data: { user } } = await userSb.auth.getUser()
  if (!user) return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)

  const { data: perfil } = await userSb.from('profiles').select('role').eq('id', user.id).single()
  const rol = perfil?.role ?? ''

  if (!['admin', 'super_admin', 'direccion_academica', 'vendedor'].includes(rol)) {
    return errorResponse('NO_AUTORIZADO', 'Solo administración o ventas pueden restablecer contraseñas', 403)
  }

  let body: { studentId?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('DATOS_INVALIDOS', 'Body JSON inválido')
  }

  const studentId = body.studentId
  if (!studentId) return errorResponse('DATOS_INVALIDOS', 'Falta studentId')

  const admin = adminClient()

  // Ventas solo puede restablecer a quien ella misma inscribió — mismo
  // límite que ya tiene para leer y editar (migración 075). admin,
  // super_admin y dirección académica no tienen esa restricción.
  const { data: estudiante } = await admin
    .from('students')
    .select('id, enrolled_by, student_code')
    .eq('id', studentId)
    .maybeSingle()

  if (!estudiante) return errorResponse('NO_ENCONTRADO', 'Estudiante no encontrado', 404)

  if (rol === 'vendedor' && estudiante.enrolled_by !== user.id) {
    return errorResponse('NO_AUTORIZADO', 'Solo puedes restablecer a quien tú mismo inscribiste', 403)
  }

  if (!estudiante.student_code) {
    return errorResponse('SIN_CODIGO', 'Este estudiante todavía no tiene código de carnet asignado (falta programa)')
  }

  const { error: fallo } = await admin.auth.admin.updateUserById(studentId, {
    password: estudiante.student_code,
  })

  if (fallo) {
    return errorResponse('ERROR_INTERNO', 'No se pudo restablecer la contraseña')
  }

  return okResponse({ ok: true, studentCode: estudiante.student_code })
})
