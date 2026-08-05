# 02 · CONTRATOS DE DATOS
> Formas exactas de los datos que viajan entre el navegador, la base y las Edge Functions.
> Si un objeto no está aquí, no lo inventes: pregunta.

---

## 1. Archivo `lib/types.ts`

Crea este archivo tal cual. Los tipos de tabla se generan automáticamente en
`lib/database.types.ts`; aquí van solo los tipos de negocio que no salen de la base.

```ts
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Alias de tablas (para no escribir la ruta larga en todo el código)
// ---------------------------------------------------------------------------
type T = Database['public']['Tables']
type V = Database['public']['Views']

export type Profile          = T['profiles']['Row']
export type Student          = T['students']['Row']
export type StudentView      = V['v_students']['Row']
export type Teacher          = T['teachers']['Row']
export type Cohort           = T['cohorts']['Row']
export type Module           = T['modules']['Row']
export type LearningGuide    = T['learning_guides']['Row']
export type ClassSession     = T['class_sessions']['Row']
export type Enrollment       = T['module_enrollments']['Row']
export type AttendanceEvent  = T['attendance_events']['Row']
export type Exam             = T['exams']['Row']
export type ExamQuestion     = T['exam_questions']['Row']
export type StudentQuestion  = V['v_exam_questions_student']['Row']
export type ExamAttempt      = T['exam_attempts']['Row']
export type ExamAnswer       = T['exam_answers']['Row']
export type ContentItem      = T['content_items']['Row']
export type Notification     = T['notifications']['Row']
export type ParentalConsent  = T['parental_consents']['Row']

export type UserRole = Database['public']['Enums']['user_role']

// ---------------------------------------------------------------------------
// Respuestas de opciones y preguntas
// ---------------------------------------------------------------------------
// El formato de 'options' y 'answer' es jsonb en la base. Estos tipos son el
// contrato de qué se guarda ahí. Respétalos exactamente.

export type QuestionOption = { key: string; text: string }

export type CorrectAnswer =
  | { key: string }        // opcion_multiple
  | { value: boolean }     // verdadero_falso
  | null                   // redaccion_abierta

export type StudentAnswer =
  | { key: string }
  | { value: boolean }
  | { text: string }

export type FeedbackAnswer = { q: string; a: number }  // a va de 1 a 5

// ---------------------------------------------------------------------------
// Cola de asistencia sin conexión (se guarda en IndexedDB)
// ---------------------------------------------------------------------------
export type PendingScan = {
  localId: string          // uuid generado en el navegador
  sessionId: string
  qrCode: string           // el código de 6 dígitos leído del QR
  scannedAt: string        // ISO 8601, momento REAL del escaneo
  deviceId: string
  synced: boolean
  lastError?: string
}
```

---

## 2. Contenido del código QR del estudiante

El QR que muestra el carnet contiene **solo texto plano**, con este formato exacto:

```
ZR1|<cedula>|<codigo_totp_6_digitos>
```

Ejemplo: `ZR1|V-30000001|482913`

- `ZR1` es la versión del formato. Si algún día cambia, será `ZR2`.
- El código TOTP se genera en el teléfono del estudiante, sin internet, a partir del secreto
  entregado en el aprovisionamiento.
- Rota cada **30 segundos** (valor leído de `system_config.attendance.qr_window_seconds`).

**Nunca metas el nombre, la foto ni el id del estudiante en el QR.** Solo lo mínimo para
identificar y validar.

---

## 3. Formato de errores

Todas las Edge Functions y rutas de API devuelven errores con esta forma:

```ts
export type ApiError = {
  error: {
    code: string      // identificador estable, en MAYUSCULAS_CON_GUION_BAJO
    message: string   // texto en español, listo para mostrarle al usuario
    detail?: unknown  // solo para depuración, nunca se muestra
  }
}
```

**Catálogo de códigos de error.** No inventes códigos nuevos sin agregarlos aquí.

| Código | Mensaje al usuario | Cuándo |
|---|---|---|
| `QR_INVALIDO` | El código no es válido. Pídele al estudiante que actualice su carnet. | Formato incorrecto o TOTP no coincide |
| `QR_VENCIDO` | El código venció. Que el estudiante muestre el nuevo. | Fuera de la ventana de tiempo |
| `SESION_NO_ABIERTA` | La clase no está abierta para pasar asistencia. | Sesión en estado distinto de `abierta` |
| `ESTUDIANTE_OTRA_COHORTE` | Este estudiante no pertenece a este grupo. | Cohorte no coincide |
| `YA_REGISTRADO` | Este estudiante ya tiene asistencia hoy. | Duplicado (no es un error grave) |
| `REFRIGERIO_YA_ENTREGADO` | A este estudiante ya se le entregó el refrigerio. | Segundo intento de refrigerio |
| `SIN_CONSENTIMIENTO` | Falta el consentimiento del representante legal. | Menor sin consentimiento |
| `EXAMEN_NO_DISPONIBLE` | Este examen no está habilitado. | Examen oculto o cerrado |
| `INTENTO_YA_ENTREGADO` | Ya entregaste este examen. | Reintento de entrega |
| `NO_AUTORIZADO` | No tienes permiso para hacer esto. | Rol insuficiente |
| `DATOS_INVALIDOS` | Revisa los datos e intenta de nuevo. | Falla de validación de esquema |
| `ERROR_INTERNO` | Algo salió mal. Intenta de nuevo. | Cualquier otra cosa |

---

## 4. Validación de entradas

Toda entrada de usuario se valida con `zod` **antes** de tocar la base. Crea
`lib/validators.ts`:

```ts
import { z } from 'zod'

// Cédula venezolana: V o E, guion, 6 a 9 dígitos.
export const cedulaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[VE]-\d{6,9}$/, 'La cédula debe tener el formato V-12345678')

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')

export const registroSchema = z.object({
  fullName:     z.string().trim().min(3, 'Escribe tu nombre completo'),
  cedula:       cedulaSchema,
  contactEmail: z.string().trim().email('Escribe un correo válido'),
  phone:        z.string().trim().optional(),
  birthDate:    z.coerce.date(),
  password:     passwordSchema,
})

export const consentimientoSchema = z.object({
  representativeName:   z.string().trim().min(3),
  representativeCedula: cedulaSchema,
  representativeEmail:  z.string().trim().email(),
  representativePhone:  z.string().trim().optional(),
  method:               z.enum(['fisico', 'digital']),
  documentUrl:          z.string().url().optional(),
})

export const escaneoSchema = z.object({
  sessionId: z.string().uuid(),
  qrCode:    z.string().regex(/^ZR1\|[VE]-\d{6,9}\|\d{6}$/, 'Código QR con formato inválido'),
  scannedAt: z.string().datetime(),
  deviceId:  z.string().min(1),
})
```

---

## 5. Cómo se convierte la cédula en correo

El estudiante entra con su cédula. Supabase Auth necesita un correo. La conversión es
determinista y **siempre la misma en toda la aplicación**:

```ts
// lib/auth-helpers.ts
export function cedulaAEmail(cedula: string): string {
  return `${cedula.trim().toUpperCase()}@estudiante.zrmecademy.com`
}
```

El estudiante **nunca ve** ese correo. Su correo real de contacto está en
`profiles.contact_email` y es el que se usa para recuperar la contraseña. Para menores de
edad, ese correo es el de su representante legal.

---

## 6. Reglas de formato en la interfaz

| Dato | Cómo se muestra |
|---|---|
| Notas | Un decimal, sobre 20. Ej. `16,5 / 20` (coma decimal, es Venezuela) |
| Fechas | `sáb 15 ago 2026` |
| Horas | Formato de 24 horas: `08:30` |
| Cédula | Siempre con guion: `V-30000001` |
| Estado aprobado | Verde. Reprobado: rojo. En curso: gris |
| Porcentajes | Sin decimales: `85%` |

---

## 7. Cómo saber el rol del usuario en el código

```ts
// lib/auth-helpers.ts
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'

export async function getSessionProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, cedula, avatar_url, status')
    .eq('id', user.id)
    .single()

  return data
}

export function esPersonal(role?: UserRole | null) {
  return role === 'profesor' || role === 'admin' || role === 'super_admin'
}

export function esAdmin(role?: UserRole | null) {
  return role === 'admin' || role === 'super_admin'
}
```

Nunca confíes en un rol que venga del navegador. Siempre se lee del servidor.
