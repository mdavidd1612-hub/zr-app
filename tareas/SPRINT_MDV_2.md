# SPRINT MDV-2 · ASISTENCIA Y EVALUACIÓN DEL SÁBADO
**Días 6-9 (de 14)** · Objetivo: el profesor puede abrir clase, escanear asistencia,
evaluar con rúbrica en la tablet, registrar defensas técnicas y ver el pasaporte actualizado.

---

## T-M201 · Edge Functions de asistencia
**Archivos:** `supabase/functions/validate-scan/index.ts`, `supabase/functions/claim-snack/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` funciones 2 y 3. Sin cambios respecto al original.

**Verifica:**
- Scan válido → asistencia registrada.
- Scan duplicado → `{ duplicate: true }`, no error.
- QR vencido → `QR_VENCIDO`.
- Sesión no abierta → `SESION_NO_ABIERTA`.

---

## T-M202 · Pantalla del profesor: hoy
**Archivo:** `app/(profesor)/hoy/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4.
Tarjeta grande con la clase de hoy. Botón: **Abrir clase y pasar asistencia**.
Agregar indicador MDV: "X de Y estudiantes habilitados por compuerta A".

**Verifica:** el profesor ve cuántos estudiantes pasaron la compuerta.

---

## T-M203 · Escáner de QR
**Archivo:** `app/(profesor)/escanear/[sessionId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4 — pantalla `/escanear/[sessionId]`.
- Cámara 70% de pantalla.
- Franja de resultado grande (verde/amarillo/rojo).
- Contador de asistencia.
- **Modo refrigerio** con interruptor.
- **Cola sin conexión** con IndexedDB.

**Verifica:**
- Escanear QR registra asistencia con sonido.
- Sin internet, el escaneo queda en cola y se sincroniza al volver.
- El contador de pendientes siempre es visible.

---

## T-M204 · Pantalla del profesor: compuerta A
**Archivo:** `app/(profesor)/compuerta/[sessionId]/page.tsx`.
**Haz:** según la spec de pantallas MDV — `/compuerta/[sessionId]`.
Lee de `v_gate_a_status`.

Tabla con columnas:
| Estudiante | Actividades | Autochequeo | Duda | Habilitado |
Con indicadores verde/rojo.

**Verifica:**
- Muestra todos los estudiantes de la cohorte.
- Los habilitados aparecen en verde.
- Los no habilitados aparecen en rojo con el detalle de qué les falta.

---

## T-M205 · Edge Function `evaluate-performance`
**Archivo:** `supabase/functions/evaluate-performance/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 9.

1. Validar que quien llama es personal y da clase en la cohorte.
2. Validar que el estudiante tiene `saturday_enabled = true`.
3. Calcular `attempt_number` (evaluaciones previas + 1).
4. Calcular `awarded_points` por criterio (cumple = max_points, no cumple = 0).
5. Insertar `performance_evaluations` y `eval_criteria_results`.
6. Los triggers de la base calculan `outcome` y sincronizan `mastery_map`.
7. Devolver la evaluación con su outcome.

**Verifica:**
- Todos los críticos OK + score ≥ 81 → outcome = 'dominada'.
- Un crítico falla → outcome = 'requiere_refuerzo' automáticamente.
- Repetir no castiga: el intento se numera pero el mejor resultado manda.
- `mastery_map` se actualiza automáticamente.

---

## T-M206 · Pantalla del profesor: evaluación con rúbrica
**Archivo:** `app/(profesor)/evaluar/[sessionId]/page.tsx`.
**Haz:** según la spec de pantallas MDV — `/evaluar/[sessionId]`.

**Diseñada para tablet, una mano, en el taller.**

- Selector de estudiante (solo los habilitados por compuerta A).
- Rúbrica con criterios listados:
  - Cada criterio: descripción + toggle CUMPLE/NO CUMPLE.
  - Ítems críticos con badge rojo "CRÍTICO" prominente.
  - Si un crítico está en "NO CUMPLE", aviso naranja inmediato:
    "Ítem crítico fallido — la competencia será marcada como REQUIERE REFUERZO".
- Puntaje total en tiempo real al fondo.
- Campo de observaciones por criterio (opcional).
- Botón de captura de video (cámara nativa, max 90 seg) → Supabase Storage.
- Botón **Guardar evaluación** → llama a `evaluate-performance`.
- Muestra resultado con color (verde/amarillo/rojo) y transición al pasaporte.

**Verifica:**
- Al marcar un crítico como NO CUMPLE, aparece aviso inmediato.
- El puntaje total se actualiza en tiempo real.
- Al guardar, el outcome se muestra correctamente.
- El video se sube a Supabase Storage.
- Funciona bien en una pantalla de tablet (768px+).

---

## T-M207 · Edge Functions de defensa
**Archivos:**
- `supabase/functions/draw-defense-questions/index.ts`
- `supabase/functions/grade-defense/index.ts`

**Haz:** según `spec/03_EDGE_FUNCTIONS.md` funciones 10 y 11.

**Verifica:**
- `draw-defense-questions` devuelve exactamente 3 preguntas aleatorias.
- `grade-defense` con nivel_1 → la evaluación cambia a 'requiere_refuerzo'.
- `grade-defense` con nivel_3 no cambia una evaluación que ya era 'dominada'.

---

## T-M208 · Pantalla del profesor: defensa técnica
**Archivo:** `app/(profesor)/defensa/[evaluationId]/page.tsx`.
**Haz:** según la spec de pantallas MDV — `/defensa/[evaluationId]`.

- Botón "Sortear preguntas" → llama a `draw-defense-questions`.
- 3 preguntas mostradas en tarjetas.
- Selector de nivel (1/2/3/4) con descripción de cada nivel.
- Cronómetro de duración.
- Botón "Registrar defensa" → llama a `grade-defense`.
- Si nivel_1: aviso rojo "Competencia marcada como REQUIERE REFUERZO".

**Verifica:**
- Las preguntas son distintas cada vez (aleatorias).
- El cronómetro funciona.
- El nivel se registra y el outcome de la evaluación se actualiza.

---

## T-M209 · Edge Function `submit-reflection`
**Archivo:** `supabase/functions/submit-reflection/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 13.

**Verifica:**
- El estudiante puede enviar su ticket con los 4 campos.
- No puede enviar dos veces para la misma sesión.
- Los campos deben tener al menos 10 caracteres.

---

## T-M210 · Pantalla del estudiante: ticket de reflexión
**Archivo:** `app/(estudiante)/reflexion/[sessionId]/page.tsx`.
**Haz:** formulario con 4 campos de texto:
1. "Antes pensaba..." (placeholder: "¿Qué creías antes de la clase de hoy?")
2. "Ahora entiendo..." (placeholder: "¿Qué entiendes ahora que no sabías?")
3. "Mi mayor error..." (placeholder: "¿Cuál fue tu error más importante hoy?")
4. "La próxima vez..." (placeholder: "¿Qué harás diferente la próxima vez?")

Botón **Enviar reflexión** → llama a `submit-reflection`.
Después: "Gracias. Tu reflexión ha sido guardada. ¡Nos vemos el próximo sábado!"

**Acceso:** desde la pantalla de clases, al final de una sesión cerrada.

**Verifica:**
- Los 4 campos son obligatorios.
- No se puede reenviar.
- La pantalla de confirmación es clara y cálida.

---

## T-M211 · Edge Function `assign-workshop-roles`
**Archivo:** `supabase/functions/assign-workshop-roles/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 12.

**Verifica:**
- Solo estudiantes habilitados reciben rol.
- Máximo 4 por estación.
- Cada estudiante tiene exactamente un rol por rotación.

---

## T-M212 · Pantalla del profesor: roles del taller
**Archivo:** `app/(profesor)/roles/[sessionId]/page.tsx`.
**Haz:** según la spec de pantallas MDV — `/roles/[sessionId]`.
- Botón "Asignar roles automáticamente".
- Grid de estaciones con estudiantes y sus roles.
- Opción de intercambiar estudiantes manualmente.

**Verifica:** la asignación se muestra claramente y cubre a todos los habilitados.
