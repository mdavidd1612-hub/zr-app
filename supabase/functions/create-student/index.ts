// T-113: Crear estudiante desde administración (uno o por lote CSV).
//
// El estudiante normal entra por /registro y elige su propia contraseña.
// Esta función es para cuando ADMINISTRACIÓN lo da de alta a mano: le asigna
// una contraseña temporal, y el correo real (contact_email) es a donde debe
// ir la recuperación — nunca al correo sintético de cedulaAEmail().

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

function erroresPorFila(errores: { fila: number; motivo: string }[]) {
  return new Response(
    JSON.stringify({
      error: { code: 'DATOS_INVALIDOS', message: 'Hay filas con errores, no se importó nada', errores },
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
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

function cedulaAEmail(cedula: string): string {
  return `${cedula.trim().toUpperCase()}@estudiante.zrmecademy.com`
}

function generarPasswordTemporal(): string {
  // 12 caracteres al azar, suficiente para una contraseña que se cambia en el
  // primer inicio de sesión y no se vuelve a usar.
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, 'x').slice(0, 12) + 'Aa1!'
}

interface FilaEstudiante {
  nombreCompleto: string
  cedula: string
  fechaNacimiento: string   // YYYY-MM-DD
  correoContacto: string
  telefono?: string
  cohorteId?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)

  const userSb = userClient(req)
  const { data: { user } } = await userSb.auth.getUser()
  if (!user) return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)

  const { data: perfil } = await userSb.from('profiles').select('role').eq('id', user.id).single()
  if (!perfil || !['admin', 'super_admin', 'vendedor'].includes(perfil.role)) {
    return errorResponse('NO_AUTORIZADO', 'Solo administración o ventas crean estudiantes', 403)
  }
  const esVendedor = perfil.role === 'vendedor'

  let body: { estudiantes?: FilaEstudiante[] }
  try {
    body = await req.json()
  } catch {
    return errorResponse('DATOS_INVALIDOS', 'Body JSON inválido')
  }

  const filas = body.estudiantes ?? []
  if (filas.length === 0) {
    return errorResponse('DATOS_INVALIDOS', 'No se envió ningún estudiante')
  }

  // Validación completa ANTES de crear nada: la carga es todo o nada.
  // Una fila mala en un CSV de 80 no debe dejar 79 cuentas huérfanas.
  const errores: { fila: number; motivo: string }[] = []
  const cedulaRx = /^V-\d{7,8}$/
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  filas.forEach((f, i) => {
    if (!f.nombreCompleto?.trim()) errores.push({ fila: i + 1, motivo: 'Falta el nombre completo' })
    if (!cedulaRx.test(f.cedula ?? '')) errores.push({ fila: i + 1, motivo: `Cédula inválida: "${f.cedula}"` })
    if (!f.fechaNacimiento || Number.isNaN(Date.parse(f.fechaNacimiento))) {
      errores.push({ fila: i + 1, motivo: `Fecha de nacimiento inválida: "${f.fechaNacimiento}"` })
    }
    if (!emailRx.test(f.correoContacto ?? '')) errores.push({ fila: i + 1, motivo: `Correo inválido: "${f.correoContacto}"` })
    if (esVendedor && !f.cohorteId) errores.push({ fila: i + 1, motivo: 'Ventas debe asignar una cohorte al inscribir' })
  })

  if (errores.length > 0) return erroresPorFila(errores)

  const admin = adminClient()

  // Cédulas duplicadas entre sí en el mismo archivo.
  const vistas = new Set<string>()
  filas.forEach((f, i) => {
    const c = f.cedula.trim().toUpperCase()
    if (vistas.has(c)) errores.push({ fila: i + 1, motivo: `Cédula repetida en el archivo: ${c}` })
    vistas.add(c)
  })

  // Cédulas que ya existen en la base.
  const { data: existentes } = await admin
    .from('profiles')
    .select('cedula')
    .in('cedula', [...vistas])

  const yaExisten = new Set((existentes ?? []).map((p) => p.cedula))
  filas.forEach((f, i) => {
    if (yaExisten.has(f.cedula.trim().toUpperCase())) {
      errores.push({ fila: i + 1, motivo: `Ya existe un estudiante con la cédula ${f.cedula}` })
    }
  })

  if (errores.length > 0) return erroresPorFila(errores)

  // Todo validado. Se crean todas las cuentas; si alguna falla a mitad de
  // camino (fallo de red con Auth, por ejemplo) se deshacen las ya creadas.
  const creados: { userId: string; cedula: string }[] = []

  for (const f of filas) {
    const cedula = f.cedula.trim().toUpperCase()
    const password = generarPasswordTemporal()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: cedulaAEmail(cedula),
      password,
      user_metadata: {
        full_name: f.nombreCompleto,
        cedula,
        contact_email: f.correoContacto,
        phone: f.telefono ?? null,
      },
      email_confirm: true,
    })

    if (authError || !authData.user) {
      for (const c of creados) await admin.auth.admin.deleteUser(c.userId)
      return errorResponse('ERROR_INTERNO', `No se pudo crear la cuenta de ${cedula}: ${authError?.message}`)
    }

    // El disparador handle_new_user ya creó profiles (role='estudiante',
    // full_name, cedula, contact_email, phone) desde la metadata de arriba.
    // Solo falta la fila propia de students.
    const { error: studentError } = await admin.from('students').insert({
      id: authData.user.id,
      birth_date: f.fechaNacimiento,
      cohort_id: f.cohorteId ?? null,
      enrolled_by: esVendedor ? user.id : null,
    })

    if (studentError) {
      for (const c of [...creados, { userId: authData.user.id, cedula }]) {
        await admin.auth.admin.deleteUser(c.userId)
      }
      return errorResponse('ERROR_INTERNO', `No se pudo completar el registro de ${cedula}`)
    }

    creados.push({ userId: authData.user.id, cedula })
  }

  return okResponse({ ok: true, creados: creados.length })
})
