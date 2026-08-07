import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'
import { randomUUID } from 'node:crypto'

/**
 * spec/05_PRUEBAS.md §3 · asistencia.spec.ts
 *
 * "Enviar un código a validate-scan" se prueba llamando la Edge Function
 * directamente (page.request, con el token de sesión del profesor) — es lo
 * que dice el spec literalmente, y es además la única forma realista de
 * probarlo: la cámara no se puede simular en un navegador de pruebas.
 * El registro manual por cédula sí se prueba por la UI real, tal como lo
 * usaría un profesor.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE_KEY)

async function prepararEscenario() {
  // Profesor
  const cedulaProfesor = `V-8${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
  const { data: profeAuth } = await admin.auth.admin.createUser({
    email: `${cedulaProfesor.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula: cedulaProfesor, full_name: 'Prof. E2E Asistencia' },
  })
  const profesorId = profeAuth.user!.id
  await admin.from('profiles').update({ role: 'profesor' }).eq('id', profesorId)
  await admin.from('teachers').insert({ id: profesorId, is_active: true })

  // Cohorte + sesión abierta
  const { data: modulo } = await admin.from('modules').select('id').order('order_index').limit(1).single()
  const { data: programa } = await admin.from('programs').select('id').limit(1).single()
  const { data: cohorte } = await admin
    .from('cohorts')
    .insert({ program_id: programa!.id, name: `Cohorte E2E ${randomUUID()}`, current_module_id: modulo!.id, teacher_id: profesorId })
    .select('id')
    .single()
  const { data: sesion } = await admin
    .from('class_sessions')
    .insert({ cohort_id: cohorte!.id, module_id: modulo!.id, session_date: new Date().toISOString().slice(0, 10), week_number: 1, status: 'abierta' })
    .select('id')
    .single()

  // Estudiante con secreto QR
  const cedulaEstudiante = `V-9${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
  const { data: estAuth } = await admin.auth.admin.createUser({
    email: `${cedulaEstudiante.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula: cedulaEstudiante, full_name: 'Estudiante E2E Asistencia' },
  })
  const estudianteId = estAuth.user!.id
  await admin.from('students').insert({ id: estudianteId, birth_date: '2005-01-01', cohort_id: cohorte!.id, onboarding_status: 'completo' })

  const secret = new OTPAuth.Secret({ size: 20 }).base32
  await admin.from('student_qr_secrets').insert({ student_id: estudianteId, secret })

  // Sesión de profesor (para llamar la Edge Function con su token)
  const { data: login } = await admin.auth.signInWithPassword({
    email: `${cedulaProfesor.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
  })

  return {
    profesorId, estudianteId, cohorteId: cohorte!.id, sesionId: sesion!.id,
    cedulaEstudiante, secret, tokenProfesor: login!.session!.access_token,
  }
}

function codigoQR(cedula: string, secret: string, offsetSegundos = 0) {
  const totp = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) })
  const codigo = totp.generate({ timestamp: Date.now() + offsetSegundos * 1000 })
  return `ZR1|${cedula}|${codigo}`
}

test('escaneo válido, duplicado, vencido, y registro manual por cédula', async ({ page, request }) => {
  const escenario = await prepararEscenario()

  // 1. Código válido → verde con el nombre
  const qrValido = codigoQR(escenario.cedulaEstudiante, escenario.secret)
  const r1 = await request.post(`${URL}/functions/v1/validate-scan`, {
    headers: { Authorization: `Bearer ${escenario.tokenProfesor}`, apikey: ANON },
    data: { sessionId: escenario.sesionId, qrCode: qrValido, scannedAt: new Date().toISOString(), deviceId: 'e2e-device' },
  })
  expect(r1.ok()).toBe(true)
  const body1 = await r1.json()
  expect(body1.ok).toBe(true)
  expect(body1.duplicate).toBe(false)
  expect(body1.student.fullName).toBe('Estudiante E2E Asistencia')

  // 2. El mismo código otra vez → "ya registrado" (duplicate:true, no error)
  const r2 = await request.post(`${URL}/functions/v1/validate-scan`, {
    headers: { Authorization: `Bearer ${escenario.tokenProfesor}`, apikey: ANON },
    data: { sessionId: escenario.sesionId, qrCode: qrValido, scannedAt: new Date().toISOString(), deviceId: 'e2e-device' },
  })
  const body2 = await r2.json()
  expect(body2.ok).toBe(true)
  expect(body2.duplicate).toBe(true)

  // 3. Código vencido (fuera de la ventana de tolerancia) → error rojo QR_VENCIDO
  const qrVencido = codigoQR(escenario.cedulaEstudiante, escenario.secret, -600) // 10 min en el pasado
  const r3 = await request.post(`${URL}/functions/v1/validate-scan`, {
    headers: { Authorization: `Bearer ${escenario.tokenProfesor}`, apikey: ANON },
    data: { sessionId: escenario.sesionId, qrCode: qrVencido, scannedAt: new Date().toISOString(), deviceId: 'e2e-device' },
  })
  const body3 = await r3.json()
  expect(body3.error.code).toBe('QR_VENCIDO')

  // 4. Registro manual por cédula, con motivo — vía la UI real de /escanear
  await page.goto('/login')
  await page.locator('input[name="cedula"]').fill((await admin.from('profiles').select('cedula').eq('id', escenario.profesorId).single()).data!.cedula)
  await page.locator('input[name="password"]').fill('Prueba123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/hoy/, { timeout: 15_000 })

  await page.goto(`/escanear/${escenario.sesionId}`)
  await page.getByRole('button', { name: 'Buscar por cédula' }).click()

  // Segundo estudiante manual, distinto del ya escaneado por QR.
  const cedulaManual = `V-9${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
  const { data: manualAuth } = await admin.auth.admin.createUser({
    email: `${cedulaManual.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula: cedulaManual, full_name: 'Estudiante Manual E2E' },
  })
  await admin.from('students').insert({ id: manualAuth.user!.id, birth_date: '2005-01-01', cohort_id: escenario.cohorteId, onboarding_status: 'completo' })

  await page.getByPlaceholder('Buscar por nombre o cédula…').fill('Estudiante Manual E2E')
  await page.getByText('Estudiante Manual E2E').click()
  await page.getByRole('button', { name: 'Teléfono sin batería' }).click()

  await expect(page.getByText('Estudiante Manual E2E')).toBeVisible({ timeout: 5_000 })

  const { data: asistenciaManual } = await admin
    .from('attendance_events')
    .select('method, manual_reason')
    .eq('session_id', escenario.sesionId)
    .eq('student_id', manualAuth.user!.id)
    .single()
  expect(asistenciaManual!.method).toBe('manual')
  expect(asistenciaManual!.manual_reason).toBe('Teléfono sin batería')
})
