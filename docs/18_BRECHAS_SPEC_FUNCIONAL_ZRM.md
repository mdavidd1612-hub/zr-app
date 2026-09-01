# 18 · Brechas contra la Especificación Funcional ZRM Academy

> **Para quien retome esto en otra sesión.** Este documento es el traspaso de una
> auditoría hecha el **1 de septiembre de 2026** comparando el código de ZR App
> contra `especificacion-funcional-zrm-academy.md` (el documento del cliente, que
> vive fuera del repo en `C:\Users\mdavi\Documents\`).
>
> Léelo completo antes de tocar nada de lo que aparece en la sección 3. Cada punto
> pendiente dice **qué falta, por qué importa y qué archivos toca** — no hace falta
> volver a auditar.

---

## 0. Contexto en una línea

La spec del cliente describe 8 módulos. ZR App ya cubre bien el núcleo
(inscripción por vendedor, planilla imprimible, asistencia por QR, exámenes,
contenido, casos con IA). La auditoría encontró **4 módulos incompletos, 5 piezas
inexistentes y 1 integración entera sin empezar (Odoo)**.

**Actualización 1 de septiembre de 2026 (tarde):** el Bloque A ya se había
ejecutado. Con las preguntas abiertas ya respondidas por el cliente, se
ejecutaron también **B-1, B-3, B-4 y C-2** (commit `bff331e`). Quedan
pendientes **C-1, C-3 (confirmado que sigue igual) y C-4** — y **Odoo (D-1)
explícitamente fuera de alcance por ahora**, por decisión del cliente.

---

## 1. Cómo leer las divergencias

No todo lo que difiere de la spec es un error. Hay tres categorías, y confundirlas
hace perder tiempo:

| Categoría | Qué significa | Qué hacer |
|---|---|---|
| **Brecha real** | La spec lo pide, la app no lo tiene | Construirlo |
| **Divergencia deliberada** | La app hizo otra cosa a propósito, y está bien | No "arreglarlo". Confirmar con producto y actualizar la spec |
| **Spec obsoleta** | El documento describe un mundo que ya no aplica | Ignorar ese capítulo |

Las divergencias deliberadas y la spec obsoleta están listadas en la sección 4.
**Revísala antes de "corregir" algo**, o vas a deshacer decisiones que ya se
tomaron con razón.

---

## 2. Lo que YA se cambió (1 de septiembre de 2026)

Cuatro tareas del "Bloque A": las que no requerían inventar nada porque la base de
datos o los datos ya existían. Todo compila (`tsc --noEmit`), pasa `eslint` y
`npm run build`.

### 2.1 · Los 8 campos del representante

**Por qué**: la planilla física real de la academia pide 8 datos del
representante (spec §3 y §15.1). La migración `049_validacion_y_planilla.sql` ya
había creado las cuatro columnas que faltaban —
`representative_relationship`, `_age`, `_nationality`, `_occupation` — pero
**nadie las llenaba ni las imprimía**. La base estaba lista y la UI se quedó atrás.

**Archivos tocados**:
- `app/(vendedor)/carga-ventas/page.tsx` — cuatro campos nuevos: parentesco, edad,
  nacionalidad, profesión u ocupación.
- `supabase/functions/create-student/index.ts` — `DatosRepresentante` ahora tiene
  los 8 campos y el `insert` en `parental_consents` los persiste.
- `app/(admin)/estudiantes/[id]/planilla/page.tsx` — los consulta y los imprime.
  El título de la sección pasó de "Contacto del representante" a "Datos del
  representante", como dice la planilla real.

**Decisión tomada — no la revierta sin preguntar**: los campos quedaron
**opcionales**, no obligatorios. La spec §15.1 dice "los 8 son obligatorios si es
menor", pero el commit `6d3658d` quitó a propósito todas las restricciones por
minoría de edad. Reintroducirlas sería deshacer una decisión de producto. **Está
pendiente de confirmación con el cliente**; si dice que sí, el cambio es de tres
líneas en `carga-ventas/page.tsx` (agregar los campos a la constante `completo`).

### 2.2 · "Días y horario" dejaron de estar escritos en el código

**Por qué**: dos motivos. La spec §3 exige que días y horario se **deriven**
automáticamente y no se le pidan al vendedor. Y la regla 5 de `CLAUDE.md` prohíbe
escribir valores de negocio dentro del código — el horario vivía en una constante
`HORARIO_TURNO` dentro de la planilla, así que cambiar la hora de un turno exigía
un despliegue.

**Archivos tocados**:
- `supabase/migrations/052_dias_y_horario_cohorte.sql` — **NUEVA**. Agrega
  `cohorts.days` y `cohorts.schedule`, y las rellena con lo que estaba escrito a
  mano, para que ninguna cohorte existente quede sin horario.
- `app/(admin)/estudiantes/[id]/planilla/page.tsx` — eliminada la constante; ahora
  lee de la cohorte.
- `app/(admin)/cohortes/page.tsx` — admin puede escribir días y horario al crear
  una cohorte.
- `lib/database.types.ts` — se agregaron `days` y `schedule` a mano en `Row`,
  `Insert` y `Update` de `cohorts`. **Si regeneras los tipos con el CLI, esto se
  sobrescribe solo y queda igual.**

**Decisión tomada**: la spec dice "cada `Module` debe tener sus propios `days` y
`schedule`". En esta app eso es incorrecto: el módulo no manda el horario, la
**cohorte** sí (dos cohortes cursan el mismo módulo en turnos distintos, mañana y
tarde). Las columnas se pusieron en `cohorts`, y el porqué está documentado dentro
de la propia migración.

### 2.3 · Malla curricular (Módulo 7 de la spec, §9)

**Por qué**: no existía. Búsqueda de `malla|curricul` en `app/` daba cero
resultados. Los datos ya estaban (`modules.order_index`), solo faltaba la pantalla.

**Archivos tocados**:
- `app/(app)/malla/page.tsx` — **NUEVA**. Los módulos del programa en orden, con
  estado *cursado / cursando ahora / por cursar* derivado del `order_index` del
  módulo actual de la cohorte, y la marca de homologado INCES.
- `app/(app)/clases/page.tsx` — enlace al final de "Mi módulo".

**Decisión tomada**: no se agregó a la barra de navegación inferior. Ya tiene 5
pestañas y una sexta rompe la regla de "todo alcanzable con un pulgar"
(`CLAUDE.md` §9). Se llega desde "Mi módulo".

**Cuidado**: sin puntos, sin niveles, sin insignias y sin comparación entre
estudiantes — eso es Fase 2 y está prohibido por `CLAUDE.md` §7. La malla solo
muestra el camino.

### 2.4 · Asistencia general con filtros (Módulo 8 de la spec, §10.2)

**Por qué**: `/asistencias` es la pantalla **operativa del sábado** (marcar rápido
a quien falte, ver quién ya llegó). La spec pide otra cosa: una vista de
**consulta** desde la computadora de administración, con histórico y filtros. Son
dos necesidades distintas, así que se hizo una pantalla nueva en vez de sobrecargar
la que ya funciona.

**Archivos tocados**:
- `app/(admin)/asistencias/historico/page.tsx` — **NUEVA**. Filtros por programa,
  módulo, cohorte y rango de fechas; columna "registró: X (escaneo QR / a mano)";
  % de asistencia por estudiante ordenado de menor a mayor; botón "ver solo
  ausencias"; descarga a Excel de lo filtrado.
- `app/(admin)/asistencias/page.tsx` — enlace a la nueva vista; el título pasó a
  "Asistencia de hoy" para que se entienda la diferencia.

**Detalle de implementación que hay que entender antes de tocarlo**: una ausencia
**no es una fila en la base de datos**. Se calcula cruzando los estudiantes de cada
cohorte × las sesiones del rango, y marcando ausente a quien no tenga
`attendance_events`. Por eso el listado se corta en 300 filas en pantalla (el Excel
sí las lleva todas).

**Lo que esta pantalla NO tiene**: los estados `tarde` y `justificado` que pide la
spec. `attendance_events` no los soporta — la asistencia hoy es binaria. Eso es el
punto 3.3 de este documento.

### 2.5 · Estado del despliegue del Bloque A

✅ La migración `052` se aplicó (verificado con `select` sobre `cohorts`, las 7
cohortes reales tienen `days`/`schedule` correctos). Bloque A cerrado y en producción.

---

## 2bis. Lo que se ejecutó después, con las preguntas ya respondidas (commit `bff331e`)

El cliente respondió las preguntas abiertas de la sección 4.4 (ver ahí el detalle
de cada respuesta). Con eso resuelto, se ejecutó todo lo que no era Odoo:

- **B-1 · Términos y condiciones** — `terms_acceptances` +
  `system_config['terms.version'/'terms.text']`. Gate en `/aceptar-terminos`,
  independiente del formulario de primer login y de la validación de admin.
  Subir `terms.version` obliga a re-aceptar a todos. **El texto legal sigue
  siendo el placeholder** — falta que alguien lo redacte y lo cargue en
  `system_config` desde Configuración (no requiere código).
- **B-3 · Estados tarde/justificado** — `attendance_events.status` se calcula
  en el servidor (trigger) contra `system_config['attendance.tarde_umbral_minutos']`.
  Las ausencias justificadas viven en `attendance_justifications` (tabla
  nueva, porque una ausencia nunca fue un evento). `/asistencias/historico`
  ya muestra los 4 estados y tiene el botón "Justificar ausencia".
- **B-4 · Video + visor inline** — `content_type` acepta `'video'`, tope de
  tamaño en `system_config['content.max_size_mb']` (200 por defecto). El
  estudiante ve el PDF/video embebido en `/contenido`, ya no abre pestaña
  nueva. **Sin tocar todavía**: la pantalla de subida del profesor
  (`app/(profesor)/contenido-docente`) sigue solo aceptando PDF — se
  actualizó la del admin (`app/(admin)/material`), no esa.
- **C-2 · Profesor↔módulo** — el cliente confirmó el modelo de la spec
  ("profesor dueño de módulo"). Se agregó `teacher_module_assignments` (N:M)
  y un selector de módulos por profesor en `/personal`.
  **Alcance limitado a propósito**: esto NO reemplaza `cohorts.teacher_id` ni
  `class_sessions.teacher_id` — esos siguen siendo los que de verdad
  controlan quién puede tomar asistencia, calificar y ver notas
  (`teaches_cohort()`). Migrar esos flujos para que dependan del módulo en
  vez de la cohorte es una tarea aparte, más grande, que no se hizo para no
  romper lo que ya funciona.
- **B-2 · Descartado** — el cliente confirmó que el proceso termina en la
  firma física. No hace falta digitalizar la planilla firmada; con
  `students.validated_at` alcanza.
- **C-3 · Sin cambios** — el cliente confirmó que la generación automática
  por cron (sin aprobación, ligada al módulo actual del estudiante) es el
  comportamiento que quiere. Coincide con lo que ya había.
- **C-4 · Pospuesto** — el cliente pidió dejarlo para después del 5 de
  septiembre. No se tocó.

**Todavía sin verificar en el navegador** — se probó `tsc`, `eslint` y
`npm run build`, pero nadie hizo clic en `/aceptar-terminos`, justificó una
ausencia desde `/asistencias/historico`, subió un video desde `/material`, ni
asignó un módulo desde `/personal`. Hazlo antes de dar esto por cerrado.

---

## 3. Lo que FALTA, en orden de dificultad

### 3.1 · BLOQUE B — Medio (migración nueva + una pantalla)

#### B-1 · Términos y condiciones / consentimiento de datos (spec §20)

**El más urgente del bloque, por exposición legal.** No existe la tabla
`TermsAcceptance`, ni casilla de aceptación, ni versionado, ni re-aceptación
cuando el texto cambia. Y la app **sí almacena datos de salud de menores**
(`student_profile_details.health_conditions`, migración 047).

Qué hace falta:
- Migración nueva: tabla con `user_id`, `terms_version`, `accepted_at`,
  `ip_address` + RLS.
- Casilla obligatoria y **no premarcada**, con enlace al texto completo. Como en
  esta app no hay autoregistro, el punto natural es `/completar-perfil` (el
  formulario del primer login), no el registro.
- Al subir `terms_version`, pedir aceptación de nuevo en el siguiente login.
- **Pregunta abierta con el cliente**: para menores, ¿el consentimiento digital se
  asocia al representante y no al estudiante? La spec §20.1 lo marca como
  pendiente de validación legal. El texto legal lo redacta un abogado, no nosotros.

#### B-2 · `SignableDocument` — registro de la planilla y escaneo firmado (spec §4.4)

Hoy la planilla se renderiza al vuelo y se imprime; no queda rastro de que se
generó ni de que se firmó. El único indicio es `students.validated_at`.

Qué hace falta: tabla con `student_id`, `student_code`, `generated_at`, `signed`,
`signed_at`, `file_url`, y la posibilidad de **subir el escaneo de la planilla
firmada**. El bucket privado `consentimientos` ya existe (migración 015) y hoy solo
lo usa `parental_consents.document_url`.

**Pregunta abierta bloqueante** (spec §14, punto 3): ¿el cliente realmente quiere
digitalizar la planilla firmada, o el proceso termina en la firma física? Si es lo
segundo, esta tarea se reduce a la mitad. **Pregunta antes de construir.**

#### B-3 · Estados `tarde` y `justificado` en asistencia (spec §10.2)

La asistencia es binaria: hay evento de escaneo o no lo hay. La spec pide cuatro
estados. Requiere migración sobre `attendance_events` y ajustar la pantalla del
punto 2.4, que ya está preparada para recibirlos (hay un comentario en el archivo
señalando exactamente dónde).

#### B-4 · Classroom: más tipos de archivo y visor integrado (spec §6)

Dos problemas separados:
- **Solo se aceptan PDFs.** El enum `content_type` (migración 001) no tiene
  `video`, y `app/(admin)/material/page.tsx` valida `archivo.type !== 'application/pdf'`
  y sube con `contentType: 'application/pdf'` fijo.
- **No hay visor.** `app/(app)/contenido/page.tsx` genera una URL firmada de 300 s
  y hace `window.open` en pestaña nueva. La spec §6 pide exactamente evitar eso
  ("minimizar fricción, que no tenga que descargar cada archivo").

Antes de tocar video, leer la sección 4 de este documento: el capítulo de hosting
de la spec está obsoleto, pero **la advertencia sobre el peso del video sigue
siendo válida** — hay que definir tamaño máximo por archivo.

### 3.2 · BLOQUE C — Complejo (cambia el modelo de datos o cruza varios módulos)

#### C-1 · Carpetas jerárquicas en el Classroom (spec §6)

No existe la tabla `Folder`. El contenido se organiza por `module_id` +
`week_number`, que es plano. La spec pide "comportarse como un Google Classroom
simplificado" con carpetas anidadas.

#### C-2 · Asignación profesor ↔ módulo, muchos a muchos (spec §7, Módulo 5)

**Este es el que más rompe supuestos de la spec, léelo con cuidado.** La spec
asume que un profesor es "dueño de uno o más módulos" y construye los Módulos 4, 6
y 8 sobre esa premisa. En ZR App el modelo real es **un profesor por cohorte**
(`cohorts.teacher_id`, migración 004) y por sesión (`class_sessions.teacher_id`).
No existe `TeacherModuleAssignment` ni pantalla de admin para asignar módulos.

Antes de construir la tabla N:M hay que decidir si de verdad se quiere cambiar el
modelo o si la spec simplemente describió mal lo que ya existe. **Es una pregunta
de producto, no técnica.**

#### C-3 · IA: generar desde el material subido, con aprobación y control de gasto (spec §8, §18)

Lo que existe (migraciones 040 y 042, Edge Function `generar-casos`) **no es lo
que describe la spec**:

| La spec pide | Lo que hay |
|---|---|
| Generar a partir del material subido al Classroom | Genera por módulo × día de la semana, sin material fuente. Falta `source_material_id` |
| Estado `draft / approved / published` con revisión del profesor | Se publica directo, nadie revisa |
| Cola de trabajos para no golpear el rate limit | Corre por cron (mitiga el riesgo, pero no hay generación bajo demanda) |
| Tope de generaciones por profesor + batch + caché de prompts | Nada |

**Pregunta abierta** (spec §18.2): ¿quién es el dueño del presupuesto de IA? De eso
depende si hace falta un panel de gasto para administración.

#### C-4 · Seguridad pendiente (spec §19)

Ya cubierto por Supabase/Vercel: hash de contraseñas, HTTPS, roles validados en el
backend (RLS), secretos fuera del código, URLs firmadas de corta duración.

Falta:
- **2FA para cuentas de administrador** — tienen acceso a datos de salud de menores.
- **Marca de agua con `student_code`** sobre los PDFs del Classroom, para poder
  rastrear una filtración.
- **Límite de descargas por cuenta**, contra scripts que bajen todo el material.

**Pregunta abierta** (spec §19.3): ¿qué tan crítico es esto para la academia? El
esfuerzo cambia muchísimo según si el material es de bajo riesgo o tiene valor
comercial alto.

### 3.3 · BLOQUE D — Aparte, para después

#### D-1 · Integración con Odoo (spec §3 y §12)

**Cero líneas de código en todo el repo.** No hay `odoo_contact_id` en `students`,
ni cliente XML-RPC/REST, ni sincronización desde `create-student`. La spec lo pide
como escritura **simultánea**: al guardar la inscripción, se crea o actualiza el
contacto en el módulo de Contactos de Odoo.

Se separó del resto a propósito porque está **bloqueado por dos cosas que no
dependen del código**:
1. Las credenciales y la URL de Odoo (spec §17.1, punto 4).
2. La decisión del método de sincronización (API REST, XML-RPC o webhook) y el
   mapeo de campos `Student`/`Guardian` → `res.partner`.

Cuando llegue el momento, el lugar natural es la Edge Function `create-student`,
después de que el estudiante ya se creó, y **nunca bloqueando la inscripción si
Odoo no responde** — que la venta no se caiga porque un sistema externo esté abajo.

---

## 4. Divergencias deliberadas y spec obsoleta — NO "corregir"

Esto es lo más importante de todo el documento para quien retome el trabajo.

### 4.1 · Autoregistro web (spec §5.1) — la app hizo lo contrario a propósito

La spec dice: el estudiante entra a `zrmecademy.com`, se registra con cédula,
correo, nombre y contraseña, y el sistema valida su cédula contra la base.

**La app eliminó eso deliberadamente** (commit `90f303c`, "fin del autoregistro,
login por código"). Hoy el vendedor crea la cuenta y **el código de carnet ES la
contraseña** de primer ingreso. El login es por cédula + contraseña en
`app/login/page.tsx`.

Hay que decidir cuál manda: probablemente la spec está desactualizada en este
punto, pero **no lo asumas** — pregúntale al cliente.

Relacionado: tampoco existe la sección de "descargar la aplicación" de la spec
§5.1. La app es una PWA instalable, así que puede que simplemente no aplique.

### 4.2 · Capítulo de hosting (spec §16) — obsoleto

Toda la sección 16 asume un VPS de Hostinger con backend propio, PM2, balanceador
de carga y disco finito. **El stack real es Next.js + Supabase + Vercel**, que
resuelve por diseño los riesgos que ese capítulo describe (en particular el de
§18.3: llenar el disco del VPS y tumbar la base de datos con él).

No hay nada que implementar de §16. Lo que **sí sigue vigente** de §18 es la
disciplina sobre el peso del video y los topes de subida (ver B-4).

### 4.3 · Preguntas abiertas de la spec que el código YA respondió

La spec §14 lista 10 preguntas abiertas. Estas dos ya no lo están:

- **Pregunta 1 — cédula duplicada**: el código **bloquea**.
  `supabase/functions/create-student/index.ts` valida contra `profiles` antes de
  crear nada y devuelve "Ya existe un estudiante con la cédula X". **No hay flujo
  de reinscripción.** Si el cliente quiere uno, es trabajo nuevo.
- **Pregunta 7 — prefijo `PTMA` por sede**: resuelto, y mejor que en la spec. La
  migración `044_student_code_ptma_pfta.sql` deriva `PTMA` o `PFTA` **del programa
  de la cohorte**, nunca del cliente, con código provisional `ZR-PENDIENTE-xxx`
  que se corrige solo en cuanto se asigna una cohorte real.

### 4.4 · Preguntas abiertas que siguen bloqueando

Estas hay que preguntarle al cliente antes de construir lo que dependa de ellas:

| # | Pregunta | Bloquea |
|---|---|---|
| 3 | ¿La planilla firmada se digitaliza y se sube? | B-2 |
| 6 | ¿Quién aprueba el contenido generado por IA? | C-3 |
| 12 (§5.3) | ¿"Grado escolar" es distinto de "nivel de escolaridad" o es redundante? | Ya está implementado como campo aparte (`current_school_grade`) — si es redundante, hay que fusionarlo |
| §18.2 | ¿Quién paga la IA y hay tope mensual? | C-3 |
| §19.3 | ¿Qué tan crítico es el anti-scraping del material? | C-4 |
| §20.1 | Para menores, ¿el consentimiento digital va al representante? | B-1 |

---

## 5. Orden sugerido para retomar

Con B-1, B-3, B-4 y C-2 ya ejecutados (sección 2bis), lo que queda:

1. **Verificar en el navegador todo lo de la sección 2bis** — nada de eso se
   probó corriendo, solo compilando. Es el primer paso, antes de tocar nada nuevo.
2. **Cargar el texto legal real de Términos y Condiciones** en
   `system_config['terms.text']` en cuanto lo redacte administración/un
   abogado — es solo editar una fila, no requiere código.
3. **C-1, carpetas jerárquicas del Classroom** — el que queda del bloque C
   que no depende de ninguna pregunta abierta, solo de tiempo.
4. **C-4, seguridad extra** — el cliente pidió dejarlo para después del 5 de
   septiembre; retomarlo cuando se acerque esa fecha o cuando el material
   tenga valor comercial suficiente para justificarlo.
5. **Odoo (D-1) sigue explícitamente fuera de alcance** — no se toca hasta
   que el cliente lo pida y existan credenciales.

---

## 6. Reglas del proyecto que aplican a todo lo anterior

Recordatorio, porque cada punto pendiente las toca (`CLAUDE.md` §2):

- Toda tabla nueva va **con RLS habilitada y políticas escritas**. Sin excepción:
  son datos de menores de edad.
- **Nunca editar una migración ya aplicada.** La siguiente libre es la `057`.
- Ningún número ni valor de negocio dentro del código: van en `system_config`.
- Nada de Fase 2 ni Fase 3 (pagos, puntos, insignias, mensajería privada).
- Interfaz en español de Venezuela; código y nombres de tablas en inglés.
- Antes de dar algo por terminado: `npm run verify`.
