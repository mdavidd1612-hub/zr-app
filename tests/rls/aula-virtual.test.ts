import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Aula Virtual (spec/07_AULA_VIRTUAL.md, migraciones 174-180).
 *
 * No repite todo lo que ya se verificó a mano contra staging durante la
 * construcción (eso está en los mensajes de los commits) -- esto es la red
 * de seguridad permanente: los dos hallazgos de seguridad reales que se
 * encontraron y corrigieron en el camino (unit_prerequisite_met /
 * fn_unit_required_complete espiando a otro estudiante, un estudiante
 * marcándose su propia duda como FAQ), más el aislamiento básico entre
 * módulos, que es la base de todo lo demás.
 *
 * Usa los mismos A/B del seed local que acceso-cruzado.test.ts (misma
 * cohorte a propósito) y crea las unidades/exámenes de prueba con el
 * cliente de servicio, que sí puede saltarse RLS para armar el escenario.
 */

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PASS         = 'Prueba123!'

const admin = createClient(URL, SERVICE_KEY)

async function entrar(cedula: string) {
  const c = createClient(URL, ANON)
  const { data, error } = await c.auth.signInWithPassword({
    email: `${cedula}@estudiante.zrmecademy.com`,
    password: PASS,
  })
  if (error) throw error
  return { cliente: c, id: data.user!.id }
}

describe('Aula Virtual — RLS y guardas de seguridad', () => {
  let cliA: Awaited<ReturnType<typeof entrar>>['cliente']
  let cliB: Awaited<ReturnType<typeof entrar>>['cliente']
  let idA: string
  let idB: string
  let moduloA: string
  let moduloOtro: string
  let unidadModuloA: string
  let unidadOtroModulo: string
  let examenCert: string
  let dudaDeA: string

  beforeAll(async () => {
    const a = await entrar('V-30000001')
    const b = await entrar('V-30000002')
    cliA = a.cliente; idA = a.id
    cliB = b.cliente; idB = b.id

    const { data: cohA } = await admin
      .from('students').select('cohort_id, cohorts(current_module_id)')
      .eq('id', idA).single()
    moduloA = (cohA as unknown as { cohorts: { current_module_id: string } }).cohorts.current_module_id

    const { data: otroModulo } = await admin
      .from('modules').select('id').neq('id', moduloA).limit(1).single()
    moduloOtro = otroModulo!.id

    const { data: u1 } = await admin.from('units').insert({
      module_id: moduloA, title: 'RLS — unidad del módulo de A', order_index: 9001, open_at: new Date().toISOString(),
    }).select('id').single()
    unidadModuloA = u1!.id

    const { data: u2 } = await admin.from('units').insert({
      module_id: moduloOtro, title: 'RLS — unidad de otro módulo', order_index: 9001, open_at: new Date().toISOString(),
    }).select('id').single()
    unidadOtroModulo = u2!.id

    const { data: teacher } = await admin.from('teachers').select('id').limit(1).single()
    const { data: exam } = await admin.from('exams').insert({
      module_id: moduloA, teacher_id: teacher!.id, title: 'RLS — certificación', status: 'habilitado',
      max_score: 20, passing_score: 10, kind: 'certificacion', unit_id: unidadOtroModulo,
    }).select('id').single()
    examenCert = exam!.id

    const { data: duda } = await admin.from('doubts').insert({
      student_id: idA, body: 'Duda de prueba RLS', unit_id: unidadModuloA,
    }).select('id').single()
    dudaDeA = duda!.id
  })

  afterAll(async () => {
    await admin.from('doubts').delete().eq('id', dudaDeA)
    await admin.from('exams').delete().eq('id', examenCert)
    await admin.from('units').delete().in('id', [unidadModuloA, unidadOtroModulo])
  })

  it('un estudiante no ve unidades de otro módulo', async () => {
    const { data } = await cliA.from('units').select('id').eq('id', unidadOtroModulo)
    expect(data).toHaveLength(0)
  })

  it('un estudiante sí ve las unidades abiertas de su propio módulo', async () => {
    const { data } = await cliA.from('units').select('id').eq('id', unidadModuloA)
    expect(data).toHaveLength(1)
  })

  it('unit_prerequisite_met rechaza preguntar por OTRO estudiante', async () => {
    const { data, error } = await cliB.rpc('unit_prerequisite_met', {
      p_unit_id: unidadModuloA, p_student_id: idA,
    })
    // La guarda devuelve false en vez de lanzar error (ver 176) -- lo que
    // importa es que NUNCA devuelva el resultado real de otro estudiante.
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('unit_prerequisite_met sí responde por uno mismo', async () => {
    const { data, error } = await cliA.rpc('unit_prerequisite_met', {
      p_unit_id: unidadModuloA, p_student_id: idA,
    })
    expect(error).toBeNull()
    expect(typeof data).toBe('boolean')
  })

  it('fn_unit_required_complete rechaza preguntar por OTRO estudiante', async () => {
    const { data, error } = await cliB.rpc('fn_unit_required_complete', {
      p_unit_id: unidadModuloA, p_student_id: idA,
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('un estudiante no puede crear un intento de examen para OTRO estudiante', async () => {
    const { error } = await cliA.from('exam_attempts').insert({
      exam_id: examenCert, student_id: idB,
    } as never)
    expect(error).not.toBeNull()
  })

  it('un estudiante no puede auto-marcar su material como validado', async () => {
    const { data: ci } = await admin.from('content_items').select('id').eq('module_id', moduloA).limit(1).single()
    if (!ci) return // módulo sin contenido en este seed; no hay nada que probar

    await cliA.from('material_progress').upsert({
      student_id: idA, content_item_id: ci.id, percent: 50,
    } as never)

    const { error } = await cliA.from('material_progress')
      .update({ validated: true } as never)
      .eq('student_id', idA).eq('content_item_id', ci.id)

    expect(error).not.toBeNull()

    await admin.from('material_progress').delete().eq('student_id', idA).eq('content_item_id', ci.id)
  })

  it('un estudiante no puede marcar su propia duda como FAQ', async () => {
    const { error } = await cliA.from('doubts')
      .update({ is_faq: true } as never)
      .eq('id', dudaDeA)
    expect(error).not.toBeNull()
  })

  it('un estudiante sí puede marcar su propia duda como resuelta', async () => {
    const { error, data } = await cliA.from('doubts')
      .update({ status: 'resuelta' } as never)
      .eq('id', dudaDeA)
      .select('status')
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('resuelta')
  })

  it('un estudiante no puede marcar una respuesta de duda como oficial', async () => {
    const { error } = await cliA.from('doubt_responses').insert({
      doubt_id: dudaDeA, responder_id: idA, body: 'Respuesta de prueba', is_official: true,
    } as never)
    expect(error).not.toBeNull()
  })

  it('fn_calendar_ical rechaza exportar el calendario de OTRO estudiante', async () => {
    const { error } = await cliB.rpc('fn_calendar_ical', { p_student_id: idA })
    expect(error).not.toBeNull()
  })
})
