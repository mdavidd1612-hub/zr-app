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
const cohortesACrear: string[] = []
const definicionesACrear: string[] = []

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
  cohortesACrear.push(cohorte!.id as string)
  return cohorte!.id as string
}

afterAll(async () => {
  // Las evaluaciones de prueba cuentan para el 100 % del módulo: se quitan siempre.
  for (const id of definicionesACrear) {
    try { await admin.from('manual_exam_definitions').delete().eq('id', id) } catch { /* ya no existe */ }
  }
  // Los estudiantes de prueba tienen que dejar de apuntar a la cohorte
  // ANTES de borrarla — students.cohort_id no tiene on delete cascade
  // porque perder a un estudiante nunca debe borrar la cohorte de otros.
  for (const id of idsACrear) {
    try { await admin.from('students').update({ cohort_id: null }).eq('id', id) } catch { /* ya no existe */ }
  }
  // Borrar auth.users arrastra profiles/students/enrollments/etc. por cascade.
  for (const id of idsACrear) {
    try { await admin.auth.admin.deleteUser(id) } catch { /* ya no existe */ }
  }
  // class_sessions referencia cohorts. Si alguna sesión tiene asistencia
  // registrada, este delete falla a propósito — attendance_events es
  // de solo-inserción incluso vía cascada — y esa cohorte queda huérfana.
  // Es aceptable: son filas de desarrollo local, no de producción.
  for (const id of cohortesACrear) {
    try { await admin.from('class_sessions').delete().eq('cohort_id', id) } catch { /* tiene asistencia: se queda */ }
  }
  for (const id of cohortesACrear) {
    try { await admin.from('cohorts').delete().eq('id', id) } catch { /* referenciada por algo con asistencia */ }
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

  // Migración 143: cada evaluación vale un porcentaje; la nota del módulo es la
  // suma ponderada de lo calificado + la participación (que vale lo que fije el
  // módulo, entre el mínimo y el máximo de system_config). Ya no hay
  // teoría / práctica / puntualidad.
  async function evaluacion(moduloId: string, pesoPct: number, titulo: string) {
    const { data, error } = await admin
      .from('manual_exam_definitions')
      .insert({ module_id: moduloId, exam_date: '2026-01-10', title: titulo, weight_pct: pesoPct, kind: 'examen' })
      .select('id')
      .single()
    expect(error).toBeNull()
    definicionesACrear.push(data!.id)
    return data!.id as string
  }

  async function matricular(estudiante: string, modulo: string, cohorte: string) {
    const { error } = await admin
      .from('module_enrollments')
      .insert({ student_id: estudiante, module_id: modulo, cohort_id: cohorte })
    expect(error).toBeNull()
  }

  it('calcula la nota del módulo como suma ponderada de las evaluaciones y la participación', async () => {
    const modulo3 = await moduloPorOrden(3)
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Calculo Nota', '2005-01-01', cohorte)
    const ev1 = await evaluacion(modulo3, 60, 'Examen A')
    const ev2 = await evaluacion(modulo3, 35, 'Práctica B')
    await matricular(estudiante, modulo3, cohorte)

    await admin.from('manual_exam_scores').insert([
      { definition_id: ev1, student_id: estudiante, score: 16 },
      { definition_id: ev2, student_id: estudiante, score: 10 },
    ])
    const { data: parcial } = await admin
      .from('module_enrollments').select('final_score, evaluated_pct, status').eq('student_id', estudiante).single()
    // 16*0.60 + 10*0.35 = 13.1, y falta la participación: sigue en curso.
    expect(Number(parcial!.final_score)).toBe(13.1)
    expect(Number(parcial!.evaluated_pct)).toBe(95)
    expect(parcial!.status).toBe('en_curso')

    await admin.from('module_enrollments').update({ class_participation_score: 20 }).eq('student_id', estudiante)
    const { data } = await admin
      .from('module_enrollments').select('final_score, evaluated_pct').eq('student_id', estudiante).single()
    // + 20 * 0.05 = 14.1
    expect(Number(data!.final_score)).toBe(14.1)
    expect(Number(data!.evaluated_pct)).toBe(100)
  })

  it('aprueba cuando el módulo está completo y la nota alcanza el umbral', async () => {
    const modulo3 = await moduloPorOrden(3) // umbral 12
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Aprueba', '2005-01-01', cohorte)
    const ev = await evaluacion(modulo3, 95, 'Examen único')
    await matricular(estudiante, modulo3, cohorte)

    await admin.from('manual_exam_scores').insert({ definition_id: ev, student_id: estudiante, score: 13 })
    await admin.from('module_enrollments').update({ class_participation_score: 10 }).eq('student_id', estudiante)

    const { data } = await admin.from('module_enrollments').select('status').eq('student_id', estudiante).single()
    expect(data!.status).toBe('aprobado')
  })

  it('reprueba cuando el módulo está completo y la nota queda debajo del umbral', async () => {
    const modulo3 = await moduloPorOrden(3) // umbral 12
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test Reprueba', '2005-01-01', cohorte)
    const ev = await evaluacion(modulo3, 95, 'Examen único')
    await matricular(estudiante, modulo3, cohorte)

    await admin.from('manual_exam_scores').insert({ definition_id: ev, student_id: estudiante, score: 11 })
    await admin.from('module_enrollments').update({ class_participation_score: 11 }).eq('student_id', estudiante)

    const { data } = await admin
      .from('module_enrollments').select('status, final_score').eq('student_id', estudiante).single()
    expect(Number(data!.final_score)).toBeLessThan(12)
    expect(data!.status).toBe('reprobado')
  })

  it('no decide aprobado ni reprobado mientras el módulo no esté completamente evaluado', async () => {
    const modulo3 = await moduloPorOrden(3)
    const cohorte = await crearCohorte(modulo3)
    const estudiante = await crearEstudiante('Test En Curso', '2005-01-01', cohorte)
    const ev = await evaluacion(modulo3, 50, 'Examen parcial')
    await matricular(estudiante, modulo3, cohorte)

    await admin.from('manual_exam_scores').insert({ definition_id: ev, student_id: estudiante, score: 2 })
    const { data } = await admin.from('module_enrollments').select('status').eq('student_id', estudiante).single()
    expect(data!.status).toBe('en_curso')
  })

  it('rechaza evaluaciones cuyos porcentajes pasan de 100 con la participación', async () => {
    const modulo3 = await moduloPorOrden(3)
    await evaluacion(modulo3, 95, 'Completa')
    const { error } = await admin
      .from('manual_exam_definitions')
      .insert({ module_id: modulo3, exam_date: '2026-01-10', title: 'Sobra', weight_pct: 1, kind: 'examen' })
    expect(error).not.toBeNull()
  })

  it('rechaza un peso de participación fuera del rango (5 % a 10 %)', async () => {
    const modulo1 = await moduloPorOrden(1)
    const { error: bajo } = await admin.from('modules').update({ participation_pct: 4 }).eq('id', modulo1)
    expect(bajo).not.toBeNull()
    const { error: alto } = await admin.from('modules').update({ participation_pct: 11 }).eq('id', modulo1)
    expect(alto).not.toBeNull()
  })

  it('un estudiante sin asistencia y con notas suficientes sigue aprobado — nunca reprueba por faltas', async () => {
    const modulo1 = await moduloPorOrden(1) // umbral 10
    const cohorte = await crearCohorte(modulo1)
    const estudiante = await crearEstudiante('Test Sin Faltas', '2005-01-01', cohorte)
    const ev = await evaluacion(modulo1, 95, 'Examen único')
    await matricular(estudiante, modulo1, cohorte)

    await admin.from('manual_exam_scores').insert({ definition_id: ev, student_id: estudiante, score: 15 })
    await admin.from('module_enrollments').update({ class_participation_score: 15 }).eq('student_id', estudiante)
    const { data } = await admin.from('module_enrollments').select('status').eq('student_id', estudiante).single()

    // Cero asistencia: no se inserta ningún attendance_event para este
    // estudiante. No existe ningún disparador que lea attendance_events al
    // calcular el estado.
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
      const cohorteId = await crearCohorte(modulo1)
      const { data: otraFila } = await admin.from('audit_log').select('id').eq('entity_id', cohorteId).single()
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
    const cohorteId = await crearCohorte(modulo1, idProfesor)

    return { idProfesor, cohorteId, moduloId: modulo1 }
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
