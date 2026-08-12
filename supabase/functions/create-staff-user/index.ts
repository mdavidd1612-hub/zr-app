// T-112: Create Staff User · Edge Function
// Solo un super_admin puede crear otros usuarios de personal (profesor, admin, super_admin)

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

  // 1. Verificar que quien llama es super_admin
  const { data: userData, error: userError } = await userSb.auth.getUser()
  if (userError || !userData.user) {
    return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)
  }

  const { data: profile } = await userSb
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  // Gestionar personal (crear profesores, admins, etc.) es trabajo de
  // Dirección Académica y super_admin — un admin normal ya no da de alta
  // profesores, eso pasó a ser académico, no administrativo.
  if (!['direccion_academica', 'super_admin'].includes(profile?.role ?? '')) {
    return errorResponse('NO_AUTORIZADO', 'Solo Dirección Académica o super_admin', 403)
  }

  // 2. Parsear el body
  let payload
  try {
    payload = await req.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Body JSON inválido', 400)
  }

  const { cedula, fullName, email, password, role } = payload

  if (!cedula || !fullName || !email || !password || !role) {
    return errorResponse('MISSING_FIELDS', 'Faltan campos requeridos', 400)
  }

  if (!['profesor', 'admin', 'super_admin', 'direccion_academica'].includes(role)) {
    return errorResponse('INVALID_ROLE', 'Rol inválido', 400)
  }

  // Solo un super_admin puede crear otro admin, super_admin o dirección
  // académica — son los tres roles de control administrativo/académico.
  if (['admin', 'super_admin', 'direccion_academica'].includes(role) && profile?.role !== 'super_admin') {
    return errorResponse('NO_AUTORIZADO', 'Solo super_admin puede crear administradores', 403)
  }

  const admin = adminClient()

  // 3. Crear usuario en Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName, cedula },
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return errorResponse('AUTH_ERROR', 'No se pudo crear usuario en Auth', 400)
  }

  // 4. El disparador handle_new_user() creó la fila en profiles con role='estudiante'
  // Actualizamos el rol al correcto
  const { error: updateError } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', authData.user.id)

  if (updateError) {
    // Rollback
    await admin.auth.admin.deleteUser(authData.user.id)
    return errorResponse('UPDATE_ERROR', 'No se pudo asignar el rol', 400)
  }

  // 5. Insertar en teachers o en admins según corresponda (spec FUNCIÓN 6
  // paso 5). Faltaba la rama de 'profesor': un profesor sin fila en
  // teachers no se puede asignar a ninguna cohorte después —
  // cohorts.teacher_id referencia teachers(id), no profiles(id).
  if (role === 'profesor') {
    const { error: teacherInsertError } = await admin.from('teachers').insert({
      id: authData.user.id,
      is_active: true,
    })

    if (teacherInsertError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return errorResponse('TEACHER_ERROR', 'No se pudo crear registro de profesor', 400)
    }
  } else if (role === 'admin' || role === 'super_admin' || role === 'direccion_academica') {
    const { error: adminInsertError } = await admin.from('admins').insert({
      id: authData.user.id,
      can_issue_certificates: role === 'super_admin',
    })

    if (adminInsertError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return errorResponse('ADMIN_ERROR', 'No se pudo crear registro de admin', 400)
    }
  }

  return okResponse({
    success: true,
    userId: authData.user.id,
    role,
  })
})
