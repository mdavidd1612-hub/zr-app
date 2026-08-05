# Guía de prueba · flujo completo

Este recorrido está **verificado end-to-end** el 5 de agosto de 2026 contra la base local.
Si algo no te funciona igual, es un error nuevo: repórtalo.

---

## Antes de empezar

**1. Supabase local levantado.** Comprueba que responde:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54321/rest/v1/
```

**2. Las Edge Functions servidas.** Esto es aparte de `supabase start` y hace falta para
entregar y calificar exámenes:

```bash
npx supabase functions serve --no-verify-jwt
```

Déjalo corriendo en su propia terminal. Si no lo levantas, el botón **Entregar** falla con
«No se pudo entregar».

**3. La app:**

```bash
npm run dev
```

---

## Usuarios de prueba

| Rol | Cédula | Contraseña | Entra en |
|---|---|---|---|
| Profesor | `V-10000001` | `Prueba123!` | `/hoy` |
| Dirección (super admin) | `V-10000002` | `Prueba123!` | `/panel` |
| Estudiante · Juan Carlos Pérez | `V-30000001` | `Prueba123!` | `/` |
| Estudiante · María García López | `V-30000002` | `Prueba123!` | `/` |

Los dos estudiantes están **en la misma cohorte** a propósito: si el aislamiento de datos
falla, se nota aquí primero.

Si los usuarios no existen todavía, aplica las migraciones:

```bash
npx supabase db reset
```

---

## Parte 1 · El profesor arma un examen

### 1.1 Entrar

Ve a `http://localhost:3000/login`, entra con `V-10000001` / `Prueba123!`.

Caes en el panel del profesor. Deberías ver:

- Tu nombre: **Prof. Pedro Ramírez**
- **01 — PRÓXIMA CLASE**: el próximo sábado, Cohorte 2026-B, Semana 2, Electricidad Automotriz
- **02 — ASISTENCIA**: 0 presentes, 2 faltan (hay 2 estudiantes inscritos)
- **03 — PENDIENTE**: «Al día» si no hay redacciones esperando

### 1.2 Crear el examen

Barra lateral → **Exámenes** → botón **Crear examen**.

Rellena:

| Campo | Valor |
|---|---|
| Título | `Electricidad Automotriz · Semana 2` |
| Módulo | Electricidad Automotriz |
| Cohorte | Cohorte 2026-B · Sábado 8:00 am |
| Puntaje máximo | `10` |
| Duración | `90` |

Fíjate en el contador: dice **«Puntos asignados: 0 / 10 · Faltan 10»** en rojo.

### 1.3 Primera pregunta · opción múltiple

**+ Agregar pregunta** → **Opción múltiple**.

- Enunciado: `¿Cuál es la función principal del alternador?`
- Opción **A**: `Generar electricidad con el motor encendido` ← deja el radio marcado aquí
- Opción **B**: `Almacenar energía cuando el auto está apagado`
- Puntos: `5`

**Guardar Pregunta**. El contador pasa a **5 / 10** (sigue rojo).

### 1.4 Segunda pregunta · redacción abierta

**+ Agregar pregunta** → **Redacción abierta**.

- Enunciado: `Explica paso a paso cómo diagnosticar una batería descargada.`
- Rúbrica: `Menciona los 3 pasos (inspección visual, medición en reposo, prueba de carga) = 3 pts. Da valores de voltaje correctos = 1 pt. Nombra la herramienta = 1 pt.`
- Puntos: `5`

**Guardar Pregunta**. El contador pasa a **10 / 10** y **se pone verde**.

> La rúbrica es tuya, no del estudiante. En la Parte 2 vas a comprobar que no le llega.

### 1.5 Guardar y publicar

**Guardar borrador** → vuelves a la lista, el examen aparece bajo **01 — SIN PUBLICAR**.

Pulsa **Publicar**. Pasa a **01 — PUBLICADOS**.

> Si los puntos no cuadraran, el botón está deshabilitado. Y aunque lo forzaras, el disparador
> `trg_validate_exam_publish` de la base lo rechaza. Esa es la garantía real.

---

## Parte 2 · El estudiante lo presenta

### 2.1 Entrar

**Cerrar sesión** (abajo en la barra lateral) → entra con `V-30000002` / `Prueba123!`.

En el inicio deberías ver:

- **01 — PRÓXIMO SÁBADO** con la competencia de la semana y un bloque **TRAE INVESTIGADO**
  («Averigua cuál es el voltaje normal de una batería de 12V…»)
- **02 — MI PROGRESO**: 0 dominadas, 0 en progreso, 4 pendientes
- **03 — ACCESOS**

### 2.2 Abrir el examen

Barra inferior → **Exámenes**. Bajo **01 — POR PRESENTAR** está tu examen. Tócalo.

Verás **PREGUNTA 1 DE 2**, el cronómetro en 89:5x y las dos opciones.

### 2.3 Comprobación de seguridad (hazla)

Abre las herramientas del navegador (F12) → pestaña **Red** → filtra por
`v_exam_questions_student` → mira la respuesta.

**No debe aparecer `correct_answer` ni `rubric`.** Si aparecen, para y repórtalo: significa que
alguien cambió la consulta para leer `exam_questions` en vez de la vista.

### 2.4 Responder

**Pregunta 1**: toca `Generar electricidad con el motor encendido`.
Se guarda sola, no hay botón de guardar.

**Siguiente**.

**Pregunta 2**: escribe algo como

> Primero reviso los bornes por si tienen sulfato o están flojos. Después mido con el
> multímetro en reposo: debe dar cerca de 12,6 V. Por último enciendo el motor y vuelvo a
> medir; el alternador tiene que subirla a 13,5 o 14,5 V.

Fíjate en que **no ves la rúbrica**. Correcto.

### 2.5 Entregar

**Entregar** → sale la confirmación: *«Respondiste todas las preguntas. Una vez entregado no
podrás cambiar tus respuestas.»* → **Sí, entregar**.

Vuelves a la lista. El examen está ahora en **YA PRESENTADOS** con la etiqueta **Entregado**.

> Si hubieras dejado preguntas sin responder, la confirmación te lo diría con el número exacto
> y avisaría de que cuentan como cero.

**Qué pasó por debajo:** la Edge Function `submit-attempt` calificó sola la opción múltiple
(5/5, todo o nada) y dejó la redacción en `null` esperando al profesor. No intentó adivinar.

---

## Parte 3 · El profesor califica la redacción

### 3.1 Entrar y abrir la cola

Cierra sesión → entra con `V-10000001` → barra lateral → **Calificar**.

Ves, en una sola pantalla:

- **Respuesta 1 de 1 · hace minutos**
- El estudiante: **María García López**
- La pregunta
- **La rúbrica** (esto es lo que hace que dos profesores califiquen parecido)
- La respuesta del estudiante
- Campo de puntaje y campo de comentario

### 3.2 Probar la validación

Escribe `9` en el puntaje (el máximo es 5) y pulsa **Guardar y terminar**.

Sale: **«El puntaje tiene que estar entre 0 y 5.»** No se guarda nada.

> La validación también está en la Edge Function `grade-answer`. Aunque alguien saltara la
> interfaz, la respuesta sería `DATOS_INVALIDOS`.

### 3.3 Calificar de verdad

- Puntaje: `4`
- Comentario: `Muy buena secuencia y los voltajes están correctos. Te faltó nombrar la herramienta de prueba de carga.`

**Guardar y terminar** → pantalla de **Todo al día**.

**Qué pasó por debajo:** al no quedar respuestas sin puntaje, el disparador
`trg_close_attempt` cerró el intento solo y calculó el total. La Edge Function no lo cierra:
lo lee.

---

## Parte 4 · El estudiante ve su nota

Cierra sesión → entra con `V-30000002` → **Exámenes**.

Bajo **YA PRESENTADOS**:

> **Electricidad Automotriz · Semana 2**
> **9** / 10 puntos — **Calificado**

5 de la opción múltiple + 4 de la redacción. Nadie sumó eso en el navegador.

En **Notas** ves el módulo con teoría, práctica y participación, la nota final y el umbral
(*«Aprueba con 10»*), todo en gris: son columnas que mantiene la base.

---

## Lista de comprobación

- [ ] El profesor entra y ve su próxima clase con datos reales
- [ ] El contador de puntos está rojo mientras no cuadre y verde cuando cuadra
- [ ] No se puede publicar un examen cuyos puntos no sumen el máximo
- [ ] El estudiante ve «Próximo sábado» con lo que tiene que investigar
- [ ] **En la pestaña Red no aparece `correct_answer` ni `rubric`**
- [ ] Las respuestas se guardan solas al tocarlas
- [ ] Entregar pide confirmación y avisa de las preguntas sin responder
- [ ] La opción múltiple se califica sola; la redacción queda pendiente
- [ ] Un puntaje mayor al máximo se rechaza
- [ ] Al calificar la última respuesta, el intento se cierra solo
- [ ] El estudiante ve su nota final

---

## Si algo falla

| Síntoma | Causa | Qué hacer |
|---|---|---|
| «Cédula o contraseña incorrecta» | Los usuarios no están cargados | `npx supabase db reset` |
| «No se pudo entregar» al dar Entregar | Las Edge Functions no están sirviéndose | `npx supabase functions serve --no-verify-jwt` |
| La cola de calificación sale vacía con respuestas pendientes | El intento no se entregó (sigue en `en_progreso`) | Revisa la consola del navegador al entregar |
| «permission denied for table …» en el log de una función | Falta la migración 018 | Aplícala: da los GRANT a `service_role` |
| El examen no aparece al estudiante | Está en `oculto` | Publícalo desde la lista del profesor |

### Ver el estado real de la base

```bash
docker exec -i supabase_db_ZR_App psql -U postgres -d postgres -c "select status, total_score from exam_attempts;"
```
