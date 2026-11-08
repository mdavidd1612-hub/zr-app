# 26 · PAQUETE COMPLETO PARA EL TÉCNICO — ZR APP

> **Qué es este documento:** todo lo que el técnico y su IA necesitan para trabajar en ZR App, en un solo lugar — el "qué construir" y el "cómo construir". Reemplaza y consolida: `docs/24_...`, `docs/25_...`, el `CLAUDE.md` viejo, el plan de sprints, la plantilla de reporte y las instrucciones para la IA.
> **Fecha:** 26 de octubre de 2026 (fusionado con el `docs/26_...` que había quedado aparte el 7 de noviembre de 2026 — ver nota abajo).
> **Autor:** Vita (Pedro para producto, Marco para técnico)
> **Jerarquía:** este archivo (`CLAUDE.md`, en la raíz del repo) es la **única fuente de verdad** — manda en el "qué construir", "en qué orden" y "cómo construir". Es el que toda IA de código lee automáticamente al abrir el repo, por eso es el que se mantiene.
>
> **Nota del 7-nov-2026:** este documento y `docs/26_PAQUETE_COMPLETO_TECNICO_OCT2026.md` se habían separado — cada uno tenía secciones que el otro no tenía (distintas sesiones editaban uno u otro sin saber que existían dos copias). Se reconciliaron en uno solo, aquí en `CLAUDE.md`, porque es el que se carga solo. `docs/26_...` queda como archivo histórico/redirección — no se vuelve a editar.

---

## ÍNDICE

- **PARTE I — Contexto y plan vivo** (§0 a §4)
- **PARTE II — Modelo pedagógico y marco de medición** (§5 a §7)
- **PARTE III — Catálogo de funciones (24 épicos)** (§8)
- **PARTE IV — Flujogramas por rol** (§9)
- **PARTE V — Plan de ejecución con fechas reales** (§10)
- **PARTE VI — Plantilla de reporte del técnico** (§11)
- **PARTE VII — Instrucciones para la IA del técnico** (§12)
- **PARTE VIII — Preguntas abiertas y decisiones tomadas** (§13)
- **PARTE IX — Historial** (§14)

---

# PARTE I — CONTEXTO Y PLAN VIVO

## 0. CLÁUSULA DE PLAN VIVO

### 0.1 Jerarquía de decisión

Cuando algo no coincide con este documento:

1. **No te detengas en seco diciendo "no coincide con el roadmap".** Esa reacción es la que hizo que el técnico pidiera reconstruir el documento maestro.
2. **Di en una línea** qué contradice.
3. **Pregunta a Pedro (producto) o Marco (técnico)** si procedes.
4. **Si dicen "procede", procedes.** Y en el mismo PR actualizas este documento (§8 el épico, §10 el sprint si cambia alcance).

### 0.2 Regla de actualización

Este documento se actualiza **en el mismo PR** que la función. Un PR que agrega función sin actualizar este documento está incompleto.

### 0.3 Qué significa "plan vivo"

Esto es la mejor foto del plan hoy, no una ley. Fechas, prioridades, épicos y funciones pueden cambiar. Lo que no cambia:
- La metodología pedagógica (§5).
- El marco de medición (§7).
- La estructura del documento.

---

## 1. QUÉ ES ZR APP

PWA (web instalable) para la academia técnica ZR Mecademy, Venezuela. Clases los sábados. ~20 estudiantes activos hoy (grupo piloto), planificado para múltiples cohortes simultáneas. Edades 15-25.

Es un **aula virtual completa** que cubre: identidad, inscripción, asistencia, materiales (E-Learning), exámenes, evaluación práctica, notas, feedback, finanzas por cuotas, cantina interna (ZR Coffee), métricas de dirección. **7 roles reales**.

### 1.1 Los 3 objetivos permanentes

Toda función debe mover al menos uno:

1. **Automatizar** procesos manuales (A)
2. **Facilitar flujos** del día a día (F)
3. **Ayudar al estudiante a aprender mejor**, medible (E)

### 1.2 Estado actual

**Fase 1 extendida en producción con grupo piloto activo (20 estudiantes).**
- 131 migraciones aplicadas, 7 roles, 13 Edge Functions.
- Sistema de Notas, Finanzas básica, ZR Coffee en producción.
- Noviembre 2026 arranca nuevo módulo con el mismo grupo → ventana real para validar lo nuevo.

**Alerta de escalabilidad:** la infraestructura debe sostener múltiples cohortes simultáneas desde ya. No construir pensando en 20 estudiantes; construir pensando en 200.

---

## 2. ROLES Y RESPONSABILIDADES

### 2.1 Los 7 roles

| Rol | Qué hace |
|---|---|
| **Estudiante** | Carnet, QR, materiales, casos, exámenes, notas, dudas, feedback, estado de cuenta |
| **Profesor** | Asistencia, materiales de su módulo, casos manuales, evaluación práctica, notas, dudas, feedback agregado |
| **Admin** | Operativo diario: validar inscripciones, mostrar QR, ficha de estudiantes, validar capturas de pago |
| **Dirección Académica** | **Todo lo académico**: profesores, cohortes, módulos, salones, horarios, currículo, comunicados, aprobación de contenido, salud del sistema |
| **Super Admin** | Todo + editar `system_config` |
| **Vendedor** | Captura inicial de leads (pre-inscripción) |
| **ZR Coffee** | Inventario y ventas de la cantina (independiente) |

### 2.2 Multi-rol

Una persona puede tener varios roles (`profile_roles`, muchos a muchos). Pantalla `/elegir-rol`.

### 2.3 División Admin vs Dirección Académica

- **Admin**: operativo del día. Ficha de alumno, asistencia de hoy, validar capturas de pago, mostrar QR.
- **Dirección Académica**: todo lo académico. Cohortes, módulos, profesores, salones, horarios, currículo, comunicados, aprobación de contenido, los 8 indicadores.
- **Mostrar QR en pantalla**: admin, dirección y super_admin.

---

## 3. FLUJO DE INSCRIPCIÓN (crítico, nuevo)

Reemplaza la idea de "consentimiento parental digital" por el modelo real que ya usa la academia.

```
LEAD (fuera del taller o en primera visita)
  ↓ Vendedor abre la app, crea perfil con:
  ↓   - Nombre, correo, cédula
  ↓   - Si menor: datos del padre
  ↓ Estudiante queda "pre-inscrito"
  ↓
IMPRESIÓN
  ↓ Sistema genera documento de inscripción
  ↓ Admin lo imprime
  ↓
DÍA DE INSCRIPCIÓN (físico)
  ↓ Estudiante llega (con el padre si menor)
  ↓ Firman la hoja física
  ↓ Pagan la inscripción
  ↓
VALIDACIÓN POR ADMIN
  ↓ Admin verifica firma + pago
  ↓ Marca estudiante como "activo"
  ↓ Sistema genera clave temporal
  ↓ Admin entrega credenciales
  ↓
PRIMER ACCESO
  ↓ Estudiante descarga la PWA desde la web
  ↓ Entra con correo + cédula + clave temporal
  ↓ Cambia la clave
  ↓ Completa perfil (datos INCES, foto)
  ↓ Acepta T&C
  ↓ Sistema emite carnet digital con QR
  ↓
LISTO para primera clase
```

**Futuro:** convertir la hoja física en firma digital en tablet (B.13).

---

## 4. QUÉ NO SE CONSTRUYE (decisiones de producto)

- Mensajería privada entre usuarios.
- Reprobación automática por inasistencia.
- Bloqueo de acceso físico al taller.
- Google Classroom.
- Comparación entre estudiantes visible para ellos.
- Red social (en el futuro sí, no ahora).

Estas no se construyen ahora. Si Pedro cambia alguna, se actualiza este documento.

---

# PARTE II — MODELO PEDAGÓGICO Y MARCO DE MEDICIÓN

## 5. MODELO PEDAGÓGICO

Las 4 reglas, los 4 estados de dominio, el ciclo semanal, los 5 niveles de IA. Esto es la pedagogía que la app refleja. Rescatado de `metodologia/01_MODELO.md`.

### 5.1 Las 4 reglas del modelo

**Regla 1 — La nota nace el sábado.** El trabajo digital de lunes a viernes no produce nota. Es registro y evidencia de participación. La nota sale del examen y la evaluación práctica del sábado.

**Regla 2 — Los puntos críticos no promedian.** Un ítem crítico es un paso que en el taller real mata a alguien (no usar guantes con electrolito, no desconectar borne negativo primero). Fallar uno **no baja la nota**: marca la evaluación como "requiere refuerzo" y genera una alerta al profesor.

**Regla 3 — Repetir no castiga.** El número de intento se registra pero **no afecta la nota final**. La nota es el estado de dominio alcanzado, no el promedio de los tramos.

**Regla 4 — La compuerta es señal, no bloqueo.** Un estudiante que llega al sábado sin trabajar la semana queda señalado al profesor, pero no se le prohíbe entrar. Nadie se queda fuera del taller por no haber abierto la app.

### 5.2 Los 4 estados de dominio

| Estado | Cuándo | Qué significa |
|---|---|---|
| **Dominada** | nota ≥ 16 | Lo hace solo y lo sabe explicar |
| **En desarrollo** | nota ≥ umbral de aprobación | Aprueba, le falta soltura |
| **Requiere refuerzo** | por debajo del umbral | Hay que volver sobre esto |
| **Pendiente** | todavía no se evalúa | No ha llegado su sábado |

**Umbrales:** 12 por defecto, 10 solo primer módulo. De `system_config`, nunca hardcoded.

**Fórmulas:**
- Nota práctica = `checklist × 70% + defensa técnica × 30%`, sobre 20
- Nota del módulo = `teórico × 50% + práctica × 50%`

### 5.3 El ciclo semanal — una tarea por día

| Día | Qué hace el estudiante | Peso |
|---|---|---|
| Lunes | Lee la guía de la semana | Ninguno |
| Martes | Caso **sintético** | Ninguno |
| Miércoles | Caso **real** del taller | Ninguno |
| Jueves | Manda su duda de la semana | Ninguno |
| Viernes | Diagnóstica corta de 3 preguntas | Ninguno |
| Sábado | Clase + evaluación práctica + examen | **Todo** |

**La duda del jueves es el guion de la clínica del sábado.** El profesor la recibe agrupada por tema. No es anónima (necesita saber a quién volver).

### 5.4 El caso en 4 pasos

Hipótesis → qué medirías → razonamiento → **qué tan seguro estás**.

La referencia no se revela hasta completar los 4. Al revelarla se le devuelve la calibración.

El cruce que más enseña: **acertó = NO, confianza = ALTA** → *"Estabas seguro y no era."*

### 5.5 Los 5 niveles de IA

| Nivel | Qué se permite | Dónde |
|---|---|---|
| **N0** | Sin IA | Exámenes y evaluación práctica del sábado |
| **N1** | IA como tutor — explica, no resuelve | Guía de la semana |
| **N2** | IA como asistente — ayuda a redactar | Razonamiento del caso |
| **N3** | IA como copiloto — se usa y **se declara** | Trabajos largos |
| **N4** | IA como **objeto de auditoría** — el estudiante la critica | Avanzado |

El control real es presencial. El sábado se evalúa sin dispositivos.

---

## 6. 10 REGLAS ABSOLUTAS TÉCNICAS

Del `CLAUDE.md` existente. Siguen vigentes.

1. **Nunca escribas una tabla sin RLS.**
2. **Nunca calcules notas, aprobaciones ni validaciones de QR en el navegador.** Edge Functions, servidor.
3. **Nunca envíes `exam_questions.correct_answer` al estudiante.** Usa `v_exam_questions_student`.
4. **Nunca uses `service_role` en navegador.** Solo Edge Functions y rutas servidor Next.
5. **Nunca escribas un número de negocio en código.** Vienen de `system_config`.
6. **Nunca edites una migración ya aplicada.** Crea una nueva.
7. **Nunca implementes reprobación automática por inasistencia.**
8. **Nunca implementes bloqueo de acceso físico.**
9. **Nunca permitas que el rol venga del cliente.**
10. **Nunca construyas nada de Fase 2 o Fase 3** (salvo las excepciones ya aprobadas: Finanzas y ZR Coffee).

---

## 7. MARCO DE MEDICIÓN

### 7.1 Los 3 niveles

| Nivel | Qué mide | Cada cuánto |
|---|---|---|
| **Línea base** | Antes vs después del piloto, con grupo de control | Al empezar y al cerrar trimestre |
| **8 indicadores** | Si el modelo semanal funciona | Cada 2 semanas |
| **Métrica por función** | Si la función se usa y da valor | Continuo, dashboard dirección |

### 7.2 Grupo piloto

**Decisión tomada:** los 20 estudiantes actuales son el piloto. Noviembre arranca nuevo módulo con ellos.

**Lo que falta capturar antes de noviembre:**
- Prueba práctica común (U.1).
- Encuesta de motivación 6 ítems, semana 0 (U.3).
- Export histórico de 3 cohortes anteriores de Odoo (U.4).

### 7.3 Los 8 indicadores explicados con ejemplo real

Para una cohorte de 20 estudiantes haciendo módulo "Sistema de frenos":

**Indicador 1 — Completitud antes del sábado.** De los 20, cuántos llegaron al sábado habiendo terminado las tareas de la semana. *Ejemplo: 14/20 = 70%. Si está bajo, nadie usa la app entre semana.*

**Indicador 2 — Señalados por la compuerta.** Los que llegaron sin preparación. **No se les prohíbe entrar.** Es una señal al profesor. *Ejemplo: 6/20 señalados.*

**Indicador 3 — Dominio al primer intento.** Cuántos aprobaron a la primera. *Ejemplo: 15/20 dominaron "sangrar sistema" al 1er intento = 75%. Si alto, material bien. Si bajo, enseñar distinto.*

**Indicador 4 — Intentos hasta el dominio.** De los que no aprobaron a la primera, promedio de intentos. *Ejemplo: "ajustar freno de mano" promedio 2.8 intentos → alerta.*

**Indicador 5 — Fallo en ítems críticos. EL MÁS IMPORTANTE.** *Ejemplo: 8/24 fallaron "verificar presión antes de soltar el gato". El problema no está en los 8, está en que ese paso hay que enseñarlo distinto.*

**Indicador 6 — Nivel promedio de defensa técnica.** Promedio 1-4 de las respuestas orales. *Ejemplo: 2.8/4. Separa al que ejecutó de memoria del que entendió.*

**Indicador 7 — Retención diferida.** Cuestionario en semana 6 sobre contenido de semana 2. *Ejemplo: 65% recordaron. Es la diferencia entre pasar y aprender.*

**Indicador 8 — Asistencia y deserción.** El operativo básico, ya funciona con QR.

**Entrega automática:** los 8 van por correo a coordinación todos los lunes y están en `/inicio/salud` del panel de dirección.

### 7.4 Encuesta de motivación — 6 ítems

Escala 1-5, anónima. Semanas 0, 6 y 12.

1. Siento que estoy aprendiendo algo que voy a usar en un taller real.
2. **Sé exactamente qué me falta para dominar lo que estoy estudiando.**
3. **Cuando me equivoco, sé qué hacer para corregirlo.**
4. Puedo decidir cosas sobre mi propio aprendizaje.
5. **Si me esfuerzo más, mi resultado mejora.**
6. Me siento parte de un grupo que trabaja junto.

Ítems 2, 3 y 5 son los que la app debe mover primero. Si en semana 6 no se movieron, el problema es de **implementación, no de diseño**.

### 7.5 Qué NO se mide

- Tiempo dentro de la app.
- Comparaciones entre estudiantes visibles para ellos.
- Nada individual del feedback anónimo.

---

# PARTE III — CATÁLOGO DE FUNCIONES

## 8. LOS 24 ÉPICOS

Convenciones: **Estado** ✅ producción · 🟡 parcial · 🔴 no construido · **Prio** P0 crítica · P1 alta · P2 media · P3 futuro · **Obj** A automatizar · F facilitar · E educación.

> **Nota:** el detalle completo de las ~180 funciones individuales de los 24 épicos está en el documento `25_ROADMAP_MAESTRO_v2_OCT2026.md` que ya tienes. Aquí solo listo el mapa de épicos y las funciones nuevas o modificadas desde esa versión. Si vas a tocar código, lee el `25` para la función específica.

### Mapa de épicos

| Épico | Nombre | Estado general | Dónde se trabaja |
|---|---|---|---|
| A | Cimientos técnicos | 🟡 | Infraestructura, siempre |
| B | Identidad, acceso e inscripción | 🟡 (B.5-B.8 nuevos) | Sprint 2 |
| C | Asistencia y refrigerio (2 QR separados) | ✅ | Mantener |
| D | Diagnóstico de entrada | ✅ | Mantener |
| E | Ciclo semanal | 🔴 | Sprint 5 |
| F | E-Learning / Aula Virtual (del profesor) | 🟡 (construido en staging, ver §8.1) | Sprint 3 y 4 |
| G | Casos (metodología PBL) | 🔴 | Sprint 5 |
| H | Evaluaciones (fusionadas con Notas) | 🟡 (ver §8.1) | Sprint 7 |
| I | Evaluación práctica | 🔴 | Sprint 6 |
| J | Notas y progreso | 🟡 | Sprint 6 |
| K | Feedback | ✅ | Mantener |
| L | Panel del profesor | 🟡 | Sprint 8 |
| M | Panel admin (operativo diario) | ✅ | Mantener |
| N | Dirección académica | 🟡 (N.7-N.11 nuevos) | Sprint 1 base, 6 completo |
| O | Finanzas "cachea" | 🟡 | Sprint 8 |
| P | ZR Coffee (independiente) | ✅ | Mantener |
| Q | PWA e instalación | ✅ | Mantener |
| R | UX e interfaz | 🔴 | Sprint 0 auditoría, 7-10 rediseño |
| S | Egresados y comunidad | 🔴 | P3 futuro |
| T | Simulación y microlearning | 🔴 | P3 futuro |
| U | Medición (8 indicadores) | 🟡 | Sprint 0 base, 4 dashboard |
| V | Calendario único | 🔴 | Sprint 3 |
| W | Tutor IA socrático | 🔴 | P3 futuro |
| X | Dudas mejoradas | 🟡 | Sprint 5 |

### Totales

- **5 épicos ✅** en producción, se mantienen (C, D, K, M, P, Q — 6 en realidad).
- **7 épicos 🟡** parciales, se extienden en los sprints.
- **12 épicos 🔴** por construir.
- **~180 funciones individuales** en total.
- **~140 funciones** entre P0 y P1 (lo que entra en los sprints).
- **~40 funciones P2/P3** (backlog).

### 8.1 Auditoría del 31-oct-2026 — Módulo E-Learning (Aula Virtual) ya construido en staging

Se auditó el documento "ZR App — Módulo E-Learning" contra `zr-staging` y el código (aplica §12.6). **El módulo está construido en `develop` → `zr-staging`, migraciones 174–187; NO está mergeado a `zr-prod` todavía (salvo el hotfix puntual de §8.3), y las tablas están vacías (estructura lista, falta cargar contenido).** Reutiliza tablas existentes: materiales = `content_items` (extendida), quizzes = `exams` (extendida), más `units`, `unit_items`, `material_progress`, `assignments`, `submissions`, `calendar_events`, `activity_log`, `doubts`/`doubt_responses`, `intervention_grants`.

**Estado de los 5 huecos de esta auditoría (actualizado 4-nov-2026) — los 5 están ✅ cerrados:**

| # | Hueco | Estado | Dónde |
|---|---|---|---|
| 1 | Exámenes configurables desde la app (tipo, nota mínima, intentos, enfriamiento) | ✅ Cerrado (nov 2026) | Épico H, bullet abajo |
| 2 | Compuerta real entre unidades (contradicción con §5.1 resuelta con el coordinador: compuerta por orden, no mapa manual) | ✅ Cerrado (migr. 185, nov 2026) | Épico F, bullet abajo |
| 3 | Mini-chequeo al terminar un video/audio (UI; la base ya existía desde migr. 177) | ✅ Cerrado (nov 2026) | Épico F, bullet abajo |
| 4 | UI de prerrequisitos/ventanas de visibilidad por ítem | ✅ Superado por el Hueco 2 — la compuerta por orden (migr. 185) reemplaza la necesidad de administrar `prerequisite_unit_id` a mano; no se construyó UI aparte porque dejó de hacer falta | — |
| 5 | Bloques de texto dentro de la unidad (pedido nuevo del coordinador, no del análisis original) | ✅ Cerrado (migr. 186/187, nov 2026) | Épico F, bullet abajo |

Lo que queda pendiente del módulo **no** son huecos del análisis — son faltantes ya conocidas del épico F/H de siempre (marca de agua, conversión PPTX/DOCX→PDF, YouTube embed, banco de preguntas aleatorio en el constructor, importación masiva de preguntas), listadas en los bullets 🔴/🟡 de abajo.

**Épico F (E-Learning) → 🟡 (antes 🔴).**
- ✅ Unidades: estados, `open_at`/`close_at`, visibilidad por elemento, prerrequisito (migr. 174)
- ✅ Visor embebido: PDF (pdf.js/canvas), imagen, audio, video nativo con URL firmada (`VisorMaterial.tsx`, migr. 175)
- ✅ Seguimiento por segmentos vistos (adelantar no cuenta) + guardado ~15s (migr. 177)
- ✅ Tareas: entrega PDF, descarga individual firmada, calificación inline (migr. 178)
- ✅ Calendario auto-alimentado + export iCal `fn_calendar_ical` (migr. 179)
- ✅ Dudas por unidad/material, FAQ, respuesta oficial, resumen IA `resumir-dudas` (migr. 180/182)
- ✅ **Compuerta real entre unidades por orden (migr. 185, nov 2026):** una unidad se bloquea solo si la unidad inmediatamente anterior tiene una certificación publicada sin aprobar. Bloqueo de contenido en RLS (no solo UI), unidad bloqueada visible con candado, y barra de materiales obligatorios que traba la certificación hasta completarlos. El profesor no administra prerrequisitos a mano: basta con marcar un examen como certificación.
- ✅ **Bloques de texto dentro de la unidad (migr. 186/187, nov 2026):** el profesor escribe título + párrafo directo en la unidad, sin subir archivo. Reutiliza `content_items` con `type='texto'` (nuevo valor del enum) y guarda el cuerpo en `description`; se muestra expandido en línea (no abre un visor aparte) y no cuenta como "material obligatorio" porque no pasa por `material_progress`.
- ✅ **Mini-chequeo al terminar un video/audio (nov 2026, cierra hueco de auditoría):** la base ya existía desde la migración 177 (`content_items.check_quiz_id`, `material_progress.validated`, el trigger que valida al aprobar el examen); faltaba la UI. El profesor asocia un examen formativo del módulo al material (en "Editar unidad", solo para video/audio); el estudiante, al completar el material, ve la invitación a hacer el mini-chequeo y, si lo aprueba, el material queda validado para la barra de obligatorios.
- 🔴 Falta: marca de agua (F.19) · conversión PPTX/DOCX→PDF (F.5; hoy abre en visor de Office) · YouTube embed (F.14) · proveedor de video + marca quemada · transcodificación MPG→MP4

**Épico H (Evaluaciones) → 🟡.**
- ✅ Constructor de exámenes (opción múltiple, V/F, redacción), intentos/cooldown/tope, timer de servidor (`exam_attempts.expires_at`), calificación en servidor (`submit-attempt`, `grade-answer`), estado "Requiere intervención" (`intervention_grants`) (migr. 176)
- ✅ **Modelo de evaluación configurable desde la app (nov 2026, cierra hueco de auditoría):** al crear/editar un examen el profesor elige tipo (formativo / certificación), nota mínima, intentos y horas de enfriamiento. Antes esos campos solo se podían cambiar por SQL, así que la compuerta de certificación nunca se activaba desde la UI.
- 🟡 Banco de N al azar: columnas `questions_per_attempt`/`seed` existen y el estudiante usa la semilla, pero falta la opción en el constructor del profesor (H.11/H.12)
- 🔴 Falta: importación masiva de preguntas desde Excel/CSV (H.14) · descarga masiva de tareas en ZIP

> Con esto F deja de ser 🔴 (los "Totales" de arriba quedan desfasados; se recalculan al mergear a producción).

### 8.2 Decisiones de la reunión del 31-oct-2026 — Aula Virtual

Reunión Pedro + Marco, minuta + transcripción (`Reunión ZR APP Modulo E-learning 31 de octubre.pdf`). Contradecía lo construido esa misma tarde (§0.1); se confirmó con Marco y se aplicó en el mismo PR.

- ✅ **Examen se crea DENTRO de la unidad**, no en pantalla aparte que luego se enlaza. `/crear-examen/nuevo?unitId=` precarga el módulo de la unidad y, al guardar, se engancha solo (`unit_items`) y vuelve a la unidad. El flujo viejo (crear aparte, luego "agregar examen ya creado") sigue disponible para reusar un examen entre unidades.
- ✅ **Material, mismo patrón**: `/contenido-docente?unitId=` abre el formulario ya expandido y, al subir, se engancha solo a la unidad.
- ✅ **"Material" se retira como sección aparte** del menú de profesor y estudiante — redundante con Aula Virtual, que ya centraliza todo. Las pantallas (`/contenido-docente`, `/contenido`) siguen existiendo (código intacto), solo dejan de ser pestaña del menú.
- ✅ **Dirección Académica**: ya tenía los mismos permisos que el profesor para bloquear/ocultar unidades y archivos (RLS vía `is_staff()`, desde antes de esta reunión) — no hizo falta tocar la base. Su "Material" (`/material`, el explorador tipo Classroom) se mantiene intacto; se le agregó un atajo "Organizar directo en Aula Virtual" para no obligarla al recorrido completo programa→módulo→unidad.
- ⏳ **Pendiente, no es código**: perfil de profesor para "el tío Jesús" con módulo de Proyecto (seguimiento de proyecto de grado) — requiere que Dirección Académica cree el módulo y lo asigne, vía las pantallas que ya existen (`N.7-N.10`).
- Confirmado, ya documentado desde antes, sin cambios: penalización de reintentos (80% en el segundo intento, §7.4 del módulo E-Learning) y calendario auto-alimentado con export iCal — ambos ya estaban construidos.

### 8.3 Auditoría del 4-nov-2026 — Soporte multi-programa

Pedido del coordinador antes de sumar un tercer programa (fin de semana del 7-8 nov 2026, Erika carga los nuevos estudiantes como vendedora): verificar que todo el sistema soporta varios programas activos a la vez, no solo PTMA/PFTA.

**Lo que ya estaba bien (sin tocar):**
- El modelo de datos ya es multi-programa de fondo: `programs` → `modules`/`cohorts` por `program_id`. En producción ya conviven PTMA y PFTA (2 programas, 13 módulos y 2 cohortes cada uno) desde antes de esta auditoría — sumar un tercero es agregar filas, no rediseñar nada.
- Las funciones RLS que de verdad importan (`my_module_id`, `my_cohort_id`, `modulos_que_imparto`) se resuelven siempre desde la fila propia del estudiante/profesor (su `cohort_id`/asignación), nunca de una lista fija de programas — escalan solas a cualquier número de programas.
- El formulario de inscripción (vendedor/admin/dirección, `FormularioInscripcion.tsx`) ya lista TODAS las cohortes `activa` sin filtrar por programa, con el programa como etiqueta visible (`SelectorCohorte`) — Erika va a poder elegir el programa nuevo igual que los demás en cuanto exista la cohorte.
- Constructor de exámenes del profesor (`crear-examen/nuevo` y `[examId]`): ya filtra los módulos a los que el profesor tiene asignación, sin importar cuántos programas haya.
- Gestión de profesores (`/personal`): ya agrupa y filtra módulos por programa al asignar.

**Bug real encontrado y corregido en el mismo PR:** en Gestión de Cohortes (`/cohortes`, Dirección Académica), el selector de "Módulo inicial" al crear una cohorte y el de "Avanzar de módulo" de una cohorte existente mezclaban los módulos de **todos** los programas sin filtrar ni etiquetar. Con 2 programas (26 módulos en una sola lista) ya era fácil asignarle a una cohorte el módulo del programa equivocado por error, rompiéndole el Aula Virtual y los exámenes a esa cohorte entera. Se corrigió filtrando cada selector por el programa real. De paso, el selector que define el programa del carnet (PTMA/PFTA/el nuevo) estaba rotulado "Sede" por error — se corrigió a "Programa".

**Corrección de terminología (el coordinador, sobre el borrador inicial de esta auditoría):** "programa nuevo" en el lenguaje de la academia es un **corte/cohorte nuevo de un programa que ya existe** (PTMA o PFTA) — no un currículo desde cero. Eso es self-service desde siempre: `/programas` (perfil de vendedor, "+ Nuevo programa de PTMA/PFTA") y, desde esta auditoría, también `/cohortes` ("Programas" en el menú de Dirección Académica y super_admin — ver más abajo). Un programa **de verdad** nuevo (currículo distinto) sí requiere crear primero una `sede` nueva vía `/catalogo` (exclusivo de super_admin, `crear_sede_con_programa()`, migración 070) — cada sede tiene su propio programa/currículo 1 a 1 (R-20/R-21).

**Segundo fix del mismo chequeo — acceso para Dirección Académica y super_admin:** `/cohortes` (mismo CRUD que `/programas`: crear corte, asignar profesor/módulo inicial, avanzar, terminar) tenía código intacto pero estaba retirada del menú desde una fase anterior — solo el vendedor podía abrir un programa nuevo. A pedido explícito del coordinador, se reexpuso en el menú de Dirección Académica y super_admin (grupo "Dirección académica", como "Programas") para que no dependa de que haya alguien de ventas disponible. Verificado en vivo en `zr-staging`: Dirección Académica creó un corte de prueba de punta a punta (RLS, nombre y correlativo automáticos) y se confirmó que super_admin también ve el acceso.

**Limitación menor, no bloqueante:** `app/(app)/malla/page.tsx`, cuando un estudiante todavía no tiene cohorte asignada, muestra una malla "estática" que asume que el contenido de los módulos es el mismo en todos los programas (deduplica por `order_index` sin distinguir programa). Es cierto hoy entre PTMA/PFTA; si algún día un programa (sede) tiene un currículo distinto, un estudiante sin cohorte todavía vería una malla potencialmente mezclada hasta que lo asignen a su cohorte real. Como es un estado transitorio (antes de la validación de admin) y de bajo impacto, se deja documentado en vez de corregido en esta pasada.

**Limpieza de datos en producción (pedida por el coordinador):** de las 4 cohortes que había en `zr-prod`, solo `PTMA-2026-II` era real (20 estudiantes, profesor asignado, activa). Las otras 3 estaban vacías (0 estudiantes, sin profesor, sin exámenes/notas/material, solo sesiones de clase molde sin asistencia) — se eliminaron directo en producción. Los `programs` (PTMA, PFTA) se dejaron intactos.

**Tercer fix del mismo chequeo (5-nov-2026) — preview del nombre en `/programas`:** el coordinador reportó con captura de pantalla que, al crear un corte nuevo de PTMA, el "Se llamará" mostraba `PTMA-2026-II`, un nombre que ya existía. **No era un bug del servidor** — `fn_set_cohort_code_number` (migr. 057/060) siempre calcula `max(code_number)+1`, nunca duplica nada de verdad. El bug era del *preview* del cliente en `/programas` (perfil de vendedor): contaba CUÁNTAS cohortes de ese programa/año había (`length+1`) en vez de mirar el `code_number` MÁXIMO real de esas cohortes. Con una cohorte cuyo `code_number` ya venía en 2 desde antes de esta auditoría (no por algo que se tocara aquí), el conteo (1) y el máximo real (2) no coincidían, y el preview mostraba un número ya usado — aunque el servidor, al guardar, iba a poner el correcto. Se corrigió para que el preview calcule igual que el servidor (máximo real + 1). El nombre, de todas formas, siempre fue editable después de creado (botón "Corregir", en `/programas` y en `/cohortes`) — eso ya estaba bien, no hizo falta tocarlo.

**Estado de despliegue:** los tres fixes de este chequeo (filtro de módulos por programa, acceso de Dirección Académica/super_admin a `/cohortes`, y el preview del nombre en `/programas`) **ya están en `zr-prod`** (hotfixes acotados, cherry-pick de commits puntuales de `develop` a `main`, sin arrastrar el resto del módulo E-Learning que sigue solo en `zr-staging` sin validar con datos reales). Si en producción no se ve el acceso a "Programas" en el menú de Dirección Académica/super_admin, revisar primero: (1) que la cuenta probada sea realmente `direccion_academica` o `super_admin` — `admin` normal no lo tiene, nunca lo tuvo; (2) que no sea el PWA mostrando una versión en caché — forzar recarga o reinstalar.

### 8.4 Ronda de UX del coordinador (5-nov-2026) — Aula Virtual, sobre lo visto en `zr-staging`

El coordinador probó el módulo en `zr-staging` (viendo el video de referencia de nuevo) y pidió, por audio, una ronda de correcciones. **En paralelo, otra sesión ya estaba trabajando varias de las mismas pantallas** (PRs #3-#6 en `develop`): "recorrido conectado en vez de cuadros apilados" en la unidad del estudiante (`components/ui/Recorrido.tsx`, nuevo), ZIP de tareas para el profesor, barrido orgánico de Inicio/Mi módulo, calendario como agenda orgánica, y el crash de los domingos. Esta sesión mergeó ese trabajo (un solo conflicto, en `app/(app)/unidades/[unitId]/page.tsx`, resuelto a favor de la versión con `Recorrido`/`Paso` por ser la solución más completa al mismo problema) y agregó lo que faltaba:

- ✅ **Dirección Académica/super_admin: "Unidades" pasa a ser el primer botón**, no "Material". Material sigue existiendo (explorador tipo Classroom, intacto) pero baja al menú completo, grupo "Dirección académica" — ya no es lo primero que ven. `/unidades-docente` (la misma pantalla del profesor) ya estaba 100% lista para ellos desde antes (`mis_asignaciones_docente()` les devuelve todas las cohortes×módulos activos) — solo faltaba el enlace directo, no había que construir nada nuevo.
- ✅ **"Dudas de esta unidad" ahora conecta con algo real.** Antes era una tarjeta sin ningún enlace, tanto para el profesor como (ya estaba bien) para el estudiante. Ahora el profesor tiene "Ver dudas"/"Ver y responder dudas" que abre `/dudas-docente?unidad=<id>`, y esa pantalla filtra su sección 3 ("Dudas de Aula Virtual") a solo esa unidad, con un aviso y un "Ver todas" para quitar el filtro.
- ✅ **El bloque de texto ya se puede editar**, no solo quitar. Antes, si el profesor se equivocaba al escribirlo, la única opción era borrarlo y crearlo de nuevo.
- ✅ **Tareas, probado de punta a punta por primera vez** (el coordinador dijo explícitamente que nunca se había probado): estudiante sube un PDF real (bucket `tareas`, RLS, `submissions` insert), profesor lo descarga y lo califica (`grade`), el estudiante ve "Calificada" con su nota. Funciona tal cual está construido desde la migración 178 — no hizo falta ningún cambio de código, solo quedó verificado en vivo en `zr-staging`.

**Decisión de nomenclatura tomada en el audio, documentada porque no es obvia:** el coordinador dudó entre llamarlo "Aula"/"Aula Virtual"/"Unidades" en voz alta y terminó decantándose por **"Unidades"** — es el nombre que ya usa el código y la UI del estudiante/profesor desde antes (`/unidades`, `/unidades-docente`, "Unidad 1/2/3..."), así que no hizo falta renombrar nada, solo asegurar que Dirección Académica entre por ese mismo nombre.

**Pendiente, no es bloqueante, queda para una próxima pasada:** llevar el mismo tratamiento "Recorrido" (camino conectado) a las pantallas del profesor (`unidades-docente/[unitId]/page.tsx`, lectura y edición) — hoy siguen con el patrón de tarjetas apiladas; solo se les agregó la edición del bloque de texto y el enlace de dudas, sin rediseñar el contenedor. Coordinar con quien siga trabajando esa otra sesión en paralelo antes de tocarlo, para no duplicar. **(Resuelto en §8.6 para la VISTA DE LECTURA; el modo edición sigue con tarjetas, a propósito.)**

### 8.6 Ronda de Aula Virtual del coordinador (7-nov-2026) — entrada de staff, estética y "Ver"

Pedido del coordinador (audio + video de referencia). Cuatro cambios; se hicieron **tres** y el cuarto (#4) quedó fuera por decisión del coordinador (grande y opcional).

- ✅ **#1 — Dirección Académica y super_admin entran a Unidades COMO ELLOS MISMOS** (`app/(profesor)/layout.tsx`). Antes el layout de profesor los marcaba como "Vista de recorrido · así se ve para Profesor" siempre que entraban, aunque no hubieran elegido esa simulación. Ahora el banner de simulación solo aparece si activaron a propósito la cookie `zr_vista=profesor` desde su panel; al entrar por "Unidades" de su propio menú entran como su propio rol, pudiendo **modificar todo** (RLS por `is_staff()` ya se los permitía — era solo el enmarcado). Se separó `esStaff` (mantiene el tutorial de profesor en modo manual, para que no se les dispare solo) de `enRecorrido` (el banner).
- ✅ **#2 — Estética moderna (Recorrido) en la vista de lectura de la unidad del profesor** (`app/(profesor)/unidades-docente/[unitId]/page.tsx`). La lectura pasó del patrón de tarjetas apiladas al mismo componente `Recorrido`/`Paso` (camino conectado con nodos) que ya usa el estudiante — cierra el pendiente de §8.4 para la lectura. El **modo edición** sigue con tarjetas a propósito (es un formulario, no una lectura).
- ✅ **#3a — Cada ítem de la unidad ahora se puede "Ver"** (antes material y examen no tenían ninguna acción). Material → nuevo visor del docente `app/(profesor)/unidades-docente/[unitId]/material/[itemId]/page.tsx` (reutiliza `VisorMaterial`, sin medir progreso); el rótulo es según el tipo ("Documento"/"Presentación"/"Imagen"/"Video"/"Audio", helpers `eyebrowMaterial`/`accionVerMaterial` en `lib/material.ts`) — una presentación ya no dice "documento". Examen → su constructor (`/crear-examen/[examId]`, "ver cómo quedó"). Tarea → entregas (ya existía). Dudas → panel de dudas de la unidad (ya existía).
- ✅ **#3b — Conexión automática examen/tarea digital → Notas ("núcleo cerrado", H.33): cerrado el 7-nov-2026**, una vez que la sesión paralela de Notas (§8.7) ya había aterrizado su trabajo. Decisión de Pedro explicada por el coordinador: la unidad **no es algo aparte de Notas** — es el mismo módulo, visto como aula virtual. Antes el profesor iba a Notas → "Registrar evaluación" → creaba la fila a mano; ahora, al crear el examen o la tarea **dentro de la unidad** (como ya hacía), ese examen/tarea **ya es** la evaluación — aparece solo como columna en Notas, sin registrarla dos veces. "Todo lo que tenga nota cuenta" (decisión explícita, sin marca aparte del profesor) y el **% que vale en el módulo lo fija el profesor al crear/editar el examen o la tarea**, en la misma pantalla (decisión explícita, para no volver a Notas).
  - **Migración 193** (`supabase/migrations/193_fusion_examenes_tareas_notas.sql`, aplicada a `zr-staging`): `exams.weight` (ya existía sin uso, se reutiliza) y `assignments.weight` (nueva) — el %; `manual_exam_definitions.source_exam_id`/`source_assignment_id` (índices únicos parciales, un solo origen por fila) — de dónde viene cada evaluación; nuevo `kind = 'tarea'`. 4 triggers `security definer` (mismo patrón que `fn_notify_*`): `exams`/`assignments` → `manual_exam_definitions` (sincroniza metadatos al guardar, nunca calcula nada); `exam_attempts`/`submissions` → `manual_exam_scores` (llena la nota sola al calificar — examen digital usa `v_exam_best_score` migr. 176, la mejor de los intentos ya con el tope de reintento aplicado; tarea usa la entrega más reciente, igual criterio que `v_assignment_status` migr. 178 — si esa última entrega no tiene nota, se quita la nota automática anterior en vez de dejar una vieja). Nunca se calcula en el navegador (regla §6.2).
  - **Backfill incluido en la misma migración**: lo que ya existía se registró y se pobló de una vez, no solo lo nuevo — incluyó el único examen de certificación real del piloto (`sixeven 1`, el que el coordinador probó y por el que se pidió este cambio). El backfill encontró un dato de prueba real (una tarea de QA con nota 67 sobre una escala de 20 — las tareas, a diferencia de los exámenes, no validan un tope al calificar) que rompía el `CHECK` de escala de `manual_exam_scores`; se corrigió con un tope `least(nota, escala)` tanto en el backfill como en los 2 triggers de nota, para que un dato real fuera de rango nunca vuelva a romper un guardado.
  - UI: campo nuevo "% que vale en la nota del módulo" en `crear-examen/nuevo`, `crear-examen/[examId]` y la creación de tarea en `unidades-docente/[unitId]`. Nuevo `components/ui/ModalEvaluacionAgregada.tsx`: confirma "Se añadió como evaluación" (o "Sigue siendo una evaluación en Notas" al editar) al guardar — pedido explícito del coordinador. `RegistrarEvaluacion.tsx` solo recibió la etiqueta del nuevo `kind='tarea'` para que se vea bien donde ya se lista; no se puede crear "tarea" a mano desde ahí, solo llega sola desde Aula Virtual.
  - **Solo en staging.** `lib/database.types.ts` regenerado (cambio puramente aditivo, 35 líneas).
  - **Pendiente, no bloqueante**: hoy calificar una tarea no valida ningún tope de escala en su propia pantalla (a diferencia del examen digital, que sí tiene `max_score`) — quedó cubierto con el `least()` del lado de Notas, pero la pantalla de calificar tarea en sí todavía deja escribir cualquier número. Y los `manual_exam_definitions` que vienen de Aula Virtual se pueden editar igual que uno manual desde Notas (título/peso) — ese edit no se avisa al profesor y se sobrescribe en la próxima vez que edite el examen/tarea desde la unidad.
- ✅ **#4 — Banner editable tipo Odoo: construido el 7-nov-2026**, a pedido explícito ("constrúyelo ahora"), después de haberlo dejado fuera de alcance inicialmente. **Ronda 2, la misma tarde**, sobre lo visto en vivo: se quitó "aspecto" (migración 195 -- `drop column banner_aspecto`; decisión del coordinador: "mejor siempre vamos a darle moderno, para que no sea tan disperso" -- un solo aspecto para toda la app, sin elegirlo por unidad; se borraron las dos ramas de tarjetas apiladas que se habían agregado en las dos vistas de lectura). Quedó así:
  - **Migración 194 + 195**: `units.banner_image_path` / `banner_color` / `banner_image_position` (0-100, foco vertical del recorte) + bucket público `banners-unidad` (imagen decorativa, sin datos sensibles -- se sirve directo, sin URL firmada, para que cualquier perfil, incluido el estudiante, la vea igual).
  - **Imagen propia**: subir/cambiar/quitar, con control deslizante de **posición vertical** (pedido explícito: "que pueda agarrarla y subirla o bajarla para donde quiera", porque una imagen cuadrada no entra entera en el rectángulo). Pasa por **el mismo comprimidor que el material** (`lib/subida.ts`, `prepararArchivo` -- `lib/comprimir.ts`), pedido explícito: "el mismo comprimidor que le pusiste al material".
  - **Color (`components/ui/BannerUnidad.tsx`, `PALETA_BANNER`, 5 tonos oscuros: azul por defecto, verde, morado, grafito, vino)**: un mismo selector, **doble uso** (pedido explícito) -- fondo del banner cuando NO hay imagen; **acento de los botones y contornos de la unidad** siempre (con o sin imagen). `lib/banner-unidad.ts` (`acentoDe`, `hexARgba`) centraliza el color hex de cada tono; `components/ui/Recorrido.tsx` (`Paso`) acepta un `acento` opcional que recolorea el nodo activo/disponible (completado=verde y bloqueado=gris se quedan igual, son semánticos); el botón flotante "Editar unidad" también usa el acento.
  - **"Ver" en el examen de certificación ya NO va al constructor** (`/crear-examen/[examId]`) -- va a una pantalla nueva, `app/(profesor)/calificar/[examId]/page.tsx`: lista de estudiantes que presentaron ese examen, con su estado (presentando/por corregir/calificado) y, si tiene redacciones sin revisar, un botón "Corregir". "Editar examen" sigue disponible ahí mismo, aparte. Al tocar "Corregir" entra a `app/(profesor)/calificar/[examId]/[attemptId]/page.tsx` -- adaptado de la cola de calificación que ya existía (`/calificar`, apagada del menú desde Fase 0, con la Edge Function `grade-answer` ya construida), pero filtrado a UN estudiante/intento en vez de mezclar todos los exámenes. Las de opción múltiple y verdadero/falso ya estaban calificadas solas al entregar (`submit-attempt`); solo las de redacción esperan al profesor, con su rúbrica siempre a la vista. Al terminar la última, el servidor (trigger de la migración 176) cierra el intento y calcula la nota; si aprueba, ya queda en Notas sola (fusión H.33, migración 193) -- si no, el estudiante repite según las reglas de intentos/enfriamiento que el examen ya tenía, sin tocar nada de eso.
  - **Bug real encontrado en el camino, mismo patrón que el de `crear-examen/[examId]` de esta misma tarde**: la Edge Function `grade-answer` tenía la lista de roles permitidos sin `direccion_academica` (`['profesor', 'admin', 'super_admin']`) -- la habría bloqueado justo en la pantalla nueva. Corregido y desplegado.
  - **Pendiente, no bloqueante**: no se revisó si `claim-snack`/`validate-scan` (Edge Functions de ZR Coffee/asistencia) tienen el mismo hueco de rol -- se vio el mismo patrón de array ahí al buscar, pero son de otra área (no Aula Virtual) y no se tocaron en esta pasada.
  - **Ronda 3, la misma noche** (color a fondo + responsive):
    - **Color**: antes el acento solo coloreaba el banner, el nodo del recorrido y "Editar unidad". Ahora **todos** los botones y contornos de `unidades-docente/[unitId]/page.tsx` lo usan: "Guardar fechas", "Agregar"/"Asociar"/"Crear tarea"/"Agregar bloque de texto", el slider de posición de imagen, el anillo del color elegido, el ícono de cada ítem, el borde del bloque de texto, los enlaces "Editar"/"Ver entregas"/"Ver y responder dudas"/"+ Subir material nuevo"/"+ Crear examen nuevo", y el contorno punteado de "+ Subir imagen"/"+ Agregar sección de Dudas". `.zr-card` (compartido por toda la app) se dejó sin tocar a propósito -- re-temizarlo habría afectado pantallas fuera de Unidades.
    - **Responsive, bug real encontrado con causa confirmada**: el **modo edición** de `unidades-docente/[unitId]/page.tsx` no tenía NINGÚN padding de página (`px-5 pt-14` faltaba por completo) -- el botón "Listo" quedaba pegado al borde superior derecho, justo donde vive la campanita de notificaciones (`fixed`, `z-40`), y todo el contenido tocaba los bordes de la pantalla sin margen. Corregido.
    - **Segundo bug real, mismo patrón**: `pt-14` (un valor fijo, 3.5rem) no suma `env(safe-area-inset-top)` -- en un iPhone con notch, el contenido empieza ANTES de que termine la zona segura, así que cualquier botón en la primera fila (p. ej. "Editar examen" en `calificar/[examId]/page.tsx`) queda bajo la campanita en celulares con notch grande, aunque se viera bien en uno sin notch. Se cambió `pt-14` por `pt-[calc(3.5rem+env(safe-area-inset-top))]` en las **7 pantallas tocadas hoy** (10 apariciones): `unidades-docente/[unitId]` (los dos modos), su visor de material, `calificar/[examId]` y `[attemptId]` (las dos vistas), `crear-examen/nuevo`, `crear-examen/[examId]` y `unidades/[unitId]` del estudiante.
    - **Tercer bug real**: el botón flotante "Editar unidad" (`fixed bottom-24`) no llevaba `z-index` y su margen inferior era un valor fijo -- en celulares con área segura inferior grande (el "home indicator" del iPhone), la píldora de navegación inferior (`BarraFlotante`, `z-50`) queda más arriba de lo calculado y tapa el botón. Se le puso `z-[60]` (por encima de la píldora) y `bottom-[calc(7rem+env(safe-area-inset-bottom))]` (consciente del área segura, igual que la propia píldora).
    - **No se auditó el resto de la app** buscando el mismo patrón de `pt-14`/safe-area -- quedó acotado a las pantallas de hoy, que es lo que el coordinador estaba probando. Si aparece en otra pantalla, es el mismo arreglo.

### 8.6ter Bug real (7-nov-2026) — se pierde la selección de programa/módulo a mitad de trabajo

Reportado con video por el coordinador, la misma noche: entrando a Unidades, eligiendo programa y módulo, viendo las unidades con normalidad -- y de pronto, **sin tocar nada**, la pantalla vuelve sola a "¿qué módulo quieres revisar?", como si nunca hubiera elegido nada.

**Analizado fotograma a fotograma** (mismo método que §8.6bis): se confirma que SÍ hay datos reales cargando bien (el módulo, las unidades) antes del reinicio -- no es que nunca cargara. El reinicio pasa sin ningún clic visible del coordinador (el cursor queda inmóvil).

**Causa exacta no confirmada** (a diferencia de §8.6bis, donde sí se pudo probar en vivo contra la base). El candidato más fuerte, por descarte: `lib/use-recargar-al-volver.ts` -- recarga la página entera si estuvo oculta 60 segundos o más (pensado para cuando el teléfono/laptop se suspende y la conexión queda "muerta" sin avisar). En una PWA de escritorio empaquetada, es plausible que pierda el foco brevemente (otra ventana, el propio grabador de pantalla) y el navegador lo cuente como "oculta" de más. No se tocó esa función -- resuelve un bug real documentado y quitarla a ciegas podría traer de vuelta ESE problema.

**Lo que sí se corrigió, pase lo que pase**: `components/ui/ContextoDocente.tsx` (el selector de programa/módulo que usan Unidades, crear-examen, contenido-docente, etc.) ahora guarda la elección en `sessionStorage` (`zr_ctx_cohort`/`zr_ctx_module`) apenas se elige, y la restaura si el componente se remonta -- así, sea cual sea la causa real del reinicio, ya no obliga a elegir todo de nuevo desde cero. Se limpia solo al tocar "Cambiar" a propósito.

**Descartado por el coordinador** (misma noche): decidió no seguir confirmando la causa exacta del reinicio -- el arreglo de `sessionStorage` se queda, pero no se investiga más esto.

### 8.6quater Bug real (7-nov-2026) — "No se pudo guardar" al calificar una redacción como super_admin

Reportado con captura de pantalla, la misma noche: al calificar una respuesta de redacción (pantalla nueva de §8.6 #4) y tocar "Guardar y ver resultado", salía "No se pudo guardar. Revisa tu conexión e inténtalo otra vez." -- no era la conexión.

**Causa exacta, confirmada por logs** (`query_logs`, `function_logs`, no hubo que adivinar):

```
Error grading answer: {
  code: "23503",
  details: 'Key (graded_by)=(d0b1916f-...) is not present in table "teachers".',
  message: 'insert or update on table "exam_answers" violates foreign key constraint "exam_answers_graded_by_fkey"'
}
```

`exam_answers.graded_by` tenía una foreign key hacia `teachers(id)` -- una tabla de solo **3 filas** (los profesores de verdad). super_admin/Dirección Académica nunca van a estar ahí, aunque hoy pueden calificar exámenes igual que un profesor (todo lo de §8.6 #4). Se revisó qué OTRAS columnas tenían el mismo patrón (`pg_constraint` contra `confrelid = teachers`) y aparecieron **7 en total**, todas con el mismo riesgo latente (no probadas todavía, pero iban a fallar igual en cuanto alguien de Dirección/super_admin las tocara):

| Tabla | Columna | Qué significa |
|---|---|---|
| `exam_answers` | `graded_by` | quién calificó la respuesta (el bug real, ya reportado) |
| `submissions` | `graded_by` | quién calificó una tarea |
| `exams` | `teacher_id` | quién creó el examen (`/crear-examen/nuevo` ya guarda `user.id` sea quien sea) |
| `exams` | `published_by` | quién lo publicó |
| `exam_rehabilitation_requests` | `responded_by` | quién aprobó un intento extra |
| `intervention_grants` | `granted_by` | quién otorgó la intervención |
| `mastery_map` | `marked_by` | quién marcó el dominio |

**Fix** (migración 196): las 7 se relajan a `profiles(id)` -- cambio seguro porque `teachers.id` YA referencia `profiles(id)` (mismo patrón que `students`), así que ningún valor existente deja de ser válido. **A propósito NO se tocaron** `cohorts.teacher_id`, `class_sessions.teacher_id` ni `teacher_module_assignments.teacher_id` -- esas sí significan "quién es EL profesor asignado de verdad" y deben seguir siendo solo de `teachers`.

**Patrón que se repite hoy**: es la tercera vez en la misma sesión (ver también grade-answer sin `direccion_academica` en §8.6 #4, y el filtro `teacher_id` del cliente en §8.6 #1) que una regla vieja, pensada para cuando solo el profesor hacía estas cosas, bloquea a Dirección/super_admin ahora que el modelo cambió a "entran como ellos mismos, pueden hacer todo". Vale la pena, en algún momento, una auditoría dedicada a buscar este patrón en el resto del sistema en vez de ir encontrándolo pantalla por pantalla.

### 8.6bis Bug real (7-nov-2026) — super_admin devuelto al panel desde dentro de Unidades

Reportado por el coordinador sobre staging, el mismo día de #1-#3b: entrando como super_admin, dentro de una unidad (`inglés 1`, módulo 2), tocar **"Certificación"** (ver el examen), **"Crear examen nuevo"** y **agregar material ya subido** lo devolvían al panel "en varias ocasiones". El coordinador sospechó que tenía que ver con #1 (entrar como sí mismo, no como vista de profesor) — tenía razón.

**Primer intento de diagnóstico (descartado con evidencia en video):** se sospechó una falla transitoria en el chequeo de rol de `app/(profesor)/layout.tsx`/`app/(admin)/layout.tsx` (ver commit `7da194f`) y se endureció ese código (reintentos, `.maybeSingle()`). El coordinador grabó un video reproduciendo el bug **después** de que ese fix ya estaba en vivo en staging (confirmado cruzando la hora del archivo del video contra los deployments de Vercel) — así que ese no era el problema real, aunque el endurecimiento se queda (es una mejora legítima aparte).

**Causa real, encontrada analizando el video fotograma a fotograma (`ffmpeg`/`opencv` no estaban instalados; se usó `pip install opencv-python-headless` para extraerlos):** el bug está en **`proxy.ts`** (el middleware de servidor que decide a qué rol le toca qué ruta, en cada navegación — corre ANTES de que React renderice nada). `RUTAS_PROFESOR` incluye `/crear-examen` y `/contenido-docente`; para que Dirección Académica/super_admin entren ahí, el proxy exigía la cookie `zr_vista=profesor` (la de "vista de recorrido", pensada para cuando SÍ eligen simular al profesor desde su panel). El fix de #1 (entrar a Unidades como ellos mismos, SIN esa cookie) nunca se reflejó aquí — así que el caso normal (sin la cookie) hacía que el proxy los regresara a `/panel` (`INICIO_POR_ROL`) antes de que la pantalla llegara a cargar. `/unidades-docente` no estaba en `RUTAS_PROFESOR` (omisión), por eso esa pantalla sí funcionaba — pero cualquier "Ver" dentro de una unidad (examen, crear examen nuevo, material) caía en la trampa. El flash de "Verificando acceso…" que se veía en el video no era el layout de profesor fallando — era el layout de `(admin)` montando de cero en `/panel`, adonde el proxy ya había redirigido la navegación real.

**Fix aplicado** (`proxy.ts`): Dirección Académica/super_admin entran a las rutas de profesor sin necesitar la cookie de simulación — la cookie sigue existiendo solo para decidir si se muestra el banner de "vista de recorrido" (un asunto de UI), nunca para el permiso de entrar. Se agregó también `/unidades-docente` a `RUTAS_PROFESOR` (antes se colaba sin pasar por este chequeo en absoluto — funcionaba por la RLS y el layout, pero las dos capas deben decir lo mismo).

**Metodología**: diagnóstico equivocado la primera vez, corregido con evidencia real (video del coordinador) en vez de insistir en la teoría original. Verificado con fecha/hora exacta de deploy contra Vercel antes de descartarla.

### 8.5 Validación rápida del mapa de épicos (6-nov-2026, parcial)

Pedido del coordinador: verificar lo que hay contra "todo el mapa del documento maestro". Dado el tamaño (24 épicos, ~180 funciones), esta pasada fue parcial — se confirmó contra el código real lo que tocaban las auditorías §8.1-8.4 (épicos F, H) y se revisó de pasada N y X, que no tenían bullets propios aunque esta sesión los movió:

- **Épico N (Dirección Académica):** las pantallas que el mapa da por 🟡 ya existen y funcionan de verdad — `/personal`, `/cobertura-modulos`, `/notas-academicas`, `/examenes-academicos`, `/modulos`, `/feedback-modulos`, y ahora `/cohortes` (§8.3). **N.11 Comunicados/anuncios no existe todavía** (no hay pantalla ni tabla) — sigue 🔴 real, coincide con el Sprint 8 donde está planificado.
- **Épico X (Dudas mejoradas):** FAQ, dudas por unidad, respuesta oficial y resumen IA (`resumir-dudas`) ya existen desde migr. 180/182. Esta sesión sumó el filtro por unidad en el panel del profesor (§8.4). Sigue 🟡 porque faltan X.6-X.9 (imagen adjunta en duda, tiempo de respuesta con alertas) — Sprint 9, no construido.
- Épicos ✅ (C, D, K, M, P, Q) no se tocaron esta sesión — se asume que siguen vigentes tal cual estaban, sin verificación línea por línea en esta pasada.

**No se completó una auditoría de los 24 épicos completos** — quedaría para una sesión dedicada solo a eso, siguiendo el mismo patrón de §8.1 (leer el doc de referencia, confrontar contra `zr-prod`/`zr-staging` y el código, actualizar estado con fecha).

### 8.7 Ajustes de Notas pedidos por Dirección Académica (7-nov-2026)

> Nota de numeración: esta sección y la §8.6 de arriba ("Ronda de Aula Virtual")
> se escribieron el mismo día en dos sesiones en paralelo y ambas empezaron como
> "§8.6". Esta se renumeró a §8.7 al descubrir el choque; el bullet #3b de la §8.6
> es justamente el que anticipó estos cambios de Notas.

Tres cambios en la sección de Notas de Dirección Académica (aplican solo a `direccion_academica` y `super_admin`, que es quién entra a esas pantallas). Épicos J/N. Desplegados directo a staging y producción por pedido explícito del coordinador ("necesito ahorita, directo en los dos").

- ✅ **Reordenar columnas en "Ver calificaciones por estudiante"** (`/notas-academicas/[cohortId]`): las columnas de cada evaluación salían en el orden en que se montaron (por `exam_date`), lo que se veía desordenado (p. ej. "Examen 3" antes que la pre-práctica del 1). Ahora Dirección arrastra el encabezado de una columna para cambiar su orden (manito al pasar el mouse, drag-and-drop nativo HTML5) y la columna se mueve **completa, con sus notas ya cargadas** (el encabezado y las celdas se dibujan del mismo arreglo, por id). El orden se guarda en `manual_exam_definitions.sort_order` (**migración 191**, columna nullable — no influye en ningún cálculo; teoría/práctica promedian, el orden es irrelevante). Solo se arrastra cuando el filtro de Tipo está en "Todo". RLS: no se tocó, la política `direccion: administra examenes manuales` (migr. 147, `is_admin_up()`) ya cubría el UPDATE.
- ✅ **"Registrar evaluación": historial por sesión + botón de historial completo** (`components/notas/RegistrarEvaluacion.tsx`, solo `modo='direccion'`): la lista "Evaluaciones registradas" de abajo mostraba TODAS las evaluaciones (filtradas por programa), y la directora se confundía al ver una de un módulo pasado y creía que se había equivocado de módulo. Ahora, para Dirección, esa lista **arranca vacía** y muestra solo lo registrado/editado en la sesión actual (en memoria: al salir y volver, vacía otra vez). El historial completo —todas las evaluaciones, filtrable por programa y luego por módulo— vive detrás del botón **"Historial de evaluaciones"** (icono de reloj) que abre un modal. El `modo='profesor'` mantiene la lista completa con filtros como antes (el cambio no lo toca). La suma de porcentajes del módulo sigue leyendo todas las evaluaciones, no solo las de la sesión.
- ✅ **Nota manual "12" → "12.00" al dar Enter** (mismo cuadro de calificaciones): al escribir `12` y pulsar Enter la celda no normalizaba a dos decimales (Enter no dispara `blur` en un input suelto). Se agregó `onKeyDown` que fuerza el blur con Enter y una normalización del texto a `fmt(v)` en el `onBlur` (cubre también el caso en que el valor no cambió y `guardarNota` no re-renderiza la celda).

**Segunda ronda (7-nov-2026, sobre lo visto en vivo):**

- ✅ **Manito del encabezado fija arriba** (`/notas-academicas/[cohortId]`): con `align-bottom`, el puntico de arrastrar se veía más arriba o más abajo según cuántas líneas ocupara el título de la columna, y a veces pisaba el texto. Ahora va en posición absoluta pegada al borde superior (`absolute inset-x-0 top-1`, `pointer-events-none`), con `pt-5` en el `th` para reservar su espacio; la línea de "/100 · 10 %" sigue alineada abajo entre columnas. Se quitó el `relative` que había puesto (chocaba con `sticky`: el propio `sticky` ya sirve de ancla al hijo absoluto).
- ✅ **Barra lateral de escritorio colapsable** (`components/ui/BarraLateral.tsx`, solo `lg:`): en módulos con muchas evaluaciones el cuadro de notas es muy ancho y la directora tenía que barrer de lado hasta la nota final y devolverse. La flechita de arriba de la barra la recoge a solo iconos (72 px) y, como el shell es flex (`.zr-app-shell` → barra `shrink-0` + `main` `flex:1`), el contenido se estira solo hasta el borde. Estado guardado en `localStorage` (`zr-barra-colapsada`), leído en `useEffect` para no romper la hidratación. El teléfono (`BarraFlotante`) no se toca. Los grupos del menú, recogidos, se marcan con una rayita en vez del texto; cada icono lleva `title` con su nombre.
- ✅ **Tercer retoque (7-nov-2026, sobre lo visto en vivo):** la pista "Arrastra el encabezado…" tenía `-mb-3` y quedaba pisada por el cuadro (se veía como texto fantasma detrás de las columnas) — se pasó a `mb-3`, limpia arriba. Y las barras de scroll nativas salían blancas en Windows (feo sobre el tema oscuro): se tiñeron con los tokens de la app — nueva utilidad `.zr-scroll` (ambos ejes) aplicada al cuadro de notas, y un estilo global de `html::-webkit-scrollbar` para la barra de la página.

### 8.8 Dos incidentes en vivo el 7-nov-2026 (sábado de arranque de PTMA-2026-III)

**Incidente 1 — PTMA-2026-III sin clase de hoy.** Al llegar los primeros estudiantes del programa nuevo, `/qr` no mostraba la cohorte y el escaneo decía "no tienes clase programada hoy". No era error del vendedor: Dirección Académica ya había asignado módulo y profesor en `teacher_module_assignments` (Isaac Sánchez, "Introducción a la Mecánica", desde el 5-nov), pero a la cohorte nunca se le "inició" ese módulo — `cohorts.current_module_id`/`teacher_id` seguían en null, y `asegurarSesionDeHoy()` (`app/(admin)/asistencias/page.tsx`) no crea la sesión del día si `current_module_id` es null, sin avisar por qué. Arreglado en caliente, directo en `zr-prod` (sin migración, es dato — se hizo el mismo `update` que hace `/cohortes`): se puso `current_module_id`/`teacher_id` según la asignación ya existente y se creó a mano la `class_session` de hoy. **Pendiente real:** `/cohortes` debería avisar si se marca "activa" una cohorte sin módulo/profesor inicial.

**Incidente 2 — abrir el feedback de módulo (K.2) nunca mandaba push.** Hoy es el último sábado de "Instrumentación automotriz" para PTMA-2026-II (confirmado con los datos: 7 sesiones = `modules.duration_weeks`, semana 11 = la 7ª). Al abrir el formulario (`/feedback-modulos`, `alternarVentana`) se confirmó que el upsert en `feedback_macro_windows` nunca tuvo un trigger de push — a diferencia de `fn_notify_hora_clase`/`fn_notify_modulo_cambiado` (migr. 106), que sí avisan. Se construyó y probó primero en `zr-staging` y después en `zr-prod` la **migración 192** (`fn_notify_feedback_macro_abierto`, mismo patrón: `channel='push'` explícito, dispara solo al abrir/reabrir, nunca al cerrar ni en un re-guardado sin cambios — probado con los 3 casos en staging antes de tocar producción). Se usó para re-disparar el push real de hoy (el feedback de Instrumentación automotriz ya estaba abierto desde antes del fix). Chequeo post-fix: `get_advisors` solo marca la misma advertencia ya aceptada que tienen los otros dos triggers de notificación (`anon`/`authenticated` pueden "ejecutar" la función como RPC — no es explotable, es el mismo patrón ya en producción), nada nuevo. **Recordatorio para el próximo módulo que cierre:** el sistema no avanza de módulo solo por fecha — alguien de Dirección Académica tiene que entrar a `/cohortes` y darle "Avanzar módulo" a PTMA-2026-II hacia "Fluidos automotrices" antes del sábado 14-nov, o la próxima clase quedará registrada bajo el módulo viejo.

### 8.9 Checklist de campos al descargar planillas (7-nov-2026)

Pedido de Dirección Académica: al descargar planillas no se quería que salieran siempre todos los datos. Épicos M/B. Aplica a quien ya podía descargar (admin, dirección académica, super_admin) — no se restringió, es una mejora del propio flujo de descarga.

- ✅ **Checklist de campos antes de bajar la planilla.** Tanto el botón "Descargar todas las planillas" de un programa (`/estudiantes`, descarga masiva en .zip) como el "Imprimir / Guardar como PDF" de un estudiante (`/estudiantes/[id]/planilla`) ahora dejan elegir qué campos salen impresos. Por defecto **todos marcados**; se quita lo que no se quiera. En la descarga masiva es un modal cuya selección se aplica a todo el lote; en la individual es un desplegable que actualiza en vivo la planilla en pantalla (que es lo que se imprime).
- La selección cubre los datos de la **página 1** (participante: código, nombre, C.I., módulo, días y horario, fecha de inscripción, celular, dirección; representante: nombre, C.I., parentesco, edad, nacionalidad, profesión, celular, correo). Si se quitan todos los campos de una sección, su título tampoco se imprime. La **página 2** (política administrativa + firmas) siempre se mantiene — es lo que hace la planilla un documento firmable, no un dato del estudiante.
- Catálogo único de campos en `lib/planilla-campos.ts` (claves + etiquetas + defaults), usado por el componente React (`components/planilla/PlanillaDocumento.tsx`, vista individual que se imprime del navegador), el generador jsPDF (`lib/planilla-pdf-bulk.ts`, descarga masiva) y el selector de UI (`components/planilla/SelectorCampos.tsx`, nuevo, reutilizado por las dos pantallas). Sin migración ni cambios de base — puro frontend.
- **Tercera pasada (mismo día): formato Planilla (PDF) vs Tabla (Excel).** El modal ahora tiene selector de formato. **Planilla (PDF):** si se quita aunque sea un campo, el PDF deja de ser planilla formal — el título pasa a "Datos del estudiante", no sale la nota explicativa ni la página 2 (políticas y firmas); si están todos los campos, se mantiene la planilla completa. **Tabla (Excel):** un solo `.xlsx` con una fila por estudiante y una columna por cada campo marcado, encabezados claros (p. ej. "Representante: correo"). Se arma a mano con jszip (`lib/estudiantes-tabla.ts`), sin dependencia nueva. Si no queda ningún campo marcado, el botón se deshabilita.
- **Segunda pasada (mismo día, sobre lo visto en vivo):** (1) **correo del estudiante** agregado — antes el correo solo salía en los datos del representante; ahora `Correo` es un campo propio del participante (dato `contact_email` de `v_students`, lo que Dirección necesita: nombre + correo del estudiante). (2) **Responsive del modal de descarga masiva:** el botón "Descargar" quedaba tapado por el menú flotante en teléfono; se subió el modal por encima (`z-[60]`, sobre la barra flotante que es `z-50`) y se le dio espacio inferior para el área segura (`env(safe-area-inset-bottom)`).

### 8.10 Eliminar/renombrar unidades (7-nov-2026)

Pedido explícito del coordinador: "agrega la opción en Unidades para poder eliminar o editar las unidades, si quiero eliminar Inglés 1 etcétera". Antes no existía ninguna forma de borrar o renombrar una unidad completa una vez creada — solo se podía borrar/editar lo que había *dentro* de ella (material, examen, tarea, bloque de texto).

- ✅ **Renombrar**: en `/unidades-docente` (lista de unidades del módulo), cada tarjeta tiene "Corregir nombre" — input + guardar, `lib/eliminar-unidad.ts` (`renombrarUnidad`), un simple `update` de `units.title`.
- ✅ **Eliminar**, con confirmación mostrando qué hay dentro antes de borrar (regla de la app: nunca borrar sin decir qué se pierde). "Eliminar" abre un resumen (`resumenAntesDeEliminar`): cuántos materiales/exámenes están enlazados (esos NO se borran, solo se desenlazan — pueden estar en otra unidad), cuántas tareas con cuántas entregas de estudiantes (esas SÍ se pierden para siempre, resaltado en rojo), cuántos bloques de texto (se borran) y cuántas dudas (se quedan, sin esta unidad — `doubts.unit_id` es `ON DELETE SET NULL`).
- **Falta real de RLS encontrada en el camino** (y corregida antes de construir nada): el bucket de Storage `tareas` (entregas de los estudiantes) no tenía **ninguna política de DELETE** — ni para el estudiante ni para el personal. Sin eso, aunque el borrado de unidad hubiera funcionado en la base, los archivos de las entregas se habrían quedado huérfanos en Storage para siempre (RLS bloquea el borrado por default, sin excepción). **Migración 197**: agrega `"personal: borra entregas"` (`is_staff()`).
- **Por qué es un RPC (`fn_eliminar_unidad`) y no varios deletes sueltos desde el cliente**: para que la limpieza de Storage (el cliente la hace antes, leyendo las rutas mientras las filas todavía existen) y el borrado de filas en la base queden en una sola operación en el servidor — `security definer`, revisa `is_staff()` él mismo, y si algo falla a mitad de camino, se revierte todo. `units` arrastra en cascada (ya existía así, verificado antes de construir esto): `unit_items` → `assignments` → `submissions`. Lo que la cascada NO cubre y el RPC sí borra a mano: los bloques de texto (`content_items` tipo `'texto'`), que se enlazan solo vía `unit_items`, no por una columna propia de `units` — si no se borran explícitamente, quedan huérfanos en la base (nadie los ve, pero ocupan espacio para siempre).
- Si alguna tarea de la unidad ya tenía nota cargada en Notas (fusión H.33, migración 193), esa evaluación **se queda en Notas con su nota** — solo pierde el enlace automático (`source_assignment_id` → null, por `ON DELETE SET NULL`). Borrar una unidad nunca borra una nota real de un estudiante.
- **Mismo patrón de advisory ya documentado en §8.8** (función nueva ejecutable por `anon`/`authenticated` vía RPC): se revocó `anon` explícitamente (`authenticated` se deja porque el propio RPC rechaza a quien no sea `is_staff()`) — no es explotable, solo ruido del advisor con `SECURITY DEFINER` expuesto por PostgREST.
- Solo en staging.

### 8.11 Bug real en vivo (7-nov-2026) — Notas y Material se mezclaban entre cohortes del mismo programa

Reportado por Dirección Académica (vía Pedro, coordinador): al entrar a Notas de PTMA-2026-III aparecían las mismas columnas (evaluaciones) que en PTMA-2026-II. Pedro reportó por separado que en Material también se veían las carpetas de PTMA-2026-II dentro del módulo de PTMA-2026-III. **Ambos bugs comparten la misma causa de fondo**: el currículo (módulos) se comparte entre cohortes del mismo programa (§8.3, correcto por diseño) — cuando dos cohortes pasan por el mismo módulo en momentos distintos, cualquier dato que solo esté ligado a `module_id` (sin `cohort_id`) se comparte también entre ellas, sin querer.

**Verificado contra producción antes de tocar nada** (regla de esta sesión, no solo "arreglar rápido"): ningún módulo tenía notas puestas de más de una cohorte a la vez; toda evaluación existente tenía al menos una nota puesta. El backfill fue 100% determinístico — no hubo que resolver ninguna mezcla real de datos a mano.

- ✅ **Notas (épico J/N) — `manual_exam_definitions` no tenía `cohort_id`.** Causa exacta: `validar_notas()` marcaba como validadas TODAS las evaluaciones del módulo (de cualquier cohorte), y `fn_reabrir_envios_nueva_evaluacion()` reabría el envío de cualquier cohorte que compartiera el módulo. **Migración 198**: agrega `cohort_id` NULLABLE a `manual_exam_definitions` (mismo patrón que `content_items`/`content_folders`, migr. 150-159: NULL = compartida — hoy la usa la fusión examen/tarea digital → Notas, migr. 193, un solo examen para todas las cohortes del módulo —, con valor = evaluación manual de esa cohorte únicamente). Backfill de las evaluaciones existentes a partir de las notas ya puestas. Limpieza de `grade_validated_evals` con filas cruzadas que el bug ya había creado. RLS de estudiante y profesor actualizadas para filtrar también por `cohort_id`. Pantallas de Notas (admin y profesor) y `RegistrarEvaluacion.tsx` filtran/graban `cohort_id`; de paso se corrigió que `empezarEdicion` adivinaba la cohorte por `programId` (podía escoger la equivocada con 2 cohortes activas del mismo programa) — ahora usa la cohorte real de la evaluación.
- ✅ **Material (épico F/M) — los datos ya estaban bien, el bug era de una pantalla.** `content_items`/`content_folders` ya tenían `cohort_id` correcto desde migr. 150-159, y `/material` (Dirección) y `/contenido-docente` (profesor) ya filtraban por cohorte. El hueco real: `/contenido` (la vista del estudiante) confiaba solo en RLS, y la política de admin/dirección/super_admin ve TODO el módulo sin restricción de cohorte (por diseño, para su trabajo normal) — así que al usar "vista de recorrido" para revisar un módulo que ya cursó otra cohorte, sí aparecía el material de esa otra cohorte. Se agregó el mismo filtro explícito (`cohort_id.is.null,cohort_id.eq.…`) que ya usan las otras dos pantallas, tanto para el estudiante real como para la vista de recorrido.
- Aplicado y verificado primero en `zr-staging`, después en `zr-prod` (migración 198 en los dos, advisors de seguridad sin cambios en ninguno).

---

# PARTE IV — FLUJOGRAMAS POR ROL

## 9. FLUJOGRAMAS

### 9.1 Estudiante

```
INSCRIPCIÓN
  Vendedor captura → Admin valida firma+pago → clave temporal
  Descarga PWA → entra con cédula + clave → cambia clave
  Completa perfil, INCES, foto → T&C → carnet con QR

PRIMER SÁBADO
  Admin muestra QR → Estudiante escanea asistencia (C.3)
  Después, QR de refrigerio (si marcó asistencia, C.9)
  ZR Coffee entrega refrigerio (C.11)
  Diagnóstico de entrada (D)

CICLO SEMANAL (L-V)
  Lunes: lee guía (F.9)
  Martes: caso sintético 4 pasos (G.2)
  Miércoles: caso real (G.5)
  Jueves: envía duda (E.5)
  Viernes: diagnóstica 3 preguntas (E.7, H.35)

SÁBADO
  Asiste → Examen digital si aplica (H) → Evaluación práctica (I)
  Ve resultados (J.3, J.4, J.5)
  Si falló: "qué falló y por qué" (J.6)
  Feedback micro (K.1)

CIERRE MÓDULO
  Nota final → Mapa competencias → Feedback macro (K.2)

FINANZAS (paralelo)
  Ve estado de cuenta (O.3)
  Sube captura si vence cuota (O.5)
  Si no paga 30 días → bloqueo (O.2)
```

### 9.2 Profesor

```
ANTES DEL SÁBADO (viernes)
  Abre "Antes de la clase" (L.2) → ve dónde falla el grupo
  Ve dudas agrupadas (L.3, X) → prepara clínica
  Ve calendario de su sesión (V.9)

EL SÁBADO
  Contador asistencia en vivo (L.1, C.4)
  Abre diagnóstico → aparece a todos (D.2)
  Enseña
  Evaluación práctica en pantalla única (I.5)
    Checklist a toques con críticos (I.1, I.4)
    Defensa técnica 1-4 (I.2)
    Sistema calcula (I.3)

CIERRE
  Carga notas (J.1) → marca participación (J.2)
  Revisa feedback agregado (L.6, K.3)

ENTRE SEMANA
  Sube material a Aula Virtual (F)
  Crea casos manuales (G.7) o aprueba IA (G.8)
  Crea exámenes digitales (H.34, importa Excel H.14)
  Responde dudas (X)
  Ve mapa dominio de su cohorte (J.7)
```

### 9.3 Vendedor

```
CAPTURA DEL LEAD
  Abre app → crea perfil pre-inscrito (B.5)
  Datos iniciales: nombre, correo, cédula
  Si menor: datos del padre
  Sistema genera documento (B.6)
  Admin lo imprime para firma
```

### 9.4 Admin (operativo diario)

```
INICIO DEL DÍA
  Panel: hoy en la academia (M.1)
  Pre-inscritos pendientes de validar (M.5)

GESTIÓN
  Valida nuevos: firma + pago → activa + entrega clave
  Alumnos: ficha, búsqueda, CSV (M.2)

SÁBADO
  Muestra QR en pantalla (M.4)
  Monitorea asistencia (M.3)
  Fallback: registro manual (C.6)

FINANZAS
  Valida capturas subidas (M.6, O.6)
```

### 9.5 Dirección académica

```
LUNES
  Recibe correo con los 8 indicadores (N.3)
  Si algo en rojo: abre salud del sistema (N.2)

DURANTE LA SEMANA
  Gestiona cohortes (N.7), módulos (N.8), salones+horarios (N.9)
  Gestiona profesores (N.10)
  Publica comunicados (N.11)
  Aprueba borradores de contenido (N.12)
  Revisa currículo (N.6)

CIERRE DE MÓDULO
  Progreso y notas por módulo (N.4)
  Compara con módulos anteriores (N.5)

TRIMESTRE
  Línea base vs resultados (U.1)
  Encuesta motivación 0/6/12 (U.3)
  Ajustes al modelo
```

### 9.6 ZR Coffee

```
APERTURA
  Actualiza inventario (P.1)

EL SÁBADO
  Recibe tickets de refrigerio (C.11, P.4)
  Entrega refrigerio al validar ticket

VENTAS NORMALES
  Registra ventas con tasa de cambio (P.2)

REPORTE
  Al cierre: reporte de ventas (P.5)
```

### 9.7 Automatizaciones del sistema

```
EVENTO (no cron)
  Al escanear QR exitosamente → generar nuevo QR (C.2)

CADA HORA
  Recalcular solvencia
  Enviar recordatorios de pago (O.8)

CADA DÍA
  Verificar cuotas vencidas, bloquear si >30 días (O.2)
  Push recordatorio 24h antes de evento (V.8)
  Generar caso automático si llegó el martes (G.6)

CADA SEMANA (lunes)
  Calcular los 8 indicadores (U.5-U.12)
  Enviar correo a coordinación (N.3)

CADA EXAMEN
  Autocalificar en servidor (H.23)
  Nunca enviar correct_answer (H.24)
  Nota digital → sistema de Notas (H.33)

CADA EVALUACIÓN PRÁCTICA
  Calcular nota checklist 70% + defensa 30% (I.3)
  Alerta ítem crítico (I.4)
```

---

# PARTE V — PLAN DE EJECUCIÓN

## 10. SPRINTS CON FECHAS REALES Y MICRO-ACTIVIDADES

**10 sprints de 2 semanas** = 20 semanas = ~5 meses.
**Arranque:** lunes 3 de noviembre de 2026 (próximo lunes).
**Cierre proyectado:** sábado 21 de marzo de 2027.

**Principio de cada sprint:**
- Entregables concretos.
- Micro-actividades de 1-4 horas cada una.
- Criterios de validación binarios (✅ o 🔴).
- Dependencias explícitas.

---

### SPRINT 0 — Preparación y línea base
**Fechas:** Lun 3 nov – Dom 16 nov 2026 (2 semanas, antes del módulo de noviembre)
**Objetivo:** capturar línea base antes de que arranque el nuevo módulo. Sin esto no se puede medir después.

**Entregables:**
- U.1 Línea base: prueba práctica común a los 20 estudiantes
- U.3 Encuesta motivación semana 0 aplicada
- U.4 Export histórico 3 cohortes de Odoo
- R.1 Auditoría UX por rol (documento revisable por Pedro)
- A.4 Entorno staging separado de producción
- A.5 CI formal (`.github/workflows/`)

**Micro-actividades:**

Semana 1 (3-9 nov):
- [ ] L 3/11, 2h — Pedro + profesor: diseñar prueba práctica común (qué ejercicio, qué rúbrica)
- [ ] M 4/11, 1h — Admin: imprimir 20 hojas + materiales del ejercicio
- [ ] M 4/11, 2h — Marco: mover `.github/ci-pendiente.yml` → `.github/workflows/` + validar que corre en PRs
- [ ] X 5/11, 4h — Marco: crear proyecto `zr-staging` en Supabase + conectar a Vercel preview
- [ ] J 6/11, 2h — Admin: exportar de Odoo las 3 cohortes anteriores a .xlsx
- [ ] V 7/11, 3h — Vita + Claude: auditoría UX documento base (por rol: qué sobra, qué falta)
- [ ] S 8/11, 1 sesión — Profesor: aplicar prueba práctica a los 20

Semana 2 (10-16 nov):
- [ ] L 10/11, 2h — Admin: capturar resultados prueba práctica en hoja de cálculo
- [ ] L 10/11, 2h — Marco: configurar encuesta motivación 6 ítems como formulario en la app
- [ ] M 11/11, 1h — Admin: enviar encuesta a los 20 estudiantes vía push
- [ ] X-J 12-13/11 — Pedro: revisar documento de auditoría UX
- [ ] V 14/11, 2h — Dirección: cerrar línea base + export Odoo en documento consolidado
- [ ] S 15/11 — Hito: tasa de respuesta encuesta ≥80% confirmada

**Criterios de validación (cierre):**
- ✅ Línea base documentada con los 20 resultados firmados por profesor
- ✅ Encuesta ≥80% respondida
- ✅ Export Odoo entregado a Dirección
- ✅ Auditoría UX revisada por Pedro
- ✅ Un deploy a staging confirmado
- ✅ CI corre en al menos un PR

**Dependencias:** ninguna. Es el sprint de arranque.

---

### SPRINT 1 — Flujo de inscripción + Gestión académica base
**Fechas:** Lun 17 nov – Dom 30 nov 2026
**Objetivo:** el vendedor puede capturar leads y dirección puede gestionar cohortes/salones. Base para todo lo demás.

**Entregables:**
- B.5-B.8 Flujo vendedor → admin → clave
- N.7 Gestión de cohortes
- N.9 Gestión de salones y horarios
- N.10 Gestión de profesores (postulación + asignación)

**Micro-actividades:**

Semana 1 (17-23 nov):
- [ ] L 17/11, 3h — Marco: migración con tablas `rooms`, `schedules`, extender `cohorts`
- [ ] M 18/11, 3h — Marco: Edge Function `vendor-create-lead` + política RLS vendedor
- [ ] X 19/11, 4h — Marco: pantalla vendedor para crear lead (campos nombre/correo/cédula/padre)
- [ ] J 20/11, 3h — Marco: generador de PDF de inscripción (plantilla HTML + imprimible)
- [ ] V 21/11, 3h — Marco: pantalla admin "pre-inscritos pendientes de validar"
- [ ] V 21/11, 2h — Marco: botón "activar" admin → trigger clave temporal + email

Semana 2 (24-30 nov):
- [ ] L 24/11, 4h — Marco: pantallas dirección: CRUD de cohortes
- [ ] M 25/11, 4h — Marco: pantallas dirección: CRUD de salones y horarios
- [ ] X 26/11, 4h — Marco: pantallas dirección: gestión profesores (asignar a cohorte)
- [ ] J 27/11, 2h — Dirección: cargar salones y horarios reales del próximo mes
- [ ] V 28/11, 2h — Vendedor: probar flujo completo con 1 estudiante de prueba
- [ ] S 29/11 — Validación con Pedro

**Criterios de validación:**
- ✅ Un estudiante nuevo pasó por el flujo completo: vendedor → impresión → firma → admin activa → entra a la app
- ✅ Dirección cargó salones y horarios del próximo mes
- ✅ Dirección creó al menos 1 cohorte nueva asignando profesor + módulo

**Dependencias:** Sprint 0 (staging + CI).

---

### SPRINT 2 — E-Learning estructura (unidades) + Materiales base
**Fechas:** Lun 1 dic – Dom 14 dic 2026
**Objetivo:** el profesor puede crear unidades con materiales dentro.

**Entregables:**
- F.1-F.3 Modelo de datos units/items/materials
- F.4-F.7 Estados de unidad + visibilidad
- F.8-F.11 Subir PDF, PPTX→PDF, imagen (sin video aún)
- F.16 Carpetas jerárquicas (ya existen, verificar integración)

**Micro-actividades:**

Semana 1 (1-7 dic):
- [ ] L 1/12, 4h — Marco: migración `units`, `unit_items`, `materials` con RLS
- [ ] M 2/12, 3h — Marco: Edge Function `evaluate-unit-status` (open_at/close_at al consultar)
- [ ] X 3/12, 4h — Marco: pantalla profesor CRUD de unidades + orden drag-and-drop
- [ ] J 4/12, 3h — Marco: pantalla profesor subir PDF + visibilidad por elemento
- [ ] V 5/12, 4h — Marco: servicio conversión PPTX/DOCX → PDF (LibreOffice headless)

Semana 2 (8-14 dic):
- [ ] L 8/12, 3h — Marco: subida de imagen + visor
- [ ] M 9/12, 3h — Marco: visor PDF embebido (PDF.js) con URL firmada
- [ ] X 10/12, 2h — Marco: estado Programada → se abre sola en fecha (prueba con fechas pasadas/futuras)
- [ ] J 11/12, 2h — Marco: `allow_download` por material + URLs firmadas de vida corta
- [ ] V 12/12, 3h — Profesor: crear 1 unidad real completa con 3 materiales
- [ ] S 13/12 — Validación con Pedro + profesor

**Criterios de validación:**
- ✅ Profesor creó una unidad con PDF + PPTX convertido + imagen
- ✅ Unidad programada aparece sola en su fecha (prueba automatizada con fechas)
- ✅ Estudiante no puede acceder por URL directa a unidad cerrada
- ✅ PDF se ve dentro de la app sin descargar

**Dependencias:** Sprint 1 (cohortes y módulos para asociar unidades).

---

### SPRINT 3 — Calendario único + Video + Seguimiento visualización
**Fechas:** Lun 15 dic – Dom 28 dic 2026
**Objetivo:** calendario funcionando con eventos y video reproducible con tracking.

**Entregables:**
- V.1-V.5 Calendario mensual con eventos auto-generados
- V.9-V.10 Vista profesor + administrativa del calendario
- F.13 Video MP4 con URL firmada
- F.14 Fuente alternativa YouTube embed
- F.19 Marca de agua dinámica (cédula + nombre) en visor y reproductor
- F.21-F.26 Seguimiento visualización: segmentos vistos, hitos, completado ≥90%, guardado periódico

**Micro-actividades:**

Semana 1 (15-21 dic):
- [ ] L 15/12, 3h — Marco: migración `calendar_events` + triggers desde quizzes/tareas/unidades
- [ ] M 16/12, 4h — Marco: pantalla calendario mensual estudiante
- [ ] X 17/12, 3h — Marco: vista semanal + eventos tipados (clase, examen, entrega, caso, pago)
- [ ] J 18/12, 2h — Marco: vista profesor del calendario
- [ ] V 19/12, 2h — Marco: vista admin/dirección cruzada

Semana 2 (22-28 dic — semana corta por fiestas):
- [ ] L 22/12, 4h — Marco: subida de video MP4 + reproductor HTML5 + URL firmada
- [ ] M 23/12, 2h — Marco: embed de YouTube no listado como fuente alternativa
- [ ] X 24/12, 3h — Marco: marca de agua superpuesta dinámica (cédula + nombre + fecha)
- [ ] V 26/12, 4h — Marco: tracking de segmentos vistos (no solo posición final)
- [ ] S 27/12, 3h — Marco: criterio "completado" ≥90% + guardado cada 10-15s
- [ ] D 28/12 — Validación

**Criterios de validación:**
- ✅ Estudiante abre su calendario y ve clases con hora, salón, profesor
- ✅ Un evento creado por profesor aparece en el calendario del estudiante sin pasos adicionales
- ✅ Video reproduce en el teléfono y retoma al cerrar/abrir la app
- ✅ **Adelantar un video con la barra NO lo marca como visto** (prueba manual)
- ✅ Marca de agua visible con los datos del estudiante que lo está viendo

**Dependencias:** Sprint 1 (salones y horarios), Sprint 2 (materiales).

---

### SPRINT 4 — Dashboard 8 indicadores + Mini chequeo
**Fechas:** Lun 29 dic – Dom 11 ene 2027
**Objetivo:** dirección recibe el correo del lunes con los 8 indicadores poblados con datos reales.

**Entregables:**
- U.5-U.12 Cálculo de los 8 indicadores
- N.2 Pantalla "Salud del sistema" con los 8
- N.3 Correo automático de los lunes
- F.28-F.30 Mini chequeo final + bloqueo quiz por material obligatorio

**Micro-actividades:**

Semana 1 (29 dic – 4 ene):
- [ ] L 29/12, 3h — Marco: queries SQL para cada uno de los 8 indicadores
- [ ] M 30/12, 3h — Marco: Edge Function `calculate-weekly-indicators` + cron domingo noche
- [ ] X 31/12 — Fiesta
- [ ] V 2/1, 4h — Marco: pantalla `/inicio/salud` con los 8 indicadores en tarjetas
- [ ] S 3/1, 3h — Marco: Edge Function `send-weekly-report-email` + plantilla HTML
- [ ] D 4/1, 1h — Marco: configurar cron lunes 7am

Semana 2 (5-11 ene):
- [ ] L 5/1 — Hito: primer correo del lunes enviado y recibido por dirección
- [ ] M 6/1, 3h — Marco: mini chequeo (1-3 preguntas al terminar video/audio)
- [ ] X 7/1, 3h — Marco: material "validado" solo tras aprobar mini chequeo
- [ ] J 8/1, 3h — Marco: bloqueo de quiz si materiales obligatorios no completos
- [ ] V 9/1, 2h — Dirección: validar que los 8 indicadores reflejan datos reales
- [ ] S 10/1 — Validación

**Criterios de validación:**
- ✅ Dirección recibe correo del lunes con los 8 indicadores
- ✅ Los 8 indicadores poblados con datos reales del piloto (no ceros)
- ✅ Un estudiante que no vio el material obligatorio no puede iniciar el quiz

**Dependencias:** Sprint 2 (materiales), Sprint 3 (seguimiento visualización — base del indicador 1).

---

### SPRINT 5 — Casos semanales + Dudas + Ciclo semanal + Repaso viernes
**Fechas:** Lun 12 ene – Dom 25 ene 2027
**Objetivo:** el ciclo L-V completo funcionando. El estudiante abre la app todos los días.

**Entregables:**
- G.2-G.5 Casos: flujo 4 pasos + calibración + martes/miércoles
- G.7 Caso manual del profesor
- E.1-E.2 Tira de 6 días + tarjeta diaria
- E.5-E.6 Duda del jueves + agrupación por tema para profesor
- E.7 Diagnóstica del viernes (3 preguntas sin peso)
- X.1-X.5 Dudas: hilos ligados a material, estados, notificaciones

**Micro-actividades:**

Semana 1 (12-18 ene):
- [ ] L 12/1, 3h — Marco: migración `cases`, `case_attempts` con RLS
- [ ] M 13/1, 4h — Marco: pantalla caso 4 pasos (hipótesis → medición → razonamiento → confianza)
- [ ] X 14/1, 3h — Marco: calibración de confianza (4 mensajes según acierto × confianza)
- [ ] J 15/1, 3h — Marco: distinción sintético (martes) vs real (miércoles)
- [ ] V 16/1, 3h — Marco: constructor de caso manual del profesor
- [ ] S 17/1 — Fin semana 1

Semana 2 (19-25 ene):
- [ ] L 19/1, 4h — Marco: tira 6 días con estados (done/today/future candado)
- [ ] M 20/1, 3h — Marco: tarjeta del día cambia según día (L: material, M: caso, etc)
- [ ] X 21/1, 3h — Marco: duda del jueves obligatoria + agrupación por tema
- [ ] J 22/1, 3h — Marco: diagnóstica viernes (3 preguntas sin peso, usando banco)
- [ ] V 23/1, 3h — Marco: panel profesor "dudas agrupadas" (guion de clínica)
- [ ] S 24/1 — Profesor: usar dudas agrupadas en clínica del sábado real
- [ ] D 25/1 — Validación

**Criterios de validación:**
- ✅ Un estudiante completó caso sintético + caso real de una semana
- ✅ Un profesor recibió dudas agrupadas y las usó en clínica del sábado
- ✅ Indicador 1 (completitud antes del sábado) muestra datos reales (no estimados)
- ✅ Un estudiante que se equivocó estando seguro recibe el mensaje "Estabas seguro y no era"

**Dependencias:** Sprint 2 (materiales como fuente del caso), Sprint 4 (indicador 1).

---

### SPRINT 6 — Evaluación práctica digital + Progreso del estudiante + Currículo
**Fechas:** Lun 26 ene – Dom 8 feb 2027
**Objetivo:** el sábado se evalúa desde la app, sin papel. Y el estudiante ve su mapa de dominio.

**Entregables:**
- I.1-I.5 Checklist + defensa + nota servidor + alerta crítica
- I.6 Competencias atadas al currículo
- N.6 Currículo con competencias (los 13 módulos)
- J.4-J.6 Mapa de competencias + 4 estados + "qué falló y por qué"
- J.8 What-If grades

**Micro-actividades:**

Semana 1 (26 ene – 1 feb):
- [ ] L 26/1, 4h — Marco: migración `performance_evaluations`, `rubric_templates`, `rubric_criteria`, `eval_criteria_results`, `defense_questions`, `technical_defenses`
- [ ] M 27/1, 2h — Dirección + Marco: cargar los 13 módulos con sus competencias en el currículo
- [ ] X 28/1, 4h — Marco: pantalla única de evaluación práctica (checklist + defensa)
- [ ] J 29/1, 2h — Marco: ítems críticos (alerta sin topar nota, regla 2 del §5.1)
- [ ] V 30/1, 3h — Marco: cálculo en servidor: `checklist × 70% + defensa × 30%`

Semana 2 (2-8 feb):
- [ ] L 2/2, 4h — Marco: mapa de competencias (vista estudiante) con 4 estados
- [ ] M 3/2, 3h — Marco: "qué falló y por qué" con guía
- [ ] X 4/2, 3h — Marco: What-If grades (simular nota hipotética)
- [ ] J 5/2, 2h — Pruebas con profesor en evaluación real
- [ ] V 6/2 — Sábado: profesor evalúa un sábado completo desde la app
- [ ] S 7/2 — Validación

**Criterios de validación:**
- ✅ Profesor evaluó un sábado completo desde la app (sin papel)
- ✅ Indicador 5 (fallo en ítems críticos) muestra datos reales
- ✅ Indicador 6 (nivel defensa) poblado
- ✅ Estudiante que reprobó una competencia abre "qué falló" y sabe qué estudiar

**Dependencias:** Sprint 4 (dashboard para visibilizar indicadores 5 y 6), Sprint 5 (ciclo semanal activo).

---

### SPRINT 7 — Exámenes digitales fusionados + Rediseño piloto
**Fechas:** Lun 9 feb – Dom 22 feb 2027
**Objetivo:** exámenes digitales usables con todas las reglas (intentos, topes, banco aleatorio) y nota entra directo a Notas.

**Entregables:**
- H.1-H.7 Configuración de evaluación (tipo, tiempo, escala, ponderación, nota mínima, defaults)
- H.8-H.14 Banco de preguntas + aleatorización + importación Excel
- H.15-H.19 Intentos 100%/80% + 24h + "Requiere intervención"
- H.20-H.32 Integridad + puerta entre unidades
- H.33 Fusión nota digital → Notas
- H.34 Constructor de exámenes del profesor
- R.2 Rediseño piloto en 3 pantallas (carnet, inicio estudiante, "antes de la clase" profesor)

**Micro-actividades:**

Semana 1 (9-15 feb):
- [ ] L 9/2, 3h — Marco: migración `quizzes` + `questions` + extensiones
- [ ] M 10/2, 3h — Marco: constructor de evaluación (tipo, tiempo, escala, intentos)
- [ ] X 11/2, 4h — Marco: banco de preguntas + importación Excel/CSV
- [ ] J 12/2, 3h — Marco: aleatorización preguntas + opciones + semilla por intento
- [ ] V 13/2, 4h — Marco: Edge Function `start-attempt` con temporizador servidor
- [ ] S 14/2, 3h — Marco: Edge Function `submit-attempt` revisada con reglas de intentos

Semana 2 (16-22 feb):
- [ ] L 16/2, 3h — Marco: estado "Requiere intervención" + otorgar intento extra manual
- [ ] M 17/2, 3h — Marco: puerta entre unidades (prerrequisito + fecha)
- [ ] X 18/2, 3h — Marco: fusión examen digital → tabla de Notas
- [ ] J 19/2, 4h — Marco + Vita: rediseño pantalla carnet (azul oscuro, orgánico)
- [ ] V 20/2, 4h — Marco + Vita: rediseño pantalla inicio estudiante + "antes de clase" profesor
- [ ] S 21/2 — Validación con Pedro

**Criterios de validación:**
- ✅ Profesor crea examen con 25 preguntas en banco, estudiante ve 10 al azar
- ✅ Dos estudiantes ven preguntas en orden distinto
- ✅ Recargar la página NO cambia el orden del mismo estudiante
- ✅ Segundo intento NO se habilita antes de 24h, tope 80%
- ✅ Al vencer el tiempo, examen se envía solo
- ✅ Nota del examen digital aparece en Notas automáticamente
- ✅ 3 pantallas con diseño nuevo aprobadas por Pedro

**Dependencias:** Sprint 2 (unidades para asociar quizzes).

---

### SPRINT 8 — Finanzas "cachea" + Comunicados + Panel profesor completo
**Fechas:** Lun 23 feb – Dom 8 mar 2027
**Objetivo:** el estudiante paga por cuotas desde la app subiendo captura.

**Entregables:**
- O.4-O.7 Plan de cuotas + captura + validación + descuentos
- O.8 Recordatorios automáticos de pago
- O.9 Calendario con pagos
- N.11 Comunicados / anuncios
- L.2-L.3 "Antes de la clase" + dudas agrupadas (panel profesor)

**Micro-actividades:**

Semana 1 (23 feb – 1 mar):
- [ ] L 23/2, 3h — Marco: migración planes de cuotas configurables
- [ ] M 24/2, 3h — Marco: pantalla admin para configurar plan de cuotas por programa
- [ ] X 25/2, 4h — Marco: estudiante sube captura (bucket privado + URL firmada)
- [ ] J 26/2, 3h — Marco: pantalla admin validar captura (aprobar/rechazar con motivo)
- [ ] V 27/2, 3h — Marco: reglas de descuento por pago anticipado automatizadas
- [ ] S 28/2, 2h — Marco: calendario integra pagos vencidos y próximos

Semana 2 (2-8 mar):
- [ ] L 2/3, 3h — Marco: Edge Function recordatorios automáticos de pago
- [ ] M 3/3, 4h — Marco: pantallas de comunicados (dirección publica, estudiantes reciben)
- [ ] X 4/3, 3h — Marco: panel profesor "antes de la clase" (dónde falla el grupo)
- [ ] J 5/3, 3h — Marco: dudas agrupadas en vista del profesor
- [ ] V 6/3, 2h — Pedro: validar flujo completo de pago
- [ ] S 7/3 — Validación

**Criterios de validación:**
- ✅ Estudiante paga una cuota subiendo captura
- ✅ Admin la valida en < 24h
- ✅ Descuento por pago anticipado se aplica solo
- ✅ Un comunicado llega a toda la cohorte y se mide lectura
- ✅ Profesor abre "antes de la clase" el viernes y prepara su clínica

**Dependencias:** Sprint 1 (cohortes), Sprint 3 (calendario).

---

### SPRINT 9 — Dudas completas + Historial + Carga masiva + Rediseño extendido
**Fechas:** Lun 9 mar – Dom 22 mar 2027
**Objetivo:** cerrar las piezas sueltas académicas y extender el rediseño a más pantallas.

**Entregables:**
- X.6-X.9 FAQ + imágenes en dudas + tiempo respuesta + dudas por unidad
- N.13 Historial de cambios por estudiante
- N.14 Carga masiva estudiantes (CSV)
- M.11 Carga masiva relacionada
- R.2 extendido a ~70% de pantallas con diseño nuevo

**Micro-actividades:**

Semana 1 (9-15 mar):
- [ ] L 9/3, 3h — Marco: FAQ visible al grupo
- [ ] M 10/3, 2h — Marco: adjuntar imagen en duda
- [ ] X 11/3, 2h — Marco: tiempo respuesta por profesor + alertas
- [ ] J 12/3, 2h — Marco: dudas por unidad en panel dirección
- [ ] V 13/3, 3h — Marco: historial de cambios estudiante (traslados, bajas, reactivaciones)
- [ ] S 14/3, 3h — Marco: carga masiva CSV de estudiantes

Semana 2 (16-22 mar):
- [ ] L 16/3, 4h — Marco + Vita: rediseño pantallas de materiales + calendario
- [ ] M 17/3, 4h — Marco + Vita: rediseño paneles profesor
- [ ] X 18/3, 4h — Marco + Vita: rediseño paneles dirección
- [ ] J 19/3, 3h — Marco: estados vacíos, carga, error consistentes
- [ ] V 20/3, 2h — Marco: responsive real en 360px probado en 3 teléfonos
- [ ] S 21/3 — Validación

**Criterios de validación:**
- ✅ Admin carga 20 estudiantes vía CSV sin incidencias
- ✅ Rediseño nuevo en ≥70% de pantallas, aprobado por Pedro
- ✅ No hay scroll horizontal en 360px en ninguna pantalla clave

**Dependencias:** Sprint 7 (rediseño piloto).

---

### SPRINT 10 — Pulido final + Seguridad + Preparación egresados
**Fechas:** Lun 23 mar – Sáb 4 abr 2027 (sprint corto por cierre)
**Objetivo:** v1.0 lista para presentar.

**Entregables:**
- R.3-R.7 Jerarquía, estados, accesibilidad, microinteracciones
- F.17-F.20 Marca de agua + límite de descargas
- A.7 2FA para admin / dirección / super_admin
- F.10-F.11 Entregas del estudiante + moderación (solo si cabe)
- B.9 Validación del INCES conectado
- Documento final de release

**Micro-actividades:**

Semana 1 (23-29 mar):
- [ ] L 23/3, 3h — Marco: 2FA con TOTP para admin/dirección
- [ ] M 24/3, 3h — Marco: límite de descargas por cuenta
- [ ] X 25/3, 3h — Marco: entregas del estudiante (si cabe)
- [ ] J 26/3, 3h — Marco: moderación de entregas por profesor
- [ ] V 27/3, 4h — Marco + Vita: pulido R.3-R.7
- [ ] S 28/3, 2h — Marco: Lighthouse Accessibility ≥90 en todas las pantallas clave

Semana 2 (30 mar – 4 abr):
- [ ] L 30/3, 2h — Admin: validar que INCES está conectado y los datos son completos
- [ ] M 31/3, 3h — Pruebas finales con el piloto completo
- [ ] X 1/4, 3h — Pedro + Marco: revisión final de todas las pantallas
- [ ] J 2/4, 3h — Preparar documento de release v1.0
- [ ] V 3/4 — Lanzamiento oficial del rediseño completo
- [ ] S 4/4 — Hito: cierre del Sprint 10, cohorte entera en v1.0

**Criterios de validación:**
- ✅ 100% admin/dirección con 2FA activo
- ✅ Lighthouse Accessibility ≥90 en pantallas clave
- ✅ Material con marca de agua identifica al estudiante que filtró (prueba manual)
- ✅ INCES vinculado al 100% de los estudiantes activos

**Dependencias:** Sprint 7 y 9 (rediseño).

---

### BACKLOG P3 (no entra en estos 10 sprints)

- S Egresados y comunidad (bolsa de trabajo, red social, CV)
- T Microlearning + simulador "el Estudio" — investigación aparte primero
- W Tutor IA socrático (Khanmigo-style) — investigación aparte primero
- C.12 Asistencia por NFC
- O.11 Pasarela de pago real
- B.13 Firma digital en tablet
- F.20 Marca quemada en video

Si Pedro aprueba traer alguno, se escribe un Sprint 11+ con sus micro-actividades.

---

### Resumen visual del cronograma

| Sprint | Fechas | Tema principal |
|---|---|---|
| 0 | 3-16 nov 2026 | Línea base + staging |
| 1 | 17-30 nov | Inscripción + gestión académica base |
| 2 | 1-14 dic | E-Learning estructura + materiales |
| 3 | 15-28 dic | Calendario + video + tracking |
| 4 | 29 dic – 11 ene 2027 | Dashboard 8 indicadores + mini chequeo |
| 5 | 12-25 ene | Casos + dudas + ciclo semanal |
| 6 | 26 ene – 8 feb | Evaluación práctica + progreso + currículo |
| 7 | 9-22 feb | Exámenes digitales + rediseño piloto |
| 8 | 23 feb – 8 mar | Finanzas "cachea" + comunicados |
| 9 | 9-22 mar | Dudas completas + rediseño extendido |
| 10 | 23 mar – 4 abr | Pulido + 2FA + release |

**Fechas importantes:**
- **16 nov 2026** — línea base capturada (antes del módulo de noviembre)
- **5 ene 2027** — primer correo del lunes a dirección
- **8 feb 2027** — primer sábado evaluado 100% desde la app
- **4 abr 2027** — v1.0 completa en producción

---

# PARTE VI — PLANTILLA DE REPORTE

## 11. PLANTILLA DE REPORTE DEL TÉCNICO

**Al cierre de cada sprint**, el técnico envía a Pedro (coordinador) un reporte con este formato exacto. No hay espacio para improvisar, es siempre la misma estructura.

### 11.1 Plantilla (copiar y pegar)

```
# REPORTE DE SPRINT [N] — ZR App

**Fechas:** [inicio] a [fin]
**Técnico:** Marco
**Fecha de envío:** [fecha]

---

## 1. ENTREGABLES

| # | Función | Esperado | Resultado | Notas |
|---|---|---|---|---|
| X.N | [nombre] | ✅ completar | ✅ / 🟡 / 🔴 | [línea breve] |
| X.N | [nombre] | ✅ completar | ✅ / 🟡 / 🔴 | [línea breve] |
...

**Resumen:** X de Y entregables completados (Z%).

---

## 2. CRITERIOS DE VALIDACIÓN

Para cada criterio del sprint, marco ✅ si se cumplió o 🔴 si no.

- ✅ / 🔴 [criterio 1 copiado del sprint]
- ✅ / 🔴 [criterio 2]
...

**Veredicto:** sprint CERRADO / sprint ABIERTO (quedan N criterios sin cumplir).

---

## 3. QUÉ QUEDÓ PENDIENTE Y POR QUÉ

Para cada 🟡 o 🔴 del punto 1:

- **[Función]**: [razón concreta: bloqueo técnico, falta decisión de Pedro, dependencia no lista, falló prueba, etc.]
- **[Función]**: [razón]

---

## 4. QUÉ SE DESCUBRIÓ DURANTE EL SPRINT

Cosas que no sabíamos al planificar:

- [Descubrimiento 1: ejemplo "La integración con Odoo requiere OAuth, no API Key"]
- [Descubrimiento 2]

Si alguno implica cambio al roadmap, lo marco con 🔄 y propongo cambio en §6.

---

## 5. MÉTRICAS DEL SPRINT

Para cada métrica única de las funciones entregadas (del §8 del documento maestro):

| Función | Métrica | Valor actual | Meta | Comentario |
|---|---|---|---|---|
| C.3 | % escaneos exitosos al primer intento | 94% | ≥90% | ✅ cumple |
| U.5 | Indicador 1: completitud antes del sábado | 70% | — baseline | Primera medición |
...

---

## 6. BLOQUEOS Y DECISIONES PARA EL PRÓXIMO SPRINT

- **[Bloqueo 1]**: necesito decisión de Pedro sobre [X]. Opciones: [A/B/C]. Mi recomendación: [A porque...].
- **[Bloqueo 2]**: dependencia no lista. [Qué falta y de quién].

---

## 7. PROPUESTA DE AJUSTE AL ROADMAP

Si algo cambió (nuevo épico, nueva función, prioridad distinta), lo propongo acá:

- 🔄 [Cambio propuesto]: [razón]. Si Pedro aprueba, actualizo `CLAUDE.md` sección [X].

---

## 8. NOTAS SUELTAS

Cualquier cosa que Pedro deba saber pero no cabe en los otros puntos.

---

**Fin del reporte.**
```

### 11.2 Reglas del reporte

- **Longitud:** no más de 2-3 páginas. Si algo requiere más, va como anexo adjunto.
- **Tono:** honesto. Un 🔴 claro vale más que un 🟢 ambiguo.
- **Frecuencia:** cierre de cada sprint (viernes o sábado de la segunda semana).
- **Entrega:** por correo o por el canal que Pedro prefiera, con el documento como archivo adjunto.

### 11.3 Reporte intermedio (opcional, mitad de sprint)

Al final de la primera semana, el técnico puede enviar un reporte corto de media página con solo:
- Qué se completó en semana 1 (% del sprint)
- Qué bloqueos aparecieron
- Si el sprint sigue en camino o hay riesgo

Esto evita sorpresas al cierre.

---

# PARTE VII — INSTRUCCIONES PARA LA IA DEL TÉCNICO

## 12. CÓMO DEBE OPERAR LA IA DEL TÉCNICO

Si eres **Claude Code** u otra IA de código trabajando con Marco en `C:\Dev\ZR App`:

### 12.1 Lo primero cada sesión

1. Lee este documento (`CLAUDE.md`, en la raíz del repo) completo si es tu primera sesión del día — ya se carga solo al abrir el repo, pero igual confírmalo.
2. Lee el **§14.1 Historial por sesión de trabajo** — ahí están, en orden, todas las sesiones anteriores con lo que hicieron y los documentos que generaron en `docs/reportes/`. Léelo siempre, no solo el primer día.
3. Mira en qué sprint estamos (§10) y qué micro-actividades toca hoy.
4. Si hay un reporte abierto de sprint anterior, léelo (`docs/reportes/reporte_sprint_N.md`).

### 12.1bis Lo último de cada sesión — dejar rastro en el historial

Antes de cerrar cualquier sesión que hizo trabajo real (no una pregunta rápida), agrega una fila a **§14.1** con: fecha, 1-2 líneas de qué se hizo, y el nombre de los documentos que generaste en `docs/reportes/` (si generaste alguno). Esto es **además** de la regla §0.2 (actualizar el roadmap en el mismo PR) — §0.2 es para cuando cambia el "qué construir"; §14.1 es para que cualquier sesión nueva se entere de lo que pasó, aunque no haya cambiado el roadmap.

### 12.2 Jerarquía de documentos

| Prioridad | Archivo | Para qué |
|---|---|---|
| 1 | **El estado real de `zr-prod`** | La verdad final |
| 2 | **Este documento (`CLAUDE.md`)** | Qué construir, en qué orden, con qué prioridad, y cómo construirlo (reglas, stack, estilo) — todo junto, desde el 7-nov-2026 |
| 3 | **`docs/25_...`** | Detalle de las ~180 funciones (resumidas aquí en §8) |
| 4 | **`plan/07_ALCANCE_V10.md`** | Detalle técnico de pantallas ya especificadas |
| 5 | **`spec/`** | Especificación concreta por pieza |
| 6 | **`metodologia/`** | Por qué el modelo es así |

`docs/26_PAQUETE_COMPLETO_TECNICO_OCT2026.md` ya no se edita — es un archivo histórico que redirige aquí (ver nota al inicio del documento).

### 12.3 Cuando algo contradice este documento

- **No te detengas en seco.**
- **Di en una línea** qué contradice.
- **Pregunta a Pedro (producto) o Marco (técnico).**
- **Si dicen "procede", procedes.**
- En el mismo PR actualizas este documento (`CLAUDE.md`), sección correspondiente.
- Las 10 reglas absolutas (§6) siguen vigentes.

### 12.4 Antes de cerrar cualquier tarea

Checklist técnico que **debe** pasar antes de marcar una tarea como completada:

- [ ] ¿La tarea está en el sprint actual del §10?
- [ ] ¿La función tiene métrica única en el §8 (o en `docs/25_...`)?
- [ ] ¿La función tiene criterio de validación en el sprint?
- [ ] Si creaste tabla: RLS activo + políticas escritas + `test:rls` pasa.
- [ ] Si tocaste la base: migración nueva en `supabase/migrations/`.
- [ ] `npm run typecheck` pasa.
- [ ] `npm run test` pasa.
- [ ] Probaste camino feliz **y** camino de error.
- [ ] Funciona en 360px (teléfono real).
- [ ] Actualizaste el estado en §8 del épico (🔴 → 🟡 → ✅).
- [ ] Si cambió una dependencia, actualizaste §10.

### 12.5 Al cierre de cada sprint

- Preparas el reporte usando la plantilla del §11.
- Lo guardas en `docs/reportes/reporte_sprint_N.md`.
- Lo envías a Pedro.
- Esperas aprobación o cambios antes de arrancar el siguiente sprint.

### 12.6 Si encuentras algo construido que no aparece aquí

Es porque este documento se escribió sin auditar línea por línea las 131 migraciones de `zr-prod`. **No lo elimines.** Agrégalo al épico correspondiente en §8 con estado ✅ y la fecha en que se descubrió.

### 12.7 Si Pedro pide algo urgente fuera del sprint

- Pregunta: "¿Esto reemplaza algo del sprint actual, o se suma? Si se suma, ¿qué del sprint actual se posterga?"
- No arranques hasta que Pedro responda.
- Si lo meten, actualiza §10 con la nueva micro-actividad y el impacto en el sprint.

### 12.8 Si una micro-actividad toma más tiempo del estimado

- Si pasa el 50% más, para y escribe media línea en §10 ajustando el estimado para que la próxima vez sea realista.
- Si pasa el 200%, para completamente y pregunta a Marco si vale la pena seguir o rediseñar.

### 12.9 Casos específicos frecuentes

**"No puedo cargar la cédula del padre porque la columna no existe en profiles."**
- Mira el flujo de inscripción en §3. El padre no es un usuario, es un dato en la hoja física. Si necesitas guardarlo, va en una columna nueva de `students` como JSONB o en una tabla aparte `parental_contacts`. Pregunta antes de decidir estructura.

**"La IA de otra sesión creó una Edge Function que no está documentada aquí."**
- Lee la Edge Function. Si cumple una función listada en el §8, actualiza el estado a ✅ y menciónalo en §12.6. Si no, pregunta a Marco.

**"Pedro me pidió hacer X y no coincide con el roadmap."**
- Aplica §12.3. No te detengas, no reclames, procede y actualiza.

---

# PARTE VIII — PREGUNTAS ABIERTAS Y DECISIONES

## 13. PREGUNTAS ABIERTAS Y DECISIONES TOMADAS

### 13.1 Preguntas abiertas (todavía bloquean algo)

| # | Pregunta | Bloquea | Para cuándo |
|---|---|---|---|
| 1 | ¿Formulario INCES ya está conectado al perfil? | B.9, certificación | Antes de certificar primera cohorte |
| 2 | ¿Odoo cómo se conecta técnicamente desde Supabase? (API REST, webhooks, Edge Function) | O.10 | Antes de Sprint 8 |
| 3 | ¿Simulador "el Estudio" cuál es exactamente? (API, integración, costo) | T.4 | Cuando se decida construir T |
| 4 | ¿Firma digital en tablet, con qué proveedor? | B.13 | Backlog |

### 13.2 Decisiones ya tomadas (resueltas)

- ✅ Grupo piloto = los 20 estudiantes actuales (U.2)
- ✅ Exámenes digitales y Notas se fusionan (H.33)
- ✅ La academia paga el consumo de IA (G.8, W)
- ✅ Odoo ya corre en servidor propio
- ✅ Los 13 módulos del currículo son los reales
- ✅ Dirección Académica es dueña de lo académico; Admin de lo operativo diario
- ✅ QR de asistencia y de refrigerio son flujos separados
- ✅ ZR Coffee es rol independiente, no bajo administración
- ✅ Vendedor crea perfil pre-inscrito, admin activa tras firma física + pago
- ✅ Mostrar QR disponible para admin, dirección y super_admin

---

# PARTE IX — HISTORIAL

## 14. HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambios |
|---|---|---|
| 2026-10-26 | v1 (`docs/24`) | Primer roadmap maestro con 24 épicos |
| 2026-10-26 | v2 (`docs/25`) | +Flujo vendedor, +QR 2 flujos, +Dirección dueña de lo académico, +E-Learning integrado, +ZR Coffee aparte, +4 reglas pedagógicas, +ciclo semanal, +8 indicadores con ejemplos, +criterios validación, +decisiones tomadas |
| 2026-10-26 | v3 (`docs/26`) | **Documento consolidado único.** Reordena sprints en orden lógico, agrega fechas reales (3 nov 2026 – 4 abr 2027), agrega micro-actividades por día en cada sprint, agrega plantilla de reporte del técnico, agrega instrucciones completas para la IA del técnico. Reemplaza la necesidad de documentos separados. |
| 2026-11-07 | v4 (`CLAUDE.md`, este) | **Reconciliación.** `CLAUDE.md` y `docs/26_...` se habían separado (cada uno con secciones que el otro no tenía — ver nota al inicio del documento). Se fusionó todo aquí, en `CLAUDE.md`, por ser el archivo que toda IA de código carga sola; `docs/26_...` queda como histórico sin editar. Se agregó §12.1bis y §14.1 (historial por sesión de trabajo). |

---

## 14.1 HISTORIAL POR SESIÓN DE TRABAJO

> Esto es distinto a la tabla de arriba. La tabla de §14 lleva el historial de **versiones de este documento** (cuando cambia el roadmap o su estructura). Esta tabla lleva el historial de **sesiones de trabajo** — qué hizo cada sesión de la IA, aunque no haya tocado el roadmap. Regla de uso en §12.1 y §12.1bis: toda sesión nueva la lee antes de empezar, toda sesión que trabajó de verdad agrega una fila antes de cerrar.

| Fecha | Qué se hizo | Documentos generados |
|---|---|---|
| 2026-11-07 | Ronda de UX pedida por el coordinador sobre Aula Virtual en `zr-staging` (ver §8.4) y validación parcial del mapa de épicos contra el código real (ver §8.5). | — (cambios directo en §8 de este documento) |
| 2026-11-07 | Reporte de estado para el coordinador: qué está en `zr-prod` vs. qué está terminado en `zr-staging` esperando subir, más validación contra el documento maestro. | `docs/reportes/reporte_coordinador_2026-11-07.md` |
| 2026-11-07 | **Chequeo masivo de producción** (`zr-prod`/`main`) antes del arranque del nuevo programa del sábado: build/typecheck/lint, advisors de seguridad/rendimiento, RLS y Edge Functions de asistencia/QR/refrigerio, PWA/manifest, rutas enlazadas vs. reales, responsive 320-375px. Encontró y corrigió 1 bug real: el atajo "Mi carnet" del manifest apuntaba a `/carnet` (no existe) en vez de `/perfil` — ya desplegado a producción. | `docs/reportes/chequeo_masivo_produccion_2026-11-07.md` |
| 2026-11-07 | **Chequeo masivo de staging** (`zr-staging`/`develop`), mismo alcance que el de producción, más verificación funcional de punta a punta del módulo Unidades/E-Learning con cuentas QA reales (recorrido, compuerta, materiales, bloques de texto, dudas, tareas, examen de certificación completo). Encontró y corrigió 1 bug real de RLS (la compuerta de la migración 185 no bloqueaba `content_items` directamente — migración 190, ver §8.1). Dejó documentados sin tocar código: falta de enlace a `/calificar` (decisión intencional de Fase 0, a confirmar si se retoma), una pregunta inapropiada en un examen de prueba (pendiente de que Pedro la borre), y dos migraciones (188/189) aplicadas directo a la base el 6-nov sin quedar como archivo en git (efecto neto ya es cero). | `docs/reportes/chequeo_masivo_staging_2026-11-07.md` |
| 2026-11-07 | Lista de pruebas manuales de Aula Virtual en staging (por rol, con criterio de "no desplegar hasta marcar todo") + tareas pendientes de Sprint 0 y decisiones abiertas para la semana, armada para el trabajo del sábado. | `docs/reportes/SAB_7_NOV.md` |
| 2026-11-07 | Ronda de UX del coordinador sobre Aula Virtual: staff entra a Unidades como sí mismo, estética "Recorrido" en la vista de lectura del profesor, botón "Ver" en cada ítem de la unidad (ver §8.6). | — |
| 2026-11-07 | Tres ajustes a Notas de Dirección Académica pedidos directo por el coordinador, dos rondas sobre lo visto en vivo: reordenar columnas con drag-and-drop, historial de evaluaciones por sesión, formato de nota manual, barra lateral colapsable, color de scrollbars (ver §8.7). | — |
| 2026-11-07 | **Incidente en vivo (sábado de arranque):** PTMA-2026-III no tenía clase de hoy ni aparecía en `/qr` — a la cohorte nunca se le inició el módulo ya asignado. Corregido directo en `zr-prod` (dato, sin migración). Ver §8.8. | — |
| 2026-11-07 | **Incidente en vivo:** abrir el feedback de módulo (último sábado de Instrumentación automotriz en PTMA-2026-II) no mandaba push — nunca se había construido ese trigger. Se construyó, se probó en `zr-staging` y se aplicó a `zr-prod` (migración 192); se re-disparó el push real de hoy. Ver §8.8. | `supabase/migrations/192_push_feedback_macro_abierto.sql` |
| 2026-11-07 | Se agregó este apartado (§14.1) y la regla §12.1bis en `docs/26_...`, a pedido de Pedro, para que el historial de sesiones quedara dentro del documento maestro. | — |
| 2026-11-07 | **Reconciliación de `CLAUDE.md` y `docs/26_...`** (este mismo cambio): se detectó que ambos archivos se habían separado y se fusionó todo en `CLAUDE.md`, que queda como única fuente de verdad desde ahora. `docs/26_...` se dejó como histórico, con una nota al inicio que redirige aquí. | — |
| 2026-11-07 | Checklist de campos al descargar planillas (pedido de Dirección Académica): al bajar la planilla —masiva o individual— se elige qué datos salen impresos, todo marcado por defecto. Ver §8.9. Desplegado a staging y producción. | — (cambios en §8.9) |
| 2026-11-07 | **Revertido de `zr-prod`** el módulo completo de Unidades/Aula Virtual: nunca debió mergearse a producción (solo estaba validado en staging). Se restauraron las 4 entradas visibles (menú estudiante/profesor, botones de Mi módulo/Inicio) a "Material", y se limpiaron 3 enlaces secundarios (atajo de Dirección, enlace del profesor, botón volver de Exámenes). Dos hotfixes directos a `main`, sin tocar datos ni migraciones (las tablas del Aula ni existían en la base de prod). | — |
| 2026-11-07 | **Fix en staging:** Dirección Académica/super_admin perdían su propio menú (Panel, Asistencia, Personal, Cohortes, Notas académicas...) al entrar a Unidades como ellos mismos -- la barra lateral seguía siendo la reducida del profesor. Nuevo `lib/nav-direccion.ts` con su menú propio; ahora lo conservan completo, con "Unidades" resaltado. | `lib/nav-direccion.ts` |
| 2026-11-07 | **Fix en staging:** Dirección/super_admin no podían abrir el examen de otro profesor desde "Ver" (p. ej. certificación "sixeven 1") -- un filtro `.eq('teacher_id', user.id)` de más en el cliente los bloqueaba antes de llegar a la RLS, que ya se los permitía. Se quitó el filtro. | — |
| 2026-11-07 | **#3b cerrado (H.33, fusión Unidades → Notas)**, explicado por Pedro vía el coordinador: el examen/tarea digital, al crearse dentro de la unidad, ya es la evaluación en Notas -- sin registrarla aparte. Migración 193 (triggers + backfill, incluido el tope `least()` para un dato de prueba fuera de escala) + campo de % en las pantallas de crear examen/tarea + modal de confirmación. Solo en staging. Ver §8.6 #3b. | `supabase/migrations/193_fusion_examenes_tareas_notas.sql` |
| 2026-11-07 | **Bug reportado por el coordinador:** super_admin devuelto al panel al tocar "Certificación", "Crear examen nuevo" o agregar material, dentro de Unidades. Primer diagnóstico (chequeo de rol endurecido en los layouts) resultó equivocado -- el coordinador mandó un video reproduciendo el bug con ese fix ya desplegado. Analizando el video fotograma a fotograma se encontró la causa real: `proxy.ts` seguía exigiendo la cookie de "vista de recorrido" para que Dirección/super_admin entraran a `/crear-examen` y `/contenido-docente`, sin reflejar el fix de #1 (entrar como ellos mismos). Corregido. Ver §8.6bis. | — |
| 2026-11-07 | **#4 construido** (banner editable de la unidad): imagen propia o uno de 5 colores oscuros, y aspecto moderno/clásico por unidad -- a pedido explícito, después de haberlo dejado fuera de alcance al inicio del día. Migración 194 + bucket público `banners-unidad`. Ver §8.6 #4. Solo en staging. | `supabase/migrations/194_banner_unidad_personalizable.sql` |
| 2026-11-07 | **#4, ronda 2**: se quitó "aspecto" (migración 195), se agregó posición de imagen y comprimidor reutilizado, el color ahora también tiñe botones/contornos (acento), y "Ver" examen ya no va al constructor sino a una pantalla nueva (lista de estudiantes → corregir redacciones por intento, adaptando la cola `/calificar` que ya existía). Bug encontrado y corregido en el camino: `grade-answer` no dejaba calificar a `direccion_academica`. Ver §8.6 #4. Solo en staging. | `supabase/migrations/195_banner_unidad_ajustes.sql` |
| 2026-11-07 | **Bug reportado por el coordinador (video):** la selección de programa/módulo se perdía sola a mitad de trabajo, sin ningún clic, y mandaba de vuelta a elegir módulo. Analizado fotograma a fotograma -- causa exacta no confirmada (candidato: `use-recargar-al-volver.ts`, recarga la página tras 60s+ oculta). Corregido lo que sí se pudo con certeza: `ContextoDocente` ahora guarda la elección en `sessionStorage` y la restaura si se remonta. Ver §8.6ter. | — |
| 2026-11-07 | **Bug reportado por el coordinador (captura):** "No se pudo guardar" al calificar una redacción como super_admin. Causa confirmada por logs: `exam_answers.graded_by` (y otras 6 columnas iguales) referenciaban `teachers(id)` -- tabla de solo 3 filas, sin super_admin/Dirección. Migración 196: las 7 se relajan a `profiles(id)`; se dejaron intactas `cohorts.teacher_id`/`class_sessions.teacher_id`/`teacher_module_assignments.teacher_id`, que sí son "el profesor asignado de verdad". Ver §8.6quater. | `supabase/migrations/196_fks_graded_by_a_profiles.sql` |
| 2026-11-07 | **Ronda 3 del #4** (color a fondo, mismo día): el color de acento ahora tiñe TODOS los botones y contornos de `unidades-docente/[unitId]`, no solo el banner y el recorrido. **Responsive, 3 bugs reales encontrados y corregidos:** el modo edición no tenía padding de página (botón "Listo" pegado al borde, tapado por la campanita); `pt-14` no sumaba `env(safe-area-inset-top)` (bug en celulares con notch, corregido en 7 pantallas); el FAB "Editar unidad" no tenía `z-index` ni margen consciente del área segura inferior (quedaba tapado por la barra flotante en celulares con home indicator grande). Ver §8.6 #4, ronda 3. | — |
| 2026-11-07 | **Eliminar/renombrar unidades** (pedido explícito: "si quiero eliminar inglés 1"), en `/unidades-docente`. Renombrar es directo; eliminar muestra antes un resumen de qué hay dentro (material/examen enlazado no se borra, tareas con entregas sí se pierden, bloques de texto se borran, dudas quedan sin unidad). Falta de RLS encontrada y corregida en el camino: el bucket `tareas` no tenía NINGUNA política de DELETE -- los archivos de entregas se habrían quedado huérfanos en Storage para siempre. Borrado hecho con un RPC atómico (`fn_eliminar_unidad`, `security definer`, valida `is_staff()` él mismo). Ver §8.10. | `supabase/migrations/197_borrar_entregas_y_unidades.sql` |

---

**Fin del documento.**

**Para dudas:** §13.
**Para proponer cambios:** §12.3.
**Para arrancar el próximo sprint:** §10, buscar el sprint cuya fecha de inicio sea más próxima.
**Para enviar reporte:** §11.

---

# ANEXO TÉCNICO — reglas de "cómo construir" (stack, estilo, convenciones del repo)

> Estas dos secciones (A1 y A2) vienen del `CLAUDE.md`/`AGENTS.md` anterior a la fusión del
> 26-oct-2026 y siguen 100% vigentes. Respaldo completo del maestro anterior en
> `docs/CLAUDE_AGENTS_viejo_2026-10-30.md`.

## A1. RAMAS Y ENTORNOS

Desde septiembre de 2026 hay dos entornos, no uno. Antes de esto, todo se trabajaba directo
sobre `main` contra la base de producción — eso se terminó.

| Rama | Qué es | Base de datos | Deploy |
|---|---|---|---|
| `main` | Producción. Lo que usan los estudiantes reales. | `zr-prod` (`hagbqhnittynxebdssua`) | Automático a producción en cada push. |
| `develop` | Donde se trabaja de ahora en más. | `zr-staging` (`iazqmnfekulxjcqelzog`) | Automático a un entorno de prueba aparte. |

**Reglas:**

1. Todo cambio nuevo — features, pruebas, casos sintéticos — se hace en `develop`, nunca directo
   en `main`. `main` solo recibe merges de `develop` ya probados, o un hotfix directo cuando algo
   en producción está roto y no puede esperar.
2. Las migraciones se crean y se aplican primero contra `zr-staging` (`develop`), se prueban ahí
   con datos falsos, y solo después se aplican contra `zr-prod` al mergear a `main`. Sigue
   aplicando la regla de "nunca se edita una migración ya aplicada", en ningún entorno.
3. Nunca se sincronizan datos reales de estudiantes hacia `zr-staging`. El entorno de prueba
   existe justamente para no arriesgar esos datos.
4. Si una migración necesita `ALTER TYPE ... ADD VALUE`, va SOLA en su propio archivo, sin nada
   más en la misma transacción que consulte ese valor nuevo — Postgres no lo permite en la misma
   transacción. Ejemplo real: la migración `021_direccion_academica.sql` tuvo que aplicarse en dos
   partes por esto.
5. `supabase/seed/seed_dev.sql` describe un esquema antiguo (13 módulos genéricos, sin las
   columnas que exige el currículo real de PTMA/PFTA) y no se puede correr tal cual contra el
   esquema actual. No usarlo como referencia de qué datos de prueba crear — antes de tocarlo, hay
   que reescribirlo para que coincida con las migraciones vigentes.

---

## A2. TUTORIAL GUIADO (TOUR)

Desde octubre de 2026 hay un tutorial guiado — pedido explícito del coordinador — para **todos
los roles menos `super_admin`**: estudiante, profesor, admin, Dirección Académica (comparte el de
admin, mismo panel) y ZR Coffee lo tienen; `super_admin` nunca.

Vive en `lib/tour-pasos.ts` (los pasos, por rol), `lib/useTour.ts` (el hook que decide qué
mostrar) y `components/ui/Tour.tsx` (el componente que dibuja la tarjeta y resalta la pantalla).
Cada persona guarda en `profiles.tour_pasos_vistos` la lista de IDs de los pasos que ya vio —
no es un booleano "ya vio el tour sí/no" (migración 173).

**Regla obligatoria: toda función, sección o pantalla nueva que un rol pueda no descubrir solo
tiene que agregar su propio paso al tour de ese rol**, en `lib/tour-pasos.ts`. No es opcional ni
"si hay tiempo" — es parte de terminar la tarea, igual que el `npm run typecheck` antes de dar
algo por hecho. Cómo hacerlo está documentado con detalle en los comentarios de ese mismo
archivo; en resumen:

1. Si la función vive en una pantalla nueva, su contenedor principal lleva un `id="tour-algo"`
   único en esa pantalla (si no hay un elemento puntual que resaltar, el paso usa `targetId: null`
   y se muestra centrado — sigue siendo válido, no hace falta inventar un recuadro).
2. Se agrega un objeto al arreglo de ese rol en `PASOS_POR_ROL` con un `id` **único y estable
   para siempre** (nunca se cambia ni se reusa — es lo que queda guardado en la base de cada
   persona que ya lo vio), la `ruta`, el `targetId`, y `titulo`/`texto` cortos, en español de
   Venezuela, sin tecnicismos.

**Por qué no hace falta tocar nada más:** `useTour.ts` ya calcula solo qué pasos le faltan a cada
quien. A quien nunca vio el tour de su rol, se lo muestra completo, con la bienvenida genérica. A
quien ya lo había visto y ahora hay pasos nuevos, **no se le repite nada de lo que ya vio** — ve
únicamente "Aprende a usar las nuevas funciones de ZR App" y entra directo a lo nuevo. Si no le
falta ningún paso, no ve nada automáticamente (pero puede repasarlo entero desde "Cómo usar la
app" en su perfil — `components/ui/BotonComoUsarApp.tsx`).

**Vista de recorrido:** el tour nunca se dispara para alguien que está viendo la app como otro
rol (p. ej. Dirección Académica recorriendo la vista de profesor) — cada layout distingue el rol
real del rol que se está recorriendo antes de activar el hook. Si agregas un paso para un rol que
también se puede recorrer (profesor, estudiante, ventas), no hace falta nada especial: esa
distinción ya está resuelta en el layout de cada rol.

**Responsivo:** `Tour.tsx` ya acomoda la tarjeta sola para que nunca se salga de la pantalla, sea
cual sea su tamaño (recorta el recuadro resaltado a lo visible, y si un elemento ocupa casi toda
la pantalla, renuncia al recuadro y centra la tarjeta en vez de cortarla contra el borde). No hace
falta tocar esa lógica al agregar un paso — solo probar en un teléfono angosto (320–375 px) que el
texto no quede demasiado largo.
