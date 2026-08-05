# 05 · PRUEBAS
> Las pruebas de seguridad de este archivo **bloquean el despliegue**. Si fallan, no se
> publica, aunque todo lo demás funcione.

---

## 1. LAS PRUEBAS DE ACCESO CRUZADO
**Las más importantes del proyecto.** Verifican que un estudiante no puede leer los datos de
otro. Si alguna falla, hay una fuga de datos de menores de edad.

Crea `tests/rls/acceso-cruzado.test.ts`:

```ts
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
```

**Cuando agregues una tabla nueva, agrega su prueba aquí en el mismo cambio.**

---

## 2. PRUEBAS DE REGLAS DE NEGOCIO

Crea `tests/reglas/negocio.test.ts`. Se ejecutan con el cliente de servicio contra la base
local.

| Prueba | Qué verifica | Resultado esperado |
|---|---|---|
| Umbral del primer módulo | Inscribir a un estudiante en el módulo con `order_index = 1` | `passing_threshold = 10` |
| Umbral del resto | Inscribir en el módulo 3 | `passing_threshold = 12` |
| Cálculo de nota | teoría 16, práctica 14, participación 20, peso 0,10 | `final_score = 15,50` |
| Aprobación | nota 12,5 con umbral 12 | `status = 'aprobado'` |
| Reprobación | nota 11,9 con umbral 12 | `status = 'reprobado'` |
| Peso mínimo | Intentar `participation_weight = 0.04` | La base lo rechaza |
| Sin baja automática | Un estudiante con cero asistencias y notas suficientes | Sigue `aprobado`. **Nunca reprueba por faltas** |
| Menor sin consentimiento | Poner `onboarding_status = 'completo'` a un menor sin consentimiento | La base lo rechaza con el mensaje de LOPNNA |
| Menor con consentimiento | Lo mismo, pero con consentimiento registrado | Funciona |
| Mayor de edad | Completar el registro de alguien de 20 años | Funciona sin consentimiento |
| Asistencia duplicada | Insertar dos veces el mismo `(session_id, student_id)` | La segunda falla por restricción única |
| Sesión cerrada | Registrar asistencia en una sesión `programada` | Rechazado: `SESION_NO_ABIERTA` |
| Cohorte equivocada | Registrar a un estudiante en la sesión de otra cohorte | Rechazado |
| Refrigerio doble | Marcar refrigerio dos veces | La segunda falla |
| Asistencia inmutable | Intentar borrar un `attendance_event` | Rechazado |
| Auditoría inmutable | Intentar editar una fila de `audit_log` | Rechazado |
| Puntos del examen | Publicar un examen cuyas preguntas suman 18 de 20 | Rechazado con el mensaje de puntos |
| Feedback largo | Enviar 4 preguntas de feedback | Rechazado |
| Cierre de intento | Calificar la última respuesta pendiente | El intento pasa solo a `calificado` con su total |

---

## 3. PRUEBAS DE INTERFAZ (Playwright)

Crea `tests/e2e/`. Cuatro recorridos, los que importan:

**`registro-menor.spec.ts`**
1. Ir a `/registro`, llenar con fecha de nacimiento de un menor de edad.
2. Verificar que **redirige a `/registro/consentimiento`** y que no deja saltarlo.
3. Llenar el consentimiento.
4. Verificar que llega a `/carnet` y que el QR se ve.

**`registro-adulto.spec.ts`**
1. Registrarse con fecha de nacimiento de un mayor de edad.
2. Verificar que va directo a `/carnet`, **sin pasar por consentimiento**.
3. **Cronometrar: debe tomar menos de 60 segundos.**

**`asistencia.spec.ts`**
1. Entrar como profesor, abrir la clase de hoy.
2. Enviar un código válido a `validate-scan` y ver el resultado verde con el nombre.
3. Enviar el mismo otra vez y ver el aviso amarillo *"Ya registrado"*.
4. Enviar un código vencido y ver el error rojo.
5. Registrar a alguien por cédula con motivo y verificar que queda como `manual`.

**`examen.spec.ts`**
1. Profesor crea un examen con los tres tipos de pregunta y lo publica.
2. Estudiante lo presenta y lo entrega.
3. Verificar que las objetivas ya tienen puntaje y la redacción no.
4. Profesor califica la redacción.
5. Verificar que el intento pasa a `calificado` y el estudiante ve su nota.

---

## 4. VERIFICACIÓN MANUAL EN TELÉFONO REAL

No se puede automatizar y no se puede saltar. Antes de cada entrega:

- [ ] La app se instala desde el navegador en Android.
- [ ] La app se instala desde el navegador en iPhone.
- [ ] La cámara abre y lee un QR **con la app instalada**, no solo en el navegador.
- [ ] El carnet muestra el QR **con el modo avión activado**.
- [ ] Los escaneos hechos sin señal se envían solos al volver la conexión.
- [ ] Todos los botones se alcanzan con el pulgar de una mano.
- [ ] La pantalla se lee bajo luz fuerte.
- [ ] Nada se desborda a 360 px de ancho.

---

## 5. ANTES DE CADA ENTREGA

```bash
npm run verify
```

Y además, en orden:

1. `supabase db reset` funciona limpio desde cero.
2. Cero tablas con `rowsecurity = false`:
   ```bash
   psql "$DB_URL" -c "select tablename from pg_tables where schemaname='public' and rowsecurity=false;"
   ```
3. Cero tablas con RLS pero sin ninguna política (excepto `student_qr_secrets`, que no debe
   tener ninguna a propósito):
   ```bash
   psql "$DB_URL" -c "select t.tablename from pg_tables t left join pg_policies p on p.tablename=t.tablename where t.schemaname='public' and t.rowsecurity and p.policyname is null;"
   ```
4. Buscar claves filtradas en el código del navegador:
   ```bash
   grep -rn "SUPABASE_SERVICE_ROLE_KEY" app/ components/ | grep -v "server-only"
   ```
   **Debe estar vacío.**
5. Buscar números de negocio escritos en duro:
   ```bash
   grep -rnE "(passing|threshold|0\.05|= ?12|= ?20)" app/ components/ lib/ --include="*.ts*"
   ```
   Revisa cada resultado: si es una regla de la academia, debe leerse de `system_config`.
6. Restauración del respaldo probada y cronometrada.
