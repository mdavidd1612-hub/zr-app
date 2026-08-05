import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Estudiantes del seed. A y B están en la MISMA cohorte a propósito:
// si el aislamiento falla, falla aquí primero.
const A = { cedula: 'V-30000001', id: '00000000-0000-0000-0000-00000000f001' }
const B = { cedula: 'V-30000002', id: '00000000-0000-0000-0000-00000000f002' }
const PASS = 'Prueba123!'

async function entrar(cedula: string) {
  const c = createClient(URL, ANON)
  const { error } = await c.auth.signInWithPassword({
    email: `${cedula}@estudiante.zrmecademy.com`,
    password: PASS,
  })
  if (error) throw error
  return c
}

describe('Aislamiento entre estudiantes', () => {
  let cliA: Awaited<ReturnType<typeof entrar>>

  beforeAll(async () => { cliA = await entrar(A.cedula) })

  it('no puede leer el perfil de otro estudiante', async () => {
    const { data } = await cliA.from('profiles').select('*').eq('id', B.id)
    expect(data).toHaveLength(0)
  })

  it('no puede leer las notas de otro estudiante', async () => {
    const { data } = await cliA.from('module_enrollments').select('*').eq('student_id', B.id)
    expect(data).toHaveLength(0)
  })

  it('no puede leer la asistencia de otro estudiante', async () => {
    const { data } = await cliA.from('attendance_events').select('*').eq('student_id', B.id)
    expect(data).toHaveLength(0)
  })

  it('no puede leer el consentimiento parental de otro estudiante', async () => {
    const { data } = await cliA.from('parental_consents').select('*').eq('student_id', B.id)
    expect(data).toHaveLength(0)
  })

  it('no puede leer los intentos de examen de otro estudiante', async () => {
    const { data } = await cliA.from('exam_attempts').select('*').eq('student_id', B.id)
    expect(data).toHaveLength(0)
  })

  it('no puede leer el feedback de otro estudiante', async () => {
    const { data } = await cliA.from('feedback_micro').select('*').eq('student_id', B.id)
    expect(data).toHaveLength(0)
  })

  it('NO PUEDE LEER NINGÚN SECRETO DE QR, NI EL PROPIO', async () => {
    const { data, error } = await cliA.from('student_qr_secrets').select('*')
    expect(data ?? []).toHaveLength(0)
    // Sin permiso de tabla, Supabase devuelve error o cero filas. Las dos están bien.
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })

  it('NO PUEDE VER LAS RESPUESTAS CORRECTAS DE UN EXAMEN', async () => {
    const { data } = await cliA.from('exam_questions').select('*')
    expect(data ?? []).toHaveLength(0)
  })

  it('la vista para estudiantes no expone la columna correct_answer', async () => {
    const { data } = await cliA.from('v_exam_questions_student').select('*').limit(1)
    if (data && data.length > 0) {
      expect(Object.keys(data[0])).not.toContain('correct_answer')
      expect(Object.keys(data[0])).not.toContain('rubric')
    }
  })

  it('no puede subirse el rol a sí mismo', async () => {
    const { error } = await cliA.from('profiles')
      .update({ role: 'super_admin' }).eq('id', A.id)
    expect(error).not.toBeNull()
  })

  it('no puede escribir sus propias notas', async () => {
    const { error } = await cliA.from('module_enrollments')
      .update({ theory_score: 20 }).eq('student_id', A.id)
    expect(error).not.toBeNull()
  })

  it('no puede registrar su propia asistencia', async () => {
    const { error } = await cliA.from('attendance_events').insert({
      session_id: '00000000-0000-0000-0000-000000000000',
      student_id: A.id,
      scanned_by: A.id,
    } as never)
    expect(error).not.toBeNull()
  })

  it('no puede leer la auditoría', async () => {
    const { data } = await cliA.from('audit_log').select('*')
    expect(data ?? []).toHaveLength(0)
  })

  it('no puede leer el mapa de dominio de otro estudiante', async () => {
    const { data } = await cliA.from('mastery_map').select('*').eq('student_id', B.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('NO PUEDE MARCARSE A SÍ MISMO UNA COMPETENCIA COMO DOMINADA', async () => {
    // Si pudiera, el mapa de dominio dejaría de significar nada.
    const { data: guias } = await cliA.from('learning_guides').select('id').limit(1)
    const { error } = await cliA.from('mastery_map').insert({
      student_id: A.id,
      learning_guide_id: guias![0].id,
      status: 'dominado',
      dominated_via: 'evaluacion_practica',
    } as never)
    expect(error).not.toBeNull()
  })
})
