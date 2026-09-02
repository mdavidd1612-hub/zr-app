import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Migración 059 · Borrar la cuenta de un estudiante que tiene asistencia.
 *
 * El bug que esto impide que vuelva: `attendance_events.scanned_by` tiene
 * ON DELETE SET NULL, así que borrar una cuenta hace que Postgres actualice esa
 * columna a NULL. El guard `fn_attendance_guard` trataba `scanned_by` como
 * inmutable y rechazaba ese UPDATE, con lo que el borrado fallaba entero con el
 * mensaje genérico "Database error deleting user".
 *
 * Solo se notaba con quien había aparecido como su propio escaneador —el
 * auto-registro con código diario de la migración 037—, así que borrar unas
 * cuentas funcionaba y otras no, sin patrón visible desde la pantalla.
 *
 * Ya había pasado media vez: la migración 028 arregló el DELETE y dejó el
 * UPDATE sin arreglar. Por eso esto se prueba.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE_KEY)

const ANIO = 2098
const usuariosACrear: string[] = []
const cohortesACrear: string[] = []

let cohortId = ''
let sessionId = ''

beforeAll(async () => {
  const { data: programa, error: fp } = await admin
    .from('programs').select('id').order('name').limit(1).single()
  if (fp) throw fp

  const { data: modulo, error: fm } = await admin
    .from('modules').select('id').eq('program_id', programa.id).order('order_index').limit(1).single()
  if (fm) throw fm

  const { data: cohorte, error: fc } = await admin.from('cohorts').insert({
    program_id: programa.id,
    name: `PRUEBA-BORRADO-${ANIO}`,
    start_date: `${ANIO}-03-07`,
    status: 'activa',
    current_module_id: modulo.id,
  }).select('id').single()
  if (fc) throw fc
  cohortId = cohorte.id
  cohortesACrear.push(cohorte.id)

  const { data: sesion, error: fs } = await admin.from('class_sessions').insert({
    cohort_id: cohortId,
    module_id: modulo.id,
    session_date: `${ANIO}-03-07`,
    week_number: 1,
  }).select('id').single()
  if (fs) throw fs
  sessionId = sesion.id
})

afterAll(async () => {
  for (const id of usuariosACrear) await admin.auth.admin.deleteUser(id)
  if (sessionId) await admin.from('class_sessions').delete().eq('id', sessionId)
  for (const id of cohortesACrear) await admin.from('cohorts').delete().eq('id', id)
})

async function crearEstudianteConAsistenciaPropia() {
  const cedula = `V-98${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`
  const { data: auth, error } = await admin.auth.admin.createUser({
    email: `${cedula}@estudiante.zrmecademy.com`,
    password: 'Prueba123!',
    email_confirm: true,
    user_metadata: { cedula, full_name: 'Estudiante Que Se Autoregistra' },
  })
  if (error) throw error
  const id = auth.user!.id

  const { error: fe } = await admin.from('students').insert({
    id, birth_date: '2005-01-01', cohort_id: cohortId, enrollment_date: `${ANIO}-03-07`,
  })
  if (fe) throw fe

  // El caso que rompía: el estudiante figura como su propio escaneador.
  const { error: fa } = await admin.from('attendance_events').insert({
    session_id: sessionId, student_id: id, scanned_by: id, method: 'qr',
  })
  if (fa) throw fa

  return id
}

describe('Borrar la cuenta de un estudiante', () => {
  it('funciona aunque él mismo figure como quien registró su asistencia', async () => {
    const id = await crearEstudianteConAsistenciaPropia()

    const { error } = await admin.auth.admin.deleteUser(id)
    expect(error).toBeNull()

    const { data } = await admin.from('profiles').select('id').eq('id', id)
    expect(data).toHaveLength(0)
  })

  it('sigue sin permitir reasignar una asistencia a otra persona', async () => {
    // Lo que el guard SÍ debe seguir bloqueando: cambiar quién escaneó por
    // alguien distinto. Solo se permite pasar a NULL (anonimizar).
    const id = await crearEstudianteConAsistenciaPropia()
    usuariosACrear.push(id)

    const { data: otro } = await admin.from('profiles')
      .select('id').neq('id', id).limit(1).single()

    const { error } = await admin.from('attendance_events')
      .update({ scanned_by: otro!.id }).eq('student_id', id)

    expect(error).not.toBeNull()
  })
})
