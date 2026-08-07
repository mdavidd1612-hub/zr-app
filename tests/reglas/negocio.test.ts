import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

/**
 * T-312 · Las 19 pruebas de reglas de negocio de spec/05_PRUEBAS.md §2.
 *
 * Corren con el cliente de servicio (service_role) contra la base LOCAL —
 * nunca contra producción. service_role salta RLS a propósito: lo que se
 * está probando aquí son los triggers y checks de la base, no los permisos.
 *
 * Cada prueba crea sus propios usuarios con auth.admin.createUser() — el
 * disparador on_auth_user_created (migración 003) crea el perfil solo, en
 * rol 'estudiante' siempre, leyendo cedula/full_name de user_metadata. Se
 * borran al terminar (on delete cascade desde auth.users se lleva profiles,
 * students, enrollments, etc.), para no ensuciar la base local.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE_KEY)

const idsACrear: string[] = []

function cedulaAlAzar(prefijo: string) {
  return `V-${prefijo}${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
}

async function crearEstudiante(nombre: string, birthDate: string, cohortId?: string) {
  const cedula = cedulaAlAzar('9')
  const { data, error: falloUsuario } = await admin.auth.admin.createUser({
    email: `${cedula.toLowerCase().replace('-', '')}@correo.test`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula, full_name: nombre },
  })
  if (falloUsuario) throw falloUsuario
  const id = data.user!.id

  const { error: falloEstudiante } = await admin.from('students').insert({
    id,
    birth_date: birthDate,
    cohort_id: cohortId ?? null,
    onboarding_status: 'en_curso',
  })
  if (falloEstudiante) throw falloEstudiante

  idsACrear.push(id)
  return id
}

async function moduloPorOrden(orden: number) {
  const { data } = await admin.from('modules').select('id').eq('order_index', orden).single()
  return data!.id as string
}

async function crearCohorte(moduloId: string, teacherId?: string) {
  const { data: programa } = await admin.from('programs').select('id').limit(1).single()
  const { data: cohorte } = await admin
    .from('cohorts')
    .insert({
      program_id: programa!.id,
      name: `Cohorte Test ${randomUUID()}`,
      current_module_id: moduloId,
      teacher_id: teacherId ?? null,
    })
    .select('id')
    .single()
  return cohorte!.id as string
}

afterAll(async () => {
  // Borrar auth.users arrastra profiles/students/enrollments/etc. por cascade.
  for (const id of idsACrear) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
})

describe('Reglas de negocio — inscripción y notas', () => {
  it('umbral del primer módulo es 10', async () => {
    const modulo1 = await moduloPorOrden(1)
    const cohorte = await crearCohorte(modulo1)
    const estudiante = await crearEstudiante('Test Umbral 1', '2005-01-01', cohorte)

    const { data, error } = await admin
      .from('module_enrollments')
      .insert({ student_id: estudiante, module_id: modulo1, cohort_id: cohorte })
      .select('passing_threshold')
      .single()

    expect(error).toBeNull()
    expect(Number(data!.passing_threshold)).toBe(10)
  })

  it('umbral del resto de módulos es 12', async () => {
    const modulo3 = await moduloPorOrden(3)
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Umbral Resto', '2005-01-01', cohorte)

    const { data, error } = await admin
      .from('module_enrollments')
      .insert({ student_id: estudiante, module_id: modulo3, cohort_id: cohorte })
      .select('passing_threshold')
      .single()

    expect(error).toBeNull()
    expect(Number(data!.passing_threshold)).toBe(12)
  })

  it('calcula la nota final con la fórmula documentada', async () => {
    const modulo1 = await moduloPorOrden(1)
    const cohorte = await crearCohorte(modulo1)
    const estudiante = await crearEstudiante('Test Calculo Nota', '2005-01-01', cohorte)

    const { data, error } = await admin
      .from('module_enrollments')
      .insert({
        student_id: estudiante,
        module_id: modulo1,
        cohort_id: cohorte,
        theory_score: 16,
        practice_score: 14,
        participation_score: 20,
        participation_weight: 0.10,
      })
      .select('final_score')
      .single()

    expect(error).toBeNull()
    expect(Number(data!.final_score)).toBe(15.50)
  })

  it('aprueba cuando la nota alcanza el umbral', async () => {
    const modulo3 = await moduloPorOrden(3) // umbral 12
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Aprueba', '2005-01-01', cohorte)

    // theory=13.5, practice=13.5, participation=10, weight=0.05
    // (1-0.05)/2 = 0.475 → 13.5*0.475*2 + 10*0.05 = 12.825 + 0.5 = 13.325 → alcanza 12
    const { data, error } = await admin
      .from('module_enrollments')
      .insert({
        student_id: estudiante,
        module_id: modulo3,
        cohort_id: cohorte,
        theory_score: 13.5,
        practice_score: 13.5,
        participation_score: 10,
        participation_weight: 0.05,
      })
      .select('status')
      .single()

    expect(error).toBeNull()
    expect(data!.status).toBe('aprobado')
  })

  it('reprueba cuando la nota queda debajo del umbral', async () => {
    const modulo3 = await moduloPorOrden(3) // umbral 12
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Reprueba', '2005-01-01', cohorte)

    const { data, error } = await admin
      .from('module_enrollments')
      .insert({
        student_id: estudiante,
        module_id: modulo3,
        cohort_id: cohorte,
        theory_score: 11.9,
        practice_score: 11.9,
        participation_score: 11.9,
        participation_weight: 0.05,
      })
      .select('status, final_score')
      .single()

    expect(error).toBeNull()
    expect(Number(data!.final_score)).toBeLessThan(12)
    expect(data!.status).toBe('reprobado')
  })

  it('rechaza un peso de participación por debajo del mínimo (5%)', async () => {
    const modulo1 = await moduloPorOrden(1)
    const cohorte = await crearCohorte(modulo1)
    const estudiante = await crearEstudiante('Test Peso Minimo', '2005-01-01', cohorte)

    const { error } = await admin.from('module_enrollments').insert({
      student_id: estudiante,
      module_id: modulo1,
      cohort_id: cohorte,
      participation_weight: 0.04,
    })

    expect(error).not.toBeNull()
  })

  it('un estudiante sin asistencia y con notas suficientes sigue aprobado — nunca reprueba por faltas', async () => {
    const modulo1 = await moduloPorOrden(1) // umbral 10
    const cohorte = await crearCohorte(modulo1)
    const estudiante = await crearEstudiante('Test Sin Faltas', '2005-01-01', cohorte)

    const { data, error } = await admin
      .from('module_enrollments')
      .insert({
        student_id: estudiante,
        module_id: modulo1,
        cohort_id: cohorte,
        theory_score: 15,
        practice_score: 15,
        participation_score: 15,
        participation_weight: 0.05,
      })
      .select('status')
      .single()

    // Cero asistencia: no se inserta ningún attendance_event para este
    // estudiante. No existe ningún disparador que lea attendance_events al
    // calcular el estado — si lo hubiera, esta prueba lo detectaría porque
    // el estado seguiría siendo 'aprobado' de todas formas.
    expect(error).toBeNull()
    expect(data!.status).toBe('aprobado')
  })
})

describe('Reglas de negocio — consentimiento parental (LOPNNA)', () => {
  it('rechaza completar el registro de un menor sin consentimiento', async () => {
    const hace16Anios = new Date()
    hace16Anios.setFullYear(hace16Anios.getFullYear() - 16)
    const estudiante = await crearEstudiante('Test Menor Sin Consentimiento', hace16Anios.toISOString().slice(0, 10))

    const { error } = await admin
      .from('students')
      .update({ onboarding_status: 'completo' })
      .eq('id', estudiante)

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/LOPNNA/)
  })

  it('permite completar el registro de un menor CON consentimiento', async () => {
    const hace16Anios = new Date()
    hace16Anios.setFullYear(hace16Anios.getFullYear() - 16)
    const estudiante = await crearEstudiante('Test Menor Con Consentimiento', hace16Anios.toISOString().slice(0, 10))

    const { error: falloConsentimiento } = await admin.from('parental_consents').insert({
      student_id: estudiante,
      consent_type: 'account_creation',
      representative_name: 'Representante de Prueba',
      representative_cedula: 'V-1234567',
      representative_email: 'representante@correo.test',
      method: 'digital',
    })
    expect(falloConsentimiento).toBeNull()

    const { error } = await admin
      .from('students')
      .update({ onboarding_status: 'completo' })
      .eq('id', estudiante)

    expect(error).toBeNull()
  })

  it('un mayor de edad completa el registro sin necesitar consentimiento', async () => {
    const estudiante = await crearEstudiante('Test Mayor De Edad', '2005-01-01') // 20+ años

    const { error } = await admin
      .from('students')
      .update({ onboarding_status: 'completo' })
      .eq('id', estudiante)

    expect(error).toBeNull()
  })
})

describe('Reglas de negocio — asistencia', () => {
  async function crearCohorteYSesion(estado: 'programada' | 'abierta') {
    const modulo1 = await moduloPorOrden(1)
    const cohorteId = await crearCohorte(modulo1)

    const { data: sesion } = await admin
      .from('class_sessions')
      .insert({
        cohort_id: cohorteId,
        module_id: modulo1,
        session_date: new Date(Date.now() + 86_400_000 * Math.floor(Math.random() * 9000)).toISOString().slice(0, 10),
        week_number: 1,
        status: estado,
      })
      .select('id')
      .single()

    return { cohorteId, sesionId: sesion!.id as string }
  }

  it('no deja registrar asistencia dos veces para el mismo estudiante en la misma sesión', async () => {
    const { cohorteId, sesionId } = await crearCohorteYSesion('abierta')
    const estudiante = await crearEstudiante('Test Asistencia Duplicada', '2005-01-01', cohorteId)

    const { error: primera } = await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba',
    })
    expect(primera).toBeNull()

    const { error: segunda } = await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba otra vez',
    })
    expect(segunda).not.toBeNull()
  })

  it('rechaza asistencia en una sesión que no está abierta', async () => {
    const { cohorteId, sesionId } = await crearCohorteYSesion('programada')
    const estudiante = await crearEstudiante('Test Sesion No Abierta', '2005-01-01', cohorteId)

    const { error } = await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba',
    })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/no está abierta/)
  })

  it('rechaza asistencia de un estudiante que pertenece a otra cohorte', async () => {
    const { sesionId } = await crearCohorteYSesion('abierta')
    // Cohorte del estudiante es null, no coincide con la de la sesión.
    const estudiante = await crearEstudiante('Test Cohorte Equivocada', '2005-01-01')

    const { error } = await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba',
    })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/no pertenece a la cohorte/)
  })

  it('no deja entregar el refrigerio dos veces', async () => {
    const { cohorteId, sesionId } = await crearCohorteYSesion('abierta')
    const estudiante = await crearEstudiante('Test Refrigerio Doble', '2005-01-01', cohorteId)

    await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba',
    })

    const { error: primera } = await admin
      .from('attendance_events')
      .update({ snack_claimed_at: new Date().toISOString() })
      .eq('session_id', sesionId)
      .eq('student_id', estudiante)
    expect(primera).toBeNull()

    const { error: segunda } = await admin
      .from('attendance_events')
      .update({ snack_claimed_at: new Date().toISOString() })
      .eq('session_id', sesionId)
      .eq('student_id', estudiante)
    expect(segunda).not.toBeNull()
  })

  it('una asistencia ya registrada no se puede borrar', async () => {
    const { cohorteId, sesionId } = await crearCohorteYSesion('abierta')
    const estudiante = await crearEstudiante('Test Asistencia Inmutable', '2005-01-01', cohorteId)

    await admin.from('attendance_events').insert({
      session_id: sesionId,
      student_id: estudiante,
      scanned_by: estudiante,
      method: 'manual',
      manual_reason: 'prueba',
    })

    const { error } = await admin
      .from('attendance_events')
      .delete()
      .eq('session_id', sesionId)
      .eq('student_id', estudiante)

    expect(error).not.toBeNull()
  })
})

describe('Reglas de negocio — auditoría', () => {
  it('una fila de audit_log no se puede editar', async () => {
    const { data: fila } = await admin.from('audit_log').select('id').limit(1).maybeSingle()

    // Si todavía no hay ninguna fila (base recién reseteada), se genera una
    // con una acción cualquiera antes de intentar el bloqueo.
    let idFila = fila?.id
    if (!idFila) {
      const modulo1 = await moduloPorOrden(1)
      const { data: programa } = await admin.from('programs').select('id').limit(1).single()
      const { data: cohorte } = await admin
        .from('cohorts')
        .insert({ program_id: programa!.id, name: `Cohorte Audit ${randomUUID()}`, current_module_id: modulo1 })
        .select('id')
        .single()
      const { data: otraFila } = await admin.from('audit_log').select('id').eq('entity_id', cohorte!.id).single()
      idFila = otraFila!.id
    }

    const { error } = await admin.from('audit_log').update({ action: 'update' }).eq('id', idFila)
    expect(error).not.toBeNull()
  })
})

describe('Reglas de negocio — exámenes y feedback', () => {
  async function crearProfesorYCohorte() {
    const cedula = cedulaAlAzar('8')
    const { data } = await admin.auth.admin.createUser({
      email: `${cedula.toLowerCase().replace('-', '')}@correo.test`,
      password: 'Prueba123!',
      email_confirm: true,
      user_metadata: { cedula, full_name: 'Prof. Test' },
    })
    const idProfesor = data.user!.id
    idsACrear.push(idProfesor)

    // on_auth_user_created siempre crea el perfil como 'estudiante' — hay
    // que subirlo a profesor después, tal como lo haría un admin real.
    await admin.from('profiles').update({ role: 'profesor' }).eq('id', idProfesor)
    await admin.from('teachers').insert({ id: idProfesor, is_active: true })

    const modulo1 = await moduloPorOrden(1)
    const { data: programa } = await admin.from('programs').select('id').limit(1).single()
    const { data: cohorte } = await admin
      .from('cohorts')
      .insert({ program_id: programa!.id, name: `Cohorte Examen ${randomUUID()}`, current_module_id: modulo1, teacher_id: idProfesor })
      .select('id')
      .single()

    return { idProfesor, cohorteId: cohorte!.id as string, moduloId: modulo1 }
  }

  it('rechaza publicar un examen cuyas preguntas no suman el puntaje máximo', async () => {
    const { idProfesor, cohorteId, moduloId } = await crearProfesorYCohorte()

    const { data: examen } = await admin
      .from('exams')
      .insert({
        module_id: moduloId,
        cohort_id: cohorteId,
        teacher_id: idProfesor,
        title: 'Examen Test Puntos',
        max_score: 20,
        status: 'oculto',
      })
      .select('id')
      .single()

    await admin.from('exam_questions').insert({
      exam_id: examen!.id,
      order_index: 1,
      type: 'verdadero_falso',
      statement: '¿Pregunta de prueba?',
      correct_answer: true as unknown as never,
      points: 18, // 18 de 20: no cuadra
    })

    const { error } = await admin
      .from('exams')
      .update({ status: 'habilitado' })
      .eq('id', examen!.id)

    expect(error).not.toBeNull()
  })

  it('rechaza un feedback micro con más preguntas de las permitidas (3)', async () => {
    const { cohorteId, moduloId } = await crearProfesorYCohorte()
    const estudiante = await crearEstudiante('Test Feedback Largo', '2005-01-01', cohorteId)

    const { data: sesion } = await admin
      .from('class_sessions')
      .insert({
        cohort_id: cohorteId,
        module_id: moduloId,
        session_date: new Date().toISOString().slice(0, 10),
        week_number: 1,
        status: 'cerrada',
      })
      .select('id')
      .single()

    const { error } = await admin.from('feedback_micro').insert({
      student_id: estudiante,
      session_id: sesion!.id,
      answers: [
        { q: '¿Uno?', a: 4 },
        { q: '¿Dos?', a: 3 },
        { q: '¿Tres?', a: 5 },
        { q: '¿Cuatro? — de más', a: 2 },
      ],
    })

    expect(error).not.toBeNull()
  })

  it('un intento pasa a calificado solo cuando se califica la última respuesta pendiente', async () => {
    const { idProfesor, cohorteId, moduloId } = await crearProfesorYCohorte()
    const estudiante = await crearEstudiante('Test Cierre Intento', '2005-01-01', cohorteId)

    const { data: examen } = await admin
      .from('exams')
      .insert({
        module_id: moduloId,
        cohort_id: cohorteId,
        teacher_id: idProfesor,
        title: 'Examen Test Cierre',
        max_score: 10,
        status: 'habilitado',
      })
      .select('id')
      .single()

    const { data: preguntaObjetiva } = await admin
      .from('exam_questions')
      .insert({
        exam_id: examen!.id,
        order_index: 1,
        type: 'verdadero_falso',
        statement: 'Pregunta objetiva',
        correct_answer: true as unknown as never,
        points: 5,
      })
      .select('id')
      .single()

    const { data: preguntaAbierta } = await admin
      .from('exam_questions')
      .insert({
        exam_id: examen!.id,
        order_index: 2,
        type: 'redaccion_abierta',
        statement: 'Pregunta abierta',
        points: 5,
      })
      .select('id')
      .single()

    const { data: intento } = await admin
      .from('exam_attempts')
      .insert({ exam_id: examen!.id, student_id: estudiante, status: 'entregado' })
      .select('id')
      .single()

    // La abierta se crea PRIMERO y sin puntaje. Si la objetiva se insertara
    // primero, el disparador de cierre contaría cero pendientes en ese
    // instante (la fila abierta todavía no existiría) y cerraría el intento
    // antes de tiempo — por eso el orden importa en esta prueba.
    await admin.from('exam_answers').insert({
      attempt_id: intento!.id,
      question_id: preguntaAbierta!.id,
      answer: { text: 'Respuesta de prueba' } as unknown as never,
    })

    // La objetiva ya viene calificada (simulando lo que hace submit-attempt).
    await admin.from('exam_answers').insert({
      attempt_id: intento!.id,
      question_id: preguntaObjetiva!.id,
      answer: true as unknown as never,
      awarded_points: 5,
    })

    const { data: intentoAMedias } = await admin
      .from('exam_attempts')
      .select('status')
      .eq('id', intento!.id)
      .single()
    expect(intentoAMedias!.status).toBe('entregado')

    // Se califica la última pendiente: ahora sí debe cerrar.
    await admin
      .from('exam_answers')
      .update({ awarded_points: 4 })
      .eq('attempt_id', intento!.id)
      .eq('question_id', preguntaAbierta!.id)

    const { data: intentoCerrado } = await admin
      .from('exam_attempts')
      .select('status, total_score')
      .eq('id', intento!.id)
      .single()

    expect(intentoCerrado!.status).toBe('calificado')
    expect(Number(intentoCerrado!.total_score)).toBe(9)
  })
})
