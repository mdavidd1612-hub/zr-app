// Aprueba o rechaza una solicitud de acceso como profesor.
// Solo direccion_academica o super_admin pueden llamarla (regla #9 de
// AGENTS.md: el rol nunca lo decide el cliente — el cambio de rol vive aquí,
// en el servidor, con service_role).

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

  if (!['direccion_academica', 'super_admin'].includes(profile?.role ?? '')) {
    return errorResponse('NO_AUTORIZADO', 'Solo Dirección Académica o super_admin', 403)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Body JSON inválido', 400)
  }

  const { applicationId, decision, cohortId } = payload

  if (!applicationId || !['aprobado', 'rechazado'].includes(decision)) {
    return errorResponse('MISSING_FIELDS', 'Faltan campos requeridos', 400)
  }

  const admin = adminClient()

  const { data: solicitud, error: solicitudError } = await admin
    .from('professor_applications')
    .select('id, profile_id, status')
    .eq('id', applicationId)
    .single()

  if (solicitudError || !solicitud) {
    return errorResponse('NOT_FOUND', 'Solicitud no encontrada', 404)
  }

  if (solicitud.status !== 'pendiente') {
    return errorResponse('ALREADY_REVIEWED', 'Esta solicitud ya fue revisada', 400)
  }

  if (decision === 'rechazado') {
    const { error } = await admin
      .from('professor_applications')
      .update({ status: 'rechazado', reviewed_by: userData.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) return errorResponse('UPDATE_ERROR', 'No se pudo rechazar la solicitud', 400)
    return okResponse({ success: true, status: 'rechazado' })
  }

  // Aprobado: el rol pasa a profesor, se crea su fila en teachers, y si se
  // eligió cohorte se le asigna de una vez.
  const { error: roleError } = await admin
    .from('profiles')
    .update({ role: 'profesor' })
    .eq('id', solicitud.profile_id)

  if (roleError) {
    return errorResponse('UPDATE_ERROR', 'No se pudo asignar el rol de profesor', 400)
  }

  const { error: teacherError } = await admin
    .from('teachers')
    .insert({ id: solicitud.profile_id, is_active: true })

  if (teacherError) {
    // Rollback del rol para no dejar un estudiante con rol profesor sin fila de soporte.
    await admin.from('profiles').update({ role: 'estudiante' }).eq('id', solicitud.profile_id)
    return errorResponse('TEACHER_ERROR', 'No se pudo crear el registro de profesor', 400)
  }

  if (cohortId) {
    const { error: cohortError } = await admin
      .from('cohorts')
      .update({ teacher_id: solicitud.profile_id })
      .eq('id', cohortId)

    // No revertimos el rol por esto: el profesor queda aprobado igual,
    // la cohorte se puede asignar después a mano desde /personal.
    if (cohortError) {
      console.error('approve-professor: fallo al asignar cohorte', cohortError.message)
    }
  }

  const { error: updateAppError } = await admin
    .from('professor_applications')
    .update({
      status: 'aprobado',
      cohort_id: cohortId ?? null,
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  if (updateAppError) {
    return errorResponse('UPDATE_ERROR', 'Profesor aprobado, pero no se pudo cerrar la solicitud', 400)
  }

  return okResponse({ success: true, status: 'aprobado' })
})
