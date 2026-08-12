// Borra una cuenta (estudiante o personal) por completo. Solo super_admin —
// es "control total", pero el borrado real de un usuario con historia
// (asistencia, auditoría, exámenes creados) es la acción menos reversible
// de toda la app, así que queda exclusiva del rol de más alto nivel.
//
// No se salta las protecciones de solo-inserción (attendance_events,
// audit_log): si la cuenta tiene ese historial, se devuelve un motivo claro
// en vez de borrar en silencio. Solo se limpian referencias "de agenda"
// (cohorte/sesiones asignadas a un profesor), que no son historial legal.

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

function motivoLegible(mensaje: string): string {
  if (mensaje.includes('attendance_events')) {
    return 'Tiene asistencia registrada. No se puede borrar sin perder ese historial de asistencia.'
  }
  if (mensaje.includes('audit_log')) {
    return 'Tiene acciones registradas en la auditoría del sistema. No se puede borrar sin perder ese historial.'
  }
  if (mensaje.includes('exams')) {
    return 'Creó exámenes que otros estudiantes pueden haber presentado. Hay que reasignar o borrar esos exámenes primero.'
  }
  return 'Tiene datos relacionados que impiden borrarlo directamente.'
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

  const { data: profile } = await userSb
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return errorResponse('NO_AUTORIZADO', 'Solo super_admin puede borrar cuentas', 403)
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

  // Limpieza de referencias de agenda (no es historial legal): si es
  // profesor, se le quita de las cohortes/sesiones que tuviera asignadas.
  if (objetivo.role === 'profesor') {
    await admin.from('cohorts').update({ teacher_id: null }).eq('teacher_id', profileId)
    await admin.from('class_sessions').update({ teacher_id: null }).eq('teacher_id', profileId)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId)

  if (deleteError) {
    return errorResponse(
      'BLOQUEADO',
      `No se pudo borrar a ${objetivo.full_name}. ${motivoLegible(deleteError.message)}`,
      409
    )
  }

  return okResponse({ success: true })
})
