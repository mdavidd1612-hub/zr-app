import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

/**
 * spec/05_PRUEBAS.md §3 · examen.spec.ts
 *
 * El recorrido completo: profesor crea examen con los tres tipos de
 * pregunta, publica, estudiante entrega, las objetivas ya tienen puntaje
 * y la redacción no, el profesor la califica, el intento cierra solo.
 *
 * La creación se hace por API directa (más estable que dirigir el
 * constructor de preguntas paso a paso) — lo que SÍ se prueba por UI real
 * es la parte que importa de verdad: publicar, presentar, entregar,
 * calificar y ver la nota, que es donde vivían los bugs reales de la app.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE_KEY)

async function prepararEscenario() {
  const cedulaProfesor = `V-8${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
  const { data: profeAuth } = await admin.auth.admin.createUser({
    email: `${cedulaProfesor.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula: cedulaProfesor, full_name: 'Prof. E2E Examen' },
  })
  const profesorId = profeAuth.user!.id
  await admin.from('profiles').update({ role: 'profesor' }).eq('id', profesorId)
  await admin.from('teachers').insert({ id: profesorId, is_active: true })

  const { data: modulo } = await admin.from('modules').select('id').order('order_index').limit(1).single()
  const { data: programa } = await admin.from('programs').select('id').limit(1).single()
  const { data: cohorte } = await admin
    .from('cohorts')
    .insert({ program_id: programa!.id, name: `Cohorte E2E Examen ${randomUUID()}`, current_module_id: modulo!.id, teacher_id: profesorId })
    .select('id')
    .single()

  const cedulaEstudiante = `V-9${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
  const { data: estAuth } = await admin.auth.admin.createUser({
    email: `${cedulaEstudiante.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula: cedulaEstudiante, full_name: 'Estudiante E2E Examen' },
  })
  const estudianteId = estAuth.user!.id
  await admin.from('students').insert({ id: estudianteId, birth_date: '2005-01-01', cohort_id: cohorte!.id, onboarding_status: 'completo' })

  // Examen con los tres tipos de pregunta, exactamente 10 puntos.
  const { data: examen } = await admin
    .from('exams')
    .insert({ module_id: modulo!.id, cohort_id: cohorte!.id, teacher_id: profesorId, title: 'Examen E2E', max_score: 10, status: 'oculto' })
    .select('id')
    .single()

  await admin.from('exam_questions').insert([
    { exam_id: examen!.id, order_index: 1, type: 'opcion_multiple', statement: '¿2+2?', options: [{ key: 'a', text: '3' }, { key: 'b', text: '4' }], correct_answer: 'b', points: 4 },
    { exam_id: examen!.id, order_index: 2, type: 'verdadero_falso', statement: 'El cielo es azul.', correct_answer: true, points: 3 },
    { exam_id: examen!.id, order_index: 3, type: 'redaccion_abierta', statement: 'Explica por qué.', rubric: '3 pts: respuesta coherente.', points: 3 },
  ] as never)

  return { cedulaProfesor, cedulaEstudiante, examenId: examen!.id as string }
}

test('examen completo: crear, publicar, presentar, entregar y calificar', async ({ page }) => {
  const { cedulaProfesor, cedulaEstudiante, examenId } = await prepararEscenario()

  // --- Profesor publica el examen ---
  await page.goto('/login')
  await page.locator('input[name="cedula"]').fill(cedulaProfesor)
  await page.locator('input[name="password"]').fill('Prueba123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/hoy/, { timeout: 15_000 })

  await page.goto('/crear-examen')
  const tarjeta = page.locator('.zr-card', { hasText: 'Examen E2E' })
  await expect(tarjeta).toBeVisible({ timeout: 10_000 })
  await tarjeta.getByRole('button', { name: 'Publicar' }).click()
  await expect(tarjeta.getByText('Publicado')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => localStorage.clear())

  // --- Estudiante presenta el examen ---
  await page.goto('/login')
  await page.locator('input[name="cedula"]').fill(cedulaEstudiante)
  await page.locator('input[name="password"]').fill('Prueba123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  await page.goto('/examenes')
  await page.getByText('Examen E2E').click()
  await expect(page).toHaveURL(new RegExp(`/examenes/${examenId}`), { timeout: 10_000 })

  // Pregunta 1: opción múltiple
  await page.getByText('4', { exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // Pregunta 2: verdadero/falso
  await page.getByRole('button', { name: 'Verdadero' }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // Pregunta 3: redacción abierta
  await page.getByPlaceholder('Escribe tu respuesta aquí...').fill('Porque dispersa la luz azul más que otros colores.')
  await page.getByRole('button', { name: 'Entregar' }).click()
  await page.getByRole('button', { name: 'Sí, entregar' }).click()

  // Las objetivas ya tienen puntaje (7 = 4+3); la redacción todavía no.
  await expect(page.getByText(/Entregado/)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/todavía tiene que calificar/)).toBeVisible()

  const { data: intentoAMedias } = await admin
    .from('exam_attempts')
    .select('status, total_score')
    .eq('exam_id', examenId)
    .single()
  expect(intentoAMedias!.status).toBe('entregado')
  expect(Number(intentoAMedias!.total_score)).toBe(7)

  await page.evaluate(() => localStorage.clear())

  // --- Profesor califica la redacción ---
  await page.goto('/login')
  await page.locator('input[name="cedula"]').fill(cedulaProfesor)
  await page.locator('input[name="password"]').fill('Prueba123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/hoy/, { timeout: 15_000 })

  await page.goto('/calificar')
  await expect(page.getByText('Estudiante E2E Examen')).toBeVisible({ timeout: 10_000 })
  await page.getByLabel(/Puntaje/).fill('3')
  await page.getByRole('button', { name: /Guardar/ }).click()

  // El intento cierra solo, con el total de las tres preguntas.
  await expect(page.getByText(/Todo al día/)).toBeVisible({ timeout: 10_000 })

  const { data: intentoFinal } = await admin
    .from('exam_attempts')
    .select('status, total_score')
    .eq('exam_id', examenId)
    .single()
  expect(intentoFinal!.status).toBe('calificado')
  expect(Number(intentoFinal!.total_score)).toBe(10)
})
