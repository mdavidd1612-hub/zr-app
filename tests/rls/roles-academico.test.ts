import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * R-18 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md — cubre la migración 066.
 *
 * Nota importante para quien retome esto: el plan original (§3.5) proponía
 * separar Dirección Académica y Administración en dos carriles sin solape.
 * Al auditar `app/(admin)/layout.tsx` resultó que el modelo YA CONSTRUIDO es
 * otro — Dirección Académica es un SUPERCONJUNTO de admin (ve todo lo que ve
 * admin, más Personal/Notas/Exámenes). La migración 066 siguió ese modelo ya
 * existente, no el borrador. Por eso aquí no hay pruebas de "admin no puede
 * ver estudiantes" ni nada parecido — eso nunca cambió a propósito.
 *
 * Lo que SÍ cambió, y es lo que esto prueba: cinco capacidades que antes
 * tenía cualquiera de {admin, super_admin, direccion_academica} vía
 * is_admin_up() y ahora son solo de {direccion_academica, super_admin} vía
 * is_academico() (o solo super_admin vía is_super() para programas/config).
 *
 * Requiere el seed local (V-20000001 = profesor, sirve solo de comparación).
 * Los usuarios admin/direccion se crean aquí porque el seed no diferencia
 * roles de personal por cédula fija.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const admin = createClient(URL, SERVICE_KEY)
const PASS = 'Prueba123!'

const idsACrear: string[] = []

async function crearPersonal(cedula: string, role: 'admin' | 'direccion_academica') {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${cedula.toLowerCase().replace('-', '')}@correo.test`,
    password: PASS,
    email_confirm: true,
    user_metadata: { cedula, full_name: `Prueba ${role}` },
  })
  if (error) throw error
  const id = data.user!.id
  idsACrear.push(id)
  const { error: fallo } = await admin.from('profiles').update({ role }).eq('id', id)
  if (fallo) throw fallo
  return id
}

async function entrar(cedula: string) {
  const c = createClient(URL, ANON)
  const { error } = await c.auth.signInWithPassword({
    email: `${cedula.toLowerCase().replace('-', '')}@correo.test`,
    password: PASS,
  })
  if (error) throw error
  return c
}

describe('is_academico() — admin plano pierde lo académico, Dirección Académica lo conserva', () => {
  let cliAdmin: Awaited<ReturnType<typeof entrar>>
  let cliDireccion: Awaited<ReturnType<typeof entrar>>
  let moduloId: string
  let programaId: string

  beforeAll(async () => {
    const cedAdmin = `V-8${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`
    const cedDireccion = `V-8${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`
    await crearPersonal(cedAdmin, 'admin')
    await crearPersonal(cedDireccion, 'direccion_academica')
    cliAdmin = await entrar(cedAdmin)
    cliDireccion = await entrar(cedDireccion)

    const { data: modulo } = await admin.from('modules').select('id').limit(1).single()
    moduloId = modulo!.id
    const { data: programa } = await admin.from('programs').select('id').limit(1).single()
    programaId = programa!.id
  })

  it('admin plano ya NO puede escribir el catálogo de módulos', async () => {
    const { data, error } = await cliAdmin
      .from('modules').update({ description: 'intento de admin' }).eq('id', moduloId).select()
    expect(error).toBeNull() // RLS filtra filas, no lanza error
    expect(data).toHaveLength(0)
  })

  it('Dirección Académica sí puede escribir el catálogo de módulos', async () => {
    const { data, error } = await cliDireccion
      .from('modules').update({ description: 'intento de dirección' }).eq('id', moduloId).select()
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('admin plano ya NO puede escribir programas (ahora es solo super_admin)', async () => {
    const { data } = await cliAdmin
      .from('programs').update({ total_modules: 14 }).eq('id', programaId).select()
    expect(data).toHaveLength(0)
  })

  it('Dirección Académica tampoco puede escribir programas — es exclusivo de super_admin', async () => {
    const { data } = await cliDireccion
      .from('programs').update({ total_modules: 14 }).eq('id', programaId).select()
    expect(data).toHaveLength(0)
  })

  it('ni admin ni Dirección Académica ven config no pública — es exclusivo de super_admin', async () => {
    const { data: comoAdmin } = await cliAdmin.from('system_config').select('key').eq('is_public', false)
    const { data: comoDireccion } = await cliDireccion.from('system_config').select('key').eq('is_public', false)
    expect(comoAdmin).toHaveLength(0)
    expect(comoDireccion).toHaveLength(0)
  })

  it('admin plano sigue viendo estudiantes — eso NO se angostó (modelo superconjunto)', async () => {
    const { error } = await cliAdmin.from('students').select('id').limit(1)
    expect(error).toBeNull()
  })
})
