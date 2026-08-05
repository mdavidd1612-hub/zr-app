import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Estudiantes del seed. A y B están en la MISMA cohorte a propósito:
// si el aislamiento falla, falla aquí primero.
//
// Los ids NO se escriben a mano. Antes estaban fijos
// ('00000000-…-f001') y no correspondían a ningún usuario real, así que los
// UPDATE de escalada de privilegios afectaban CERO filas, no devolvían error
// y la prueba pasaba por la razón equivocada: parecía que RLS bloqueaba algo
// cuando en realidad no había nada que bloquear. Se resuelven al iniciar
// sesión, contra el usuario que de verdad existe.
const A = { cedula: 'V-30000001', id: '' }
const B = { cedula: 'V-30000002', id: '' }
const PASS = 'Prueba123!'

async function entrar(cedula: string) {
  const c = createClient(URL, ANON)
  const { data, error } = await c.auth.signInWithPassword({
    email: `${cedula}@estudiante.zrmecademy.com`,
    password: PASS,
  })
  if (error) throw error
  return { cliente: c, id: data.user!.id }
}

describe('Aislamiento entre estudiantes', () => {
  let cliA: Awaited<ReturnType<typeof entrar>>['cliente']

  beforeAll(async () => {
    const a = await entrar(A.cedula)
    const b = await entrar(B.cedula)
    cliA = a.cliente
    A.id = a.id
    B.id = b.id
  })

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
    // No se comprueba que devuelva error: cuando RLS filtra las filas de un
    // UPDATE, PostgREST responde 204 sin error y con cero filas afectadas.
    // Pedirle un error a esa respuesta hace que la prueba pase incluso si la
    // política desaparece. Lo que importa es si la nota cambió.
    const { data: antes } = await cliA.from('module_enrollments')
      .select('id, theory_score').eq('student_id', A.id).maybeSingle()

    expect(antes, 'el seed tiene que dejar una inscripción, si no la prueba no prueba nada')
      .not.toBeNull()

    await cliA.from('module_enrollments')
      .update({ theory_score: 20 }).eq('student_id', A.id)

    const { data: despues } = await cliA.from('module_enrollments')
      .select('theory_score').eq('id', antes!.id).single()

    expect(despues!.theory_score).toBe(antes!.theory_score)
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
