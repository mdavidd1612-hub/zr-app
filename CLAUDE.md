# 26 · PAQUETE COMPLETO PARA EL TÉCNICO — ZR APP

> **Qué es este documento:** todo lo que el técnico y su IA necesitan para trabajar en ZR App, en un solo lugar. Reemplaza y consolida: `docs/24_...`, `docs/25_...`, el plan de sprints, la plantilla de reporte y las instrucciones para la IA.
> **Fecha:** 26 de octubre de 2026
> **Autor:** Vita (Pedro para producto, Marco para técnico)
> **Jerarquía:** este documento manda sobre el `CLAUDE.md` viejo en lo que respecta al "qué construir" y al "en qué orden". El `CLAUDE.md` sigue mandando en el "cómo construir" (reglas técnicas, stack, estilo).

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

Se auditó el documento "ZR App — Módulo E-Learning" contra `zr-staging` y el código (aplica §12.6). **El módulo está construido en `develop` → `zr-staging`, migraciones 174–182; NO está mergeado a `zr-prod` todavía, y las tablas están vacías (estructura lista, falta cargar contenido).** Reutiliza tablas existentes: materiales = `content_items` (extendida), quizzes = `exams` (extendida), más `units`, `unit_items`, `material_progress`, `assignments`, `submissions`, `calendar_events`, `activity_log`, `doubts`/`doubt_responses`, `intervention_grants`.

**Épico F (E-Learning) → 🟡 (antes 🔴).**
- ✅ Unidades: estados, `open_at`/`close_at`, visibilidad por elemento, prerrequisito (migr. 174)
- ✅ Visor embebido: PDF (pdf.js/canvas), imagen, audio, video nativo con URL firmada (`VisorMaterial.tsx`, migr. 175)
- ✅ Seguimiento por segmentos vistos (adelantar no cuenta) + guardado ~15s (migr. 177)
- ✅ Tareas: entrega PDF, descarga individual firmada, calificación inline (migr. 178)
- ✅ Calendario auto-alimentado + export iCal `fn_calendar_ical` (migr. 179)
- ✅ Dudas por unidad/material, FAQ, respuesta oficial, resumen IA `resumir-dudas` (migr. 180/182)
- 🔴 Falta: marca de agua (F.19) · conversión PPTX/DOCX→PDF (F.5; hoy abre en visor de Office) · YouTube embed (F.14) · proveedor de video + marca quemada · transcodificación MPG→MP4

**Épico H (Evaluaciones) → 🟡.**
- ✅ Constructor de exámenes (opción múltiple, V/F, redacción), intentos/cooldown/tope, timer de servidor (`exam_attempts.expires_at`), calificación en servidor (`submit-attempt`, `grade-answer`), estado "Requiere intervención" (`intervention_grants`) (migr. 176)
- 🟡 Banco de N al azar: columnas `questions_per_attempt`/`seed` existen y el estudiante usa la semilla, pero falta la opción en el constructor del profesor (H.11/H.12)
- 🔴 Falta: importación masiva de preguntas desde Excel/CSV (H.14) · descarga masiva de tareas en ZIP

> Con esto F deja de ser 🔴 (los "Totales" de arriba quedan desfasados; se recalculan al mergear a producción).

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

- 🔄 [Cambio propuesto]: [razón]. Si Pedro aprueba, actualizo `docs/26_...` sección [X].

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

1. Lee este documento (`docs/26_...`) completo si es tu primera sesión del día.
2. Lee el `CLAUDE.md` del repo.
3. Mira en qué sprint estamos (§10) y qué micro-actividades toca hoy.
4. Si hay un reporte abierto de sprint anterior, léelo (`docs/reportes/reporte_sprint_N.md`).

### 12.2 Jerarquía de documentos

| Prioridad | Archivo | Para qué |
|---|---|---|
| 1 | **El estado real de `zr-prod`** | La verdad final |
| 2 | **`docs/26_...` (este)** | Qué construir, en qué orden, con qué prioridad |
| 3 | **`CLAUDE.md`** | Cómo construir (reglas, stack, estilo) |
| 4 | **`docs/25_...`** | Detalle de las ~180 funciones (resumidas aquí en §8) |
| 5 | **`plan/07_ALCANCE_V10.md`** | Detalle técnico de pantallas ya especificadas |
| 6 | **`spec/`** | Especificación concreta por pieza |
| 7 | **`metodologia/`** | Por qué el modelo es así |

### 12.3 Cuando algo contradice este documento

- **No te detengas en seco.**
- **Di en una línea** qué contradice.
- **Pregunta a Pedro (producto) o Marco (técnico).**
- **Si dicen "procede", procedes.**
- En el mismo PR actualizas `docs/26_...` sección correspondiente.
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
| 2026-10-26 | v3 (`docs/26`, este) | **Documento consolidado único.** Reordena sprints en orden lógico, agrega fechas reales (3 nov 2026 – 4 abr 2027), agrega micro-actividades por día en cada sprint, agrega plantilla de reporte del técnico, agrega instrucciones completas para la IA del técnico. Reemplaza la necesidad de documentos separados. |

---

**Fin del documento.**

**Para dudas:** §13.
**Para proponer cambios:** §12.3.
**Para arrancar el próximo sprint:** §10, buscar el sprint cuya fecha de inicio sea más próxima.
**Para enviar reporte:** §11.

---

# ANEXO TÉCNICO — del `CLAUDE.md` anterior (reglas de "cómo construir" que el doc 26 no incluye)

> El documento 26 (§6 y §12.2) dice que el `CLAUDE.md` **sigue mandando en el "cómo construir"**
> (reglas técnicas, stack, estilo). Estas dos secciones estaban en el `CLAUDE.md`/`AGENTS.md`
> anterior, siguen 100% vigentes y **no aparecen en el cuerpo del doc 26**, así que se conservan
> aquí para no perderlas. Respaldo completo del maestro anterior en
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
