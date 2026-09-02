import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * R-04 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md
 *
 * La red que impide que vuelva el bug más caro que ha tenido este proyecto.
 *
 * Contexto, para que nadie relaje estas pruebas sin entender qué sostienen:
 * el código de carnet (`students.student_code`) es TAMBIÉN la contraseña de
 * primer ingreso del estudiante, y es lo que se imprime en la planilla que
 * firma el representante. Si sale mal, el estudiante no puede entrar a la app
 * y hay que reimprimir y volver a firmar papel.
 *
 * Antes de la migración 057, `cohorts.code_number` no lo generaba nadie: las
 * pantallas que crean cohortes no escribían esa columna, así que la cohorte
 * nacía con NULL y todos sus estudiantes recibían 'ZR-PENDIENTE-xxxxxxxx'.
 *
 * Corren con service_role contra la base LOCAL, igual que negocio.test.ts:
 * lo que se prueba son los triggers de la base, no los permisos.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE_KEY)

// Un año que ninguna cohorte real usa, para que el correlativo arranque
// siempre en 1 y las pruebas no dependan de cuántas cohortes haya cargadas.
const ANIO = 2099
const INICIO = `${ANIO}-03-07`

const cohortesACrear: string[] = []
const usuariosACrear: string[] = []

let programId = ''
let programName = ''

async function crearCohorte(nombre: string, codeNumber?: number) {
  const { data, error } = await admin.from('cohorts').insert({
    program_id: programId,
    name: nombre,
    start_date: INICIO,
    status: 'activa',
    ...(codeNumber !== undefined ? { code_number: codeNumber } : {}),
  }).select('id, code_number').single()
  if (error) throw error
  cohortesACrear.push(data.id)
  return data
}

beforeAll(async () => {
  const { data, error } = await admin.from('programs').select('id, name').order('name').limit(1).single()
  if (error) throw error
  programId = data.id
  programName = data.name
})

afterAll(async () => {
  for (const id of usuariosACrear) await admin.auth.admin.deleteUser(id)
  for (const id of cohortesACrear) await admin.from('cohorts').delete().eq('id', id)
})

describe('Correlativo de cohorte (code_number)', () => {
  it('lo asigna el servidor aunque la pantalla no lo mande', async () => {
    const primera = await crearCohorte(`PRUEBA-${ANIO}-A`)
    expect(primera.code_number).toBe(1)
  })

  it('sigue la numeración dentro del mismo programa y año', async () => {
    const segunda = await crearCohorte(`PRUEBA-${ANIO}-B`)
    expect(segunda.code_number).toBe(2)
  })

  it('no deja repetir el número dentro del mismo programa y año', async () => {
    // El índice único de la migración 057. Sin él, dos cohortes podrían
    // compartir número y dos estudiantes terminarían con el mismo código de
    // carnet — es decir, con la misma contraseña.
    const { error } = await admin.from('cohorts').insert({
      program_id: programId,
      name: `PRUEBA-${ANIO}-C`,
      start_date: INICIO,
      status: 'activa',
      code_number: 1,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })
})

describe('Código de carnet del estudiante', () => {
  it('nunca queda en ZR-PENDIENTE al inscribir en una cohorte recién creada', async () => {
    const cohorte = await crearCohorte(`PRUEBA-${ANIO}-D`)

    const cedula = `V-99${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`
    const { data: auth, error: falloAuth } = await admin.auth.admin.createUser({
      email: `${cedula}@estudiante.zrmecademy.com`,
      password: 'Prueba123!',
      email_confirm: true,
      user_metadata: { cedula, full_name: 'Estudiante De Prueba' },
    })
    if (falloAuth) throw falloAuth
    usuariosACrear.push(auth.user!.id)

    const { data: estudiante, error } = await admin.from('students').insert({
      id: auth.user!.id,
      birth_date: '2005-01-01',
      cohort_id: cohorte.id,
      enrollment_date: INICIO,
    }).select('student_code').single()
    if (error) throw error

    // Lo que de verdad importa: que se pueda entrar a la app con esto.
    expect(estudiante.student_code).not.toMatch(/^ZR-PENDIENTE-/)

    // Y que tenga la forma real: <SIGLAS>-<AÑO>-<CORTE 2 dígitos>-<3 de la cédula>
    const siglas = programName.startsWith('PTMA') ? 'PTMA' : 'PFTA'
    expect(estudiante.student_code).toMatch(
      new RegExp(`^${siglas}-${ANIO}-0${cohorte.code_number}-\\d{3}$`),
    )
  })
})
