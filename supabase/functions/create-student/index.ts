// T-113: Crear estudiante — ahora la ÚNICA vía para que exista un estudiante.
//
// Ya no hay autoregistro (docs/17_PLAN_CONSOLIDADO..., ajuste post-Sprint 7):
// el vendedor (o administración) lo inscribe con los datos de la planilla
// física, Módulo 1. La contraseña de la cuenta NO la elige nadie — es el
// mismo código de carnet que el trigger set_student_code() genera al
// insertar en `students` (PTMA/PFTA-AAAA-CC-CCC), que es lo que dice la
// planilla: "consérvelo, lo necesitará para su primer ingreso a la app".
//
// Si es menor de edad, ventas puede anotar el contacto del representante
// (nombre, cédula, teléfono, correo) — solo como referencia. No es un
// requisito para crear la cuenta: la academia decidió no bloquear nada por
// ser menor de edad respecto al CONSENTIMIENTO, así que esos ocho campos
// nunca hacen fallar la inscripción (docs/18 §2.1, migración 051).
//
// Eso es distinto de R-11 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): un menor
// sí necesita un segundo teléfono de contacto (`emergency_contact_phone`)
// para poder ubicarlo, y ESE sí bloquea la inscripción si falta. No es una
// decisión sobre consentimiento legal, es que la academia necesita poder
// llamar a alguien si el estudiante no aparece.

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
  // Contraseña de arranque, solo hasta que el trigger genere el código real
  // (necesita que el usuario de Auth ya exista). Se reemplaza abajo.
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, 'x').slice(0, 12) + 'Aa1!'
}

// Los ocho campos que pide la planilla física de la academia
// (especificacion-funcional-zrm-academy.md §3). Ninguno bloquea la
// inscripción — se guarda lo que ventas haya podido anotar.
interface DatosRepresentante {
  nombre?: string
  cedula?: string
  telefono?: string
  correo?: string
  parentesco?: string
  edad?: number
  nacionalidad?: string
  profesion?: string
}

interface FilaEstudiante {
  nombreCompleto: string
  cedula: string
  fechaNacimiento: string   // YYYY-MM-DD
  correoContacto: string
  telefono?: string
  // Segundo teléfono de contacto — obligatorio si el estudiante es menor de
  // edad (R-11). No confundir con el teléfono del representante que se
  // guarda en `representante.telefono`: ese es solo referencia para el
  // consentimiento y nunca bloquea nada (docs/18 §2.1). Este es
  // `students.emergency_contact_phone`, un número de localización que sí es
  // obligatorio para un menor.
  telefonoEmergencia?: string
  direccion?: string
  cohorteId?: string | null
  representante?: DatosRepresentante
}

// R-10: ataca el caso real que reportó la directiva (dos "Ricardo Hernández"
// en el mismo corte), sin bloquear nombres legítimos cortos. No se puede
// detectar toda abreviatura, así que la regla es deliberadamente simple:
// al menos dos palabras, cada una con 3+ letras, sin puntos (que es como se
// abrevia en español: "J. Pérez", "Ma. González").
function nombreCompletoValido(nombre: string): boolean {
  const limpio = nombre.trim()
  if (limpio.includes('.')) return false
  const palabras = limpio.split(/\s+/).filter(Boolean)
  if (palabras.length < 2) return false
  return palabras.every((p) => (p.match(/\p{L}/gu) ?? []).length >= 3)
}

// R-11: formato venezolano, admite escrito con o sin guiones/espacios, con o
// sin +58. 11 dígitos empezando en 0 (0412-1234567) o 12 empezando en 58
// (58-412-1234567).
function telefonoValido(raw: string | undefined | null): boolean {
  if (!raw) return false
  const digitos = raw.replace(/\D/g, '')
  if (digitos.length === 11 && digitos.startsWith('0')) return true
  if (digitos.length === 12 && digitos.startsWith('58')) return true
  return false
}

// Mismo cálculo que `esMenorDeEdad` de lib/auth-helpers.ts — se duplica aquí
// porque las Edge Functions no importan del repo, solo de esm.sh (mismo
// motivo por el que cedulaRx/emailRx ya estaban duplicados en este archivo).
function esMenorDeEdad(fechaNacimiento: string, hoy = new Date()): boolean {
  const nacimiento = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad < 18
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Solo POST', 405)

  const userSb = userClient(req)
  const { data: { user } } = await userSb.auth.getUser()
  if (!user) return errorResponse('NO_AUTORIZADO', 'No autenticado', 401)

  const { data: perfil } = await userSb.from('profiles').select('role').eq('id', user.id).single()
  // R-17: Dirección Académica también puede inscribir, como respaldo del
  // vendedor — la matriz de roles la incluye junto a admin/super_admin.
  if (!perfil || !['admin', 'super_admin', 'direccion_academica', 'vendedor'].includes(perfil.role)) {
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
    if (!nombreCompletoValido(f.nombreCompleto ?? '')) {
      errores.push({ fila: i + 1, motivo: 'Escribe el nombre completo como aparece en la cédula, sin abreviar.' })
    }
    if (!cedulaRx.test(f.cedula ?? '')) errores.push({ fila: i + 1, motivo: `Cédula inválida: "${f.cedula}"` })
    const fechaValida = Boolean(f.fechaNacimiento) && !Number.isNaN(Date.parse(f.fechaNacimiento))
    if (!fechaValida) {
      errores.push({ fila: i + 1, motivo: `Fecha de nacimiento inválida: "${f.fechaNacimiento}"` })
    }
    if (!emailRx.test(f.correoContacto ?? '')) errores.push({ fila: i + 1, motivo: `Correo inválido: "${f.correoContacto}"` })
    if (!telefonoValido(f.telefono)) {
      errores.push({ fila: i + 1, motivo: 'El teléfono es obligatorio, en formato venezolano (ej. 0412-1234567).' })
    }
    if (fechaValida && esMenorDeEdad(f.fechaNacimiento) && !telefonoValido(f.telefonoEmergencia)) {
      errores.push({ fila: i + 1, motivo: 'Por ser menor de edad, hace falta un segundo teléfono de contacto.' })
    }
    if (esVendedor && !f.cohorteId) errores.push({ fila: i + 1, motivo: 'Ventas debe asignar una cohorte al inscribir' })
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
      emergency_contact_phone: f.telefonoEmergencia?.trim() || null,
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

    // Solo referencia — nunca bloquea la inscripción. Se guarda lo que haya.
    if (f.representante?.nombre?.trim() || f.representante?.correo?.trim()) {
      const r = f.representante
      const { error: consentError } = await admin.from('parental_consents').insert({
        student_id: authData.user.id,
        consent_type: 'account_creation',
        representative_name: r.nombre?.trim() || '',
        representative_cedula: r.cedula?.trim().toUpperCase() || '',
        representative_email: r.correo?.trim() || '',
        representative_phone: r.telefono?.trim() || null,
        representative_relationship: r.parentesco?.trim() || null,
        representative_age: Number.isFinite(r.edad) && (r.edad ?? 0) > 0 ? r.edad : null,
        representative_nationality: r.nacionalidad?.trim() || null,
        representative_occupation: r.profesion?.trim() || null,
        method: 'fisico',
      })
      if (consentError) {
        console.error('create-student: fallo al guardar el contacto del representante', consentError.message)
      }
    }

    creados.push({ userId: authData.user.id, cedula, studentCode })
  }

  return okResponse({ ok: true, creados: creados.map((c) => ({ cedula: c.cedula, studentCode: c.studentCode })) })
})
