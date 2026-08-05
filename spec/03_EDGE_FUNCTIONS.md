# 03 · EDGE FUNCTIONS
> Toda la lógica sensible vive aquí. El navegador nunca calcula notas, nunca valida códigos QR
> y nunca decide si alguien aprobó.
>
> Ubicación: `supabase/functions/<nombre>/index.ts`
> Desplegar: `supabase functions deploy <nombre>`

---

## Plantilla común

Todas las funciones empiezan igual. Copia esta base:

```ts
// supabase/functions/_shared/base.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function okResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Cliente con la identidad de quien llama (respeta RLS)
export function userClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
}

// Cliente de servicio (ignora RLS). Solo después de validar permisos.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}
```

---

## FUNCIÓN 1 · `provision-qr`
**Qué hace:** entrega al estudiante su secreto TOTP, una sola vez, al completar el registro.

**Entrada:** ninguna (usa el token de quien llama).

**Salida:**
```json
{ "secret": "JBSWY3DPEHPK3PXP", "issuer": "ZR Mecademy", "label": "V-30000001", "periodSeconds": 30 }
```

**Lógica exacta:**
1. Obtener el usuario del token. Si no hay, `NO_AUTORIZADO` (401).
2. Verificar que su rol es `estudiante`. Si no, `NO_AUTORIZADO`.
3. Con el cliente admin, buscar el secreto en `student_qr_secrets`.
4. Si no existe, generar uno nuevo (20 bytes aleatorios en base32) e insertarlo.
5. Devolver el secreto.

**Nota:** el cliente lo guarda cifrado en el dispositivo. La aplicación no vuelve a pedirlo
salvo que el estudiante cambie de teléfono.

---

## FUNCIÓN 2 · `validate-scan`
**La función más importante del proyecto.** Registra una asistencia.

**Entrada:**
```json
{
  "sessionId": "uuid",
  "qrCode": "ZR1|V-30000001|482913",
  "scannedAt": "2026-08-15T12:03:11.000Z",
  "deviceId": "tablet-taller-1"
}
```

**Salida correcta:**
```json
{
  "ok": true,
  "student": { "id": "uuid", "fullName": "Luis Hernández", "cedula": "V-30000001" },
  "attendanceId": "uuid",
  "duplicate": false
}
```

**Lógica exacta, en este orden:**
1. Validar el token. Verificar que quien llama es `profesor`, `admin` o `super_admin`.
   Si no → `NO_AUTORIZADO` (403).
2. Validar el formato del `qrCode` con la expresión regular. Si falla → `QR_INVALIDO`.
3. Separar el código en `version | cedula | totp`. Si `version !== 'ZR1'` → `QR_INVALIDO`.
4. Buscar el estudiante por cédula. Si no existe → `QR_INVALIDO`.
5. Leer su secreto de `student_qr_secrets` con el cliente admin.
6. Leer `attendance.qr_window_seconds` y `attendance.qr_drift_tolerance` de `system_config`.
7. Validar el TOTP con esa ventana y esa tolerancia.
   Si no coincide en ninguna ventana permitida → `QR_VENCIDO`.
8. Leer la sesión. Si su estado no es `abierta` → `SESION_NO_ABIERTA`.
9. Verificar que quien llama da clase en esa cohorte. Si no → `NO_AUTORIZADO`.
10. Verificar que el estudiante pertenece a la cohorte de la sesión.
    Si no → `ESTUDIANTE_OTRA_COHORTE`.
11. Insertar en `attendance_events` con `scanned_at = scannedAt` (el momento **real**, no
    `now()`), `synced_at = now()`, `scanned_by` = quien llama, `method = 'qr'`.
12. Si el insert choca con la restricción única `(session_id, student_id)`, **no es un error**:
    devolver `{ ok: true, duplicate: true }` con los datos del estudiante. Esto es lo que hace
    que reenviar la cola sin conexión sea seguro.

**Por qué el paso 11 usa `scannedAt` y no `now()`:** el dispositivo del profesor puede estar
sin señal y sincronizar tres horas después. La hora que importa es la del escaneo real.

---

## FUNCIÓN 3 · `claim-snack`
**Qué hace:** marca la entrega del refrigerio.

**Entrada:**
```json
{ "sessionId": "uuid", "qrCode": "ZR1|V-30000001|482913" }
```

**Salida:**
```json
{ "ok": true, "student": { "fullName": "Luis Hernández" } }
```

**Lógica:**
1 a 10: idénticos a `validate-scan`.
11. Buscar el registro de `attendance_events` de ese `(sessionId, studentId)`.
    Si no existe → `NO_AUTORIZADO` con mensaje "El estudiante no tiene asistencia registrada
    hoy". *(Regla de negocio: no hay refrigerio sin asistencia.)*
12. Si `snack_claimed_at` ya tiene valor → `REFRIGERIO_YA_ENTREGADO`.
13. Actualizar `snack_claimed_at = now()` y `snack_claimed_by` = quien llama.

---

## FUNCIÓN 4 · `submit-attempt`
**Qué hace:** el estudiante entrega su examen y se autocalifica lo que se pueda.

**Entrada:**
```json
{ "attemptId": "uuid" }
```

**Salida:**
```json
{
  "ok": true,
  "autoGradedPoints": 14,
  "pendingManualQuestions": 1,
  "status": "entregado"
}
```

**Lógica exacta:**
1. Validar el token. Verificar que el intento pertenece a quien llama.
   Si no → `NO_AUTORIZADO`.
2. Si el intento no está `en_progreso` → `INTENTO_YA_ENTREGADO`.
3. Con el cliente admin, traer todas las preguntas del examen **con su `correct_answer`**
   (aquí sí se puede: estamos en el servidor).
4. Para cada respuesta del estudiante:
   - `opcion_multiple`: correcta si `answer.key === correct_answer.key`.
     Puntos: todos o cero.
   - `verdadero_falso`: correcta si `answer.value === correct_answer.value`.
     Puntos: todos o cero.
   - `redaccion_abierta`: dejar `awarded_points = null`. **No intentes calificarla.**
   - Marcar `auto_graded = true` en las dos primeras.
   - Si el estudiante no respondió una pregunta objetiva, `awarded_points = 0`.
5. Actualizar el intento a `entregado` con `submitted_at = now()`.
6. El disparador `trg_close_attempt` de la base se encarga solo de pasar el intento a
   `calificado` cuando ya no queden respuestas sin puntaje. **No lo hagas tú desde aquí.**

---

## FUNCIÓN 5 · `grade-answer`
**Qué hace:** el profesor califica una redacción abierta.

**Entrada:**
```json
{ "answerId": "uuid", "awardedPoints": 5, "feedback": "Buena respuesta, faltó mencionar el alternador." }
```

**Salida:**
```json
{ "ok": true, "attemptClosed": true, "totalScore": 19 }
```

**Lógica:**
1. Validar que quien llama es personal y da clase en la cohorte del examen.
2. Validar que `awardedPoints` está entre 0 y los puntos de esa pregunta.
   Si no → `DATOS_INVALIDOS`.
3. Actualizar `exam_answers`: `awarded_points`, `graded_by`, `graded_at = now()`,
   `teacher_feedback`.
4. Devolver si el intento quedó cerrado (lo decide el disparador de la base).

---

## FUNCIÓN 6 · `create-staff-user`
**Qué hace:** un administrador crea una cuenta de profesor o de otro administrador.

**Entrada:**
```json
{ "cedula": "V-10000005", "fullName": "Prof. Nuevo", "contactEmail": "nuevo@zrmecademy.com", "role": "profesor", "password": "TemporalSegura1" }
```

**Lógica:**
1. Verificar que quien llama es `admin` o `super_admin`. Si no → `NO_AUTORIZADO`.
2. **Solo un `super_admin` puede crear otro `super_admin`.** Si un `admin` lo intenta →
   `NO_AUTORIZADO`.
3. Crear el usuario con `adminClient().auth.admin.createUser()`, correo confirmado.
4. Actualizar `profiles.role` al rol solicitado.
5. Insertar en `teachers` o en `admins` según corresponda.

> Esta función existe porque el disparador `handle_new_user` **siempre** crea perfiles como
> `estudiante`. Es la única vía para que exista personal, y pasa por el servidor.

---

## FUNCIÓN 7 · `send-push`
**Qué hace:** envía las notificaciones pendientes por Web Push.

**Disparo:** por `pg_cron`, cada 5 minutos. No la llama el navegador.

**Lógica:**
1. Traer de `notifications` las que tienen `sent_at is null` y `channel = 'push'`.
2. Para cada una, buscar las suscripciones del perfil en `push_subscriptions`.
3. Enviar con las claves VAPID (variables de entorno `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`).
4. Marcar `sent_at = now()`.
5. Si una suscripción devuelve 404 o 410, borrarla: el dispositivo ya no existe.

---

## Reglas para todas las funciones

1. **Valida el token siempre.** Nunca asumas que quien llama es quien dice ser.
2. **Valida el rol antes de usar `adminClient()`.** Ese cliente se salta RLS: si lo usas antes
   de comprobar permisos, acabas de anular toda la seguridad del sistema.
3. **Devuelve errores del catálogo** de `02_CONTRATOS.md` §3. No inventes códigos.
4. **Nunca devuelvas `correct_answer` ni el secreto TOTP** en ninguna respuesta que pueda
   llegar a un estudiante.
5. **Registra los fallos** con `console.error` incluyendo el código de error, nunca datos
   personales del estudiante.
6. **Responde al método `OPTIONS`** con `corsHeaders`, o el navegador bloqueará la llamada.
