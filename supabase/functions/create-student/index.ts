// T-113: Crear estudiante — ahora la ÚNICA vía para que exista un estudiante.
//
// Ya no hay autoregistro (docs/17_PLAN_CONSOLIDADO..., ajuste post-Sprint 7):
// el vendedor (o administración) lo inscribe con los datos de la planilla
// física, Módulo 1. La contraseña de la cuenta NO la elige nadie — es el
// mismo código de carnet que el trigger set_student_code() genera al
// insertar en `students` (PTMA/PFTA-AAAA-CC-CCC), que es lo que dice la
// planilla: "consérvelo, lo necesitará para su primer ingreso a la app".
//
// Si es menor de edad, se piden también los datos completos del
// representante — la planilla real los pide todos en el momento de la
// venta, no después.

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

function esMenorDeEdad(fechaNacimiento: string): boolean {
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad < 18
}

function generarPasswordTemporal(): string {
  // Contraseña de arranque, solo hasta que el trigger genere el código real
  // (necesita que el usuario de Auth ya exista). Se reemplaza abajo.
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, 'x').slice(0, 12) + 'Aa1!'
}

interface DatosRepresentante {
  nombre: string
  cedula: string
  parentesco: string
  edad: number
  nacionalidad: string
  profesion: string
  telefono?: string
  correo: string
}

interface FilaEstudiante {
  nombreCompleto: string
  cedula: string
  fechaNacimiento: string   // YYYY-MM-DD
  correoContacto: string
  telefono?: string
  direccion?: string
  cohorteId?: string | null
  representante?: DatosRepresentante
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
  const errores: { fila: number; motivo: string }[] = []
  const cedulaRx = /^[VEJ]-\d{6,9}$/
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  filas.forEach((f, i) => {
    if (!f.nombreCompleto?.trim()) errores.push({ fila: i + 1, motivo: 'Falta el nombre completo' })
    if (!cedulaRx.test(f.cedula ?? '')) errores.push({ fila: i + 1, motivo: `Cédula inválida: "${f.cedula}"` })
    if (!f.fechaNacimiento || Number.isNaN(Date.parse(f.fechaNacimiento))) {
      errores.push({ fila: i + 1, motivo: `Fecha de nacimiento inválida: "${f.fechaNacimiento}"` })
    }
    if (!emailRx.test(f.correoContacto ?? '')) errores.push({ fila: i + 1, motivo: `Correo inválido: "${f.correoContacto}"` })
    if (esVendedor && !f.cohorteId) errores.push({ fila: i + 1, motivo: 'Ventas debe asignar una cohorte al inscribir' })

    if (f.fechaNacimiento && !Number.isNaN(Date.parse(f.fechaNacimiento)) && esMenorDeEdad(f.fechaNacimiento)) {
      const r = f.representante
      if (!r || !r.nombre?.trim() || !cedulaRx.test(r.cedula ?? '') || !r.parentesco?.trim()
        || !r.edad || !r.nacionalidad?.trim() || !r.profesion?.trim() || !emailRx.test(r.correo ?? '')) {
        errores.push({ fila: i + 1, motivo: 'Es menor de edad: faltan datos completos del representante (LOPNNA)' })
      }
    }
  })

  if (errores.length > 0) return erroresPorFila(errores)

  const admin = adminClient()

  const vistas = new Set<string>()
  filas.forEach((f, i) => {
    const c = f.cedula.trim().toUpperCase()
    if (vistas.has(c)) errores.push({ fila: i + 1, motivo: `Cédula repetida en el archivo: ${c}` })
    vistas.add(c)
  })

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

  const creados: { userId: string; cedula: string; studentCode: string }[] = []

  for (const f of filas) {
    const cedula = f.cedula.trim().toUpperCase()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: cedulaAEmail(cedula),
      password: generarPasswordTemporal(),
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

    const { data: nuevoEstudiante, error: studentError } = await admin.from('students').insert({
      id: authData.user.id,
      birth_date: f.fechaNacimiento,
      cohort_id: f.cohorteId ?? null,
      address: f.direccion ?? null,
      enrolled_by: esVendedor ? user.id : null,
    }).select('student_code').single()

    if (studentError || !nuevoEstudiante) {
      for (const c of [...creados, { userId: authData.user.id, cedula, studentCode: '' }]) {
        await admin.auth.admin.deleteUser(c.userId)
      }
      return errorResponse('ERROR_INTERNO', `No se pudo completar el registro de ${cedula}`)
    }

    const studentCode = nuevoEstudiante.student_code as string

    // La contraseña de la cuenta ES el código de carnet — se fija recién
    // ahora porque el trigger que lo genera necesita que el usuario y la
    // cohorte ya existan (regla 2 de AGENTS.md: nunca se calcula en el
    // cliente, aquí sigue siendo 100% servidor).
    const { error: passwordError } = await admin.auth.admin.updateUserById(authData.user.id, {
      password: studentCode,
    })
    if (passwordError) {
      for (const c of [...creados, { userId: authData.user.id, cedula, studentCode }]) {
        await admin.auth.admin.deleteUser(c.userId)
      }
      return errorResponse('ERROR_INTERNO', `No se pudo fijar la contraseña de ${cedula}`)
    }

    if (f.representante) {
      const r = f.representante
      const { error: consentError } = await admin.from('parental_consents').insert({
        student_id: authData.user.id,
        consent_type: 'account_creation',
        representative_name: r.nombre.trim(),
        representative_cedula: r.cedula.trim().toUpperCase(),
        representative_email: r.correo.trim(),
        representative_phone: r.telefono?.trim() || null,
        representative_relationship: r.parentesco.trim(),
        representative_age: r.edad,
        representative_nationality: r.nacionalidad.trim(),
        representative_occupation: r.profesion.trim(),
        method: 'fisico',
      })
      if (consentError) {
        console.error('create-student: fallo al guardar el consentimiento', consentError.message)
      }
    }

    creados.push({ userId: authData.user.id, cedula, studentCode })
  }

  return okResponse({ ok: true, creados: creados.map((c) => ({ cedula: c.cedula, studentCode: c.studentCode })) })
})
