// Borra una cuenta (estudiante o personal) por completo.
//
// Jerarquía de permisos:
//   admin           → puede borrar estudiantes
//   direccion_academica → puede borrar estudiantes, profesores y admins
//   super_admin     → puede borrar cualquier rol excepto el suyo propio
//
// La asistencia y los intentos de examen se eliminan en cascade desde la BD
// (migration 028 habilitó el cascade en attendance_events).
// Los exámenes creados por el profesor se dejan con teacher_id = NULL.

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
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Qué roles puede borrar cada rol
const PUEDE_BORRAR: Record<string, string[]> = {
  admin:               ['estudiante'],
  direccion_academica: ['estudiante', 'profesor', 'admin'],
  super_admin:         ['estudiante', 'profesor', 'admin', 'direccion_academica', 'super_admin'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)
  }

  const userSb = userClient(req)

  const { data: userData, error: userError } = await userSb.auth.getUser()
  if (userError || !userData.user) {
    return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)
  }

  const { data: miPerfil } = await userSb
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  const miRol = miPerfil?.role ?? ''
  if (!PUEDE_BORRAR[miRol]) {
    return errorResponse('NO_AUTORIZADO', 'No tienes permiso para borrar cuentas', 403)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Body JSON inválido', 400)
  }

  const { profileId } = payload
  if (!profileId) {
    return errorResponse('MISSING_FIELDS', 'Falta profileId', 400)
  }

  if (profileId === userData.user.id) {
    return errorResponse('NO_PERMITIDO', 'No puedes borrar tu propia cuenta', 400)
  }

  const admin = adminClient()

  const { data: objetivo } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', profileId)
    .single()

  if (!objetivo) {
    return errorResponse('NOT_FOUND', 'Cuenta no encontrada', 404)
  }

  // Verificar que el rol que intenta borrar tiene permiso sobre el rol objetivo
  if (!PUEDE_BORRAR[miRol].includes(objetivo.role)) {
    return errorResponse(
      'NO_AUTORIZADO',
      `Tu rol (${miRol}) no puede borrar cuentas de tipo ${objetivo.role}`,
      403
    )
  }

  // Limpieza de referencias de agenda (no historial legal)
  if (objetivo.role === 'profesor') {
    await admin.from('cohorts').update({ teacher_id: null }).eq('teacher_id', profileId)
    await admin.from('class_sessions').update({ teacher_id: null }).eq('teacher_id', profileId)
    // Los exámenes quedan con teacher_id = NULL (migration 028 habilitó el SET NULL)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId)

  if (deleteError) {
    console.error('deleteUser error:', deleteError.message)
    return errorResponse(
      'BLOQUEADO',
      `No se pudo borrar la cuenta de ${objetivo.full_name}: ${deleteError.message}`,
      409
    )
  }

  return okResponse({ success: true })
})
