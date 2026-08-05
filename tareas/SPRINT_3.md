# SPRINT 3 · EVALUACIONES
**17 → 23 de agosto** · Prueba en campo: **sábado 22 de agosto**
Objetivo: eliminar la calificación manual de las preguntas objetivas.

> **Dependencia previa:** ADR-007 (la fórmula de la nota) aprobada por Coordinación Académica.
> Si el 17 de agosto sigue sin aprobarse, construye con la Opción A y deja el peso en
> `system_config`. Cambiarla después será editar un valor, no reescribir código.

---

## T-301 · Constructor de exámenes
**Archivos:** `app/(profesor)/examenes/page.tsx`, `app/(profesor)/examenes/nuevo/page.tsx`,
`app/(profesor)/examenes/[examId]/editar/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4.
- Datos del examen: título, instrucciones, módulo, cohorte, puntaje máximo, fechas, duración.
- Lista de preguntas reordenables.
- Al agregar, se elige el tipo primero y el formulario cambia según el tipo.
- **Indicador permanente:** `Puntos asignados: 18 / 20`, en rojo si no cuadra.

**Verifica:** el botón **Publicar** está deshabilitado mientras los puntos no sumen exacto.

---

## T-302 · Formularios por tipo de pregunta
**Archivo:** `components/EditorPregunta.tsx`.
**Haz:** respeta los formatos JSON de `spec/02_CONTRATOS.md` §1. No inventes otra forma.
- **Opción múltiple:** enunciado, de 2 a 6 opciones con clave `a`, `b`, `c`…, marcar la
  correcta, puntos.
  `options`: `[{"key":"a","text":"..."}]` · `correct_answer`: `{"key":"b"}`
- **Verdadero/falso:** enunciado, cuál es correcta, puntos.
  `correct_answer`: `{"value":true}`
- **Redacción abierta:** enunciado, rúbrica, puntos. `correct_answer` queda en `null`.

**Verifica:** guarda una de cada tipo y revisa en la base que el JSON quedó con el formato
exacto.

---

## T-303 · Publicar examen
**Archivo:** parte de T-301.
**Haz:** cambiar `status` de `oculto` a `habilitado`.
**No valides los puntos solo en la interfaz:** el disparador `trg_validate_exam_publish` de la
base también lo hace, y esa es la garantía real. Muestra su mensaje de error si aparece.
**Verifica:** intenta publicar un examen sin preguntas, y otro cuyos puntos no cuadren. La base
debe rechazar los dos.

---

## T-304 · Duplicar examen
**Archivo:** parte de T-301.
**Haz:** botón **Duplicar** que copia el examen y todas sus preguntas como uno nuevo en estado
`oculto`.
**Por qué importa:** un profesor que aplica el mismo examen a tres cohortes lo arma una vez.
Si no existe esta función, lo arma tres veces y termina usando papel.

---

## T-305 · Lista de exámenes del estudiante
**Archivo:** `app/(estudiante)/examenes/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3, con los cuatro estados posibles del intento.
**Verifica:** un examen `oculto` **no aparece** en la lista. Compruébalo también consultando la
API directamente: las políticas de RLS deben devolver cero filas.

---

## T-306 · Presentación del examen
**Archivo:** `app/(estudiante)/examenes/[examId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3. **Una pregunta por pantalla.**
- Al entrar, crear el intento si no existe (`exam_attempts`, estado `en_progreso`).
- **Guardado automático:** cada respuesta se guarda en `exam_answers` al cambiar de pregunta.
- Barra de progreso y, si aplica, tiempo restante.
- En la última pregunta, **Entregar** con confirmación.

**Regla crítica:** lee las preguntas de `v_exam_questions_student`, **nunca** de
`exam_questions`. Si consultas la tabla base, la respuesta correcta viaja al navegador y
cualquiera la ve abriendo las herramientas de desarrollo.

**Verifica:** abre la pestaña de red del navegador durante un examen. En ninguna respuesta debe
aparecer `correct_answer` ni `rubric`.

---

## T-307 · Edge Function `submit-attempt`
**Archivo:** `supabase/functions/submit-attempt/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 4.
- Opción múltiple y verdadero/falso: todo o nada.
- Redacción abierta: `awarded_points = null`. **No intentes calificarla.**
- Sin responder una objetiva: 0 puntos.
- **No cierres el intento tú.** Lo hace el disparador `trg_close_attempt` de la base.

**Verifica:** entrega un examen con los tres tipos. Las objetivas quedan con puntaje, la
redacción en `null`, y el intento en `entregado` (no en `calificado`).

---

## T-308 · Cola de calificación
**Archivo:** `app/(profesor)/calificar/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4. La más antigua primero.
**La rúbrica siempre visible junto a la respuesta.** Es lo que hace que dos profesores
califiquen parecido.
Campo de puntaje acotado al máximo de la pregunta, campo de comentario, botón **Guardar y
siguiente**.
**Verifica:** al calificar la última respuesta pendiente, el intento pasa solo a `calificado` y
se crea la notificación.

---

## T-309 · Edge Function `grade-answer`
**Archivo:** `supabase/functions/grade-answer/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 5.
**Verifica:** un puntaje mayor al máximo de la pregunta devuelve `DATOS_INVALIDOS`. Un profesor
que no da clase en esa cohorte recibe `NO_AUTORIZADO`.

---

## T-310 · Registro de notas del módulo
**Archivo:** `app/(profesor)/notas/[cohortId]/page.tsx`.
**Haz:** tabla editable con teoría, práctica y participación por estudiante.
Arriba, el control de **peso de participación** de la cohorte (mínimo 5%).
La nota final y el estado se muestran **en gris, no editables**: los calcula la base.
**Verifica:** cambia una nota y comprueba que `final_score` se recalcula solo, y que el cambio
quedó en `audit_log` con su valor anterior.

---

## T-311 · Vista de notas del estudiante
**Archivo:** `app/(estudiante)/notas/page.tsx`.
**Haz:** tabla por módulo con las tres notas, la final y el estado.
Debajo de la nota final, siempre el umbral: *"Aprueba con 12"*.
**Verifica:** el estudiante del módulo 1 ve *"Aprueba con 10"* y el del módulo 3 ve
*"Aprueba con 12"*.

---

## T-312 · Pruebas de reglas de negocio
**Archivo:** `tests/reglas/negocio.test.ts`.
**Haz:** las 19 pruebas de la tabla de `spec/05_PRUEBAS.md` §2.
**Verifica:** `npm run test` pasa las 19.

Presta atención especial a: *"un estudiante con cero asistencias y notas suficientes sigue
aprobado"*. **Nunca reprueba por faltas.** Esa prueba existe para que nadie agregue esa función
por error más adelante.

---

## T-313 · Prueba de interfaz del examen
**Archivo:** `tests/e2e/examen.spec.ts`.
**Haz:** cópialo de `spec/05_PRUEBAS.md` §3.

---

## SÁBADO 22 DE AGOSTO · PRUEBA REAL
Una cohorte presenta un examen digital real, con al menos una pregunta de cada tipo. El examen
en papel va de respaldo.

**Se aprueba si:** todos entregan, las objetivas se califican solas y correctamente, y el
profesor califica las redacciones desde su panel sin ayuda.

**Requisito operativo:** aplícalo en un espacio con señal verificada el 1 de agosto. Los
exámenes necesitan conexión (ADR-006).

---

## CRITERIO DE SALIDA
- [ ] `npm run verify` pasa.
- [ ] `correct_answer` no aparece en ninguna respuesta de red durante un examen.
- [ ] Las 19 pruebas de reglas de negocio pasan.
- [ ] El examen del sábado 22 salió bien.
