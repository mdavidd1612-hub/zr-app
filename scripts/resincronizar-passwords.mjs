// =============================================================================
// ZR APP · Resincronizar contraseñas con el código de carnet  (R-02)
// =============================================================================
// Cuándo se corre: después de la migración 058, o cada vez que por alguna razón
// cambie el código de carnet de alguien ya inscrito.
//
// Por qué existe: el código de carnet ES la contraseña de primer ingreso
// (supabase/functions/create-student/index.ts). Si el código cambia y la
// contraseña no, el estudiante se queda afuera de la app sin saber por qué.
//
// Lo que NO hace: tocarle la contraseña a quien ya la cambió por su cuenta.
// Eso no se puede saber con certeza desde la base, así que se usa una señal
// conservadora — si el estudiante ya aceptó los términos, ya entró y pudo
// haberla cambiado — y ante la duda NO se toca: se lista aparte para que
// administración lo llame. Es preferible avisarle de más a una persona que
// pisarle la contraseña a alguien que ya estaba adentro.
//
//   node scripts/resincronizar-passwords.mjs                        → simulacro
//   node scripts/resincronizar-passwords.mjs --aplicar              → escribe
//   node scripts/resincronizar-passwords.mjs --env=.env.production  → contra prod
//
// OJO con el entorno: por defecto lee `.env.local`, que en este repo apunta a la
// base LOCAL (127.0.0.1:54321). Para tocar producción hay que pasar `--env`
// explícitamente — que cambiarle la contraseña a un estudiante real nunca sea
// algo que pase por olvidar un parámetro.
//
// Deja el detalle en scripts/salida/passwords-<fecha>.csv para administración.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { config } from 'dotenv'

const APLICAR = process.argv.includes('--aplicar')
const ENV = process.argv.find((a) => a.startsWith('--env='))?.slice(6) ?? '.env.local'

config({ path: ENV })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(`Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${ENV}`)
  process.exit(1)
}

console.log(`Base de datos: ${url}${APLICAR ? '  ·  MODO ESCRITURA' : '  ·  simulacro'}`)

// service_role: esto corre en tu máquina o en un servidor, nunca en el
// navegador (regla 4 de AGENTS.md).
const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data: estudiantes, error } = await sb
  .from('students')
  .select('id, student_code, profiles!students_id_fkey(cedula, full_name)')
  .not('cohort_id', 'is', null)

if (error) {
  console.error('No se pudo leer la lista de estudiantes:', error.message)
  process.exit(1)
}

// Quien ya aceptó los términos ya entró a la app, así que pudo haber cambiado
// su contraseña. A ese no se le toca nada.
const { data: aceptaciones } = await sb.from('terms_acceptances').select('user_id')
const yaEntraron = new Set((aceptaciones ?? []).map((a) => a.user_id))

const cambiados = []
const omitidos = []
const fallidos = []

for (const e of estudiantes ?? []) {
  const perfil = e.profiles ?? {}
  const fila = {
    cedula: perfil.cedula ?? '—',
    nombre: perfil.full_name ?? '—',
    codigo: e.student_code ?? '—',
  }

  if (!e.student_code || e.student_code.startsWith('ZR-PENDIENTE-')) {
    omitidos.push({ ...fila, motivo: 'Sin código válido: revisar su cohorte antes de nada' })
    continue
  }

  if (yaEntraron.has(e.id)) {
    omitidos.push({ ...fila, motivo: 'Ya entró a la app: puede tener contraseña propia, llamarlo' })
    continue
  }

  if (!APLICAR) {
    cambiados.push({ ...fila, motivo: 'Se le pondría el código como contraseña' })
    continue
  }

  const { error: fallo } = await sb.auth.admin.updateUserById(e.id, { password: e.student_code })

  if (fallo) fallidos.push({ ...fila, motivo: fallo.message })
  else cambiados.push({ ...fila, motivo: 'Contraseña = código de carnet' })
}

const filas = [
  ...cambiados.map((f) => ({ ...f, resultado: APLICAR ? 'ACTUALIZADO' : 'SIMULACRO' })),
  ...omitidos.map((f) => ({ ...f, resultado: 'OMITIDO' })),
  ...fallidos.map((f) => ({ ...f, resultado: 'FALLÓ' })),
]

mkdirSync('scripts/salida', { recursive: true })
const archivo = `scripts/salida/passwords-${new Date().toISOString().slice(0, 10)}.csv`
writeFileSync(
  archivo,
  ['cedula,nombre,codigo,resultado,motivo']
    .concat(filas.map((f) => [f.cedula, f.nombre, f.codigo, f.resultado, f.motivo]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')))
    .join('\n'),
  'utf8',
)

console.log(APLICAR ? '\n== APLICADO ==' : '\n== SIMULACRO (nada se escribió) ==')
console.log(`  Con contraseña sincronizada : ${cambiados.length}`)
console.log(`  Omitidos (revisar a mano)   : ${omitidos.length}`)
console.log(`  Fallidos                    : ${fallidos.length}`)
console.log(`\nDetalle para administración: ${archivo}`)
if (!APLICAR) console.log('Para escribir de verdad: node scripts/resincronizar-passwords.mjs --aplicar')
