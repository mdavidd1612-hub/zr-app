# TABLERO TRELLO — ZR APP FASE 1
> Estructura del tablero, convenciones de uso y catálogo completo de tarjetas.
> El archivo `trello_import.csv` de esta misma carpeta contiene las mismas tarjetas listas para
> importar.

---

## 1. ESTRUCTURA DEL TABLERO

**Nombre del tablero:** `ZR App — Fase 1 (entrega 5 sep 2026)`

### Listas (en este orden, de izquierda a derecha)

| # | Lista | Qué contiene | Regla |
|---|---|---|---|
| 1 | **📋 Backlog Fase 1** | Todo lo planificado que aún no empezó | Se llena una vez y se congela el 3 de agosto |
| 2 | **🚧 Bloqueado por terceros** | Tareas detenidas esperando a la academia, legal o una decisión | **Toda tarjeta aquí lleva fecha de vencimiento y un responsable externo con nombre.** Si lleva más de 48 h, se escala a DP |
| 3 | **🎯 Sprint actual** | Lo comprometido para el sprint en curso | Se recarga cada lunes. Nada entra a media semana |
| 4 | **⚙️ En progreso** | Lo que alguien está haciendo ahora mismo | **Máximo 2 tarjetas por persona.** Si necesitas una tercera, algo está bloqueado y hay que decirlo |
| 5 | **👀 En revisión** | Código escrito, esperando revisión de otra persona | Nada pasa de aquí sin que lo apruebe alguien distinto a quien lo hizo |
| 6 | **🧪 Probado en sábado real** | Funciona con usuarios reales en la sede | Es el único filtro que importa. El código que funciona en la laptop no está probado |
| 7 | **✅ Hecho** | Cumple las 7 condiciones de la Definición de Hecho | Ver `11_PLAN_EJECUCION_FASE1.md` §0.3 |
| 8 | **🧊 Fase 1.5 / Fase 2** | Ideas que llegaron después del congelamiento | **No se discuten hasta el 6 de septiembre.** Existe para que las ideas no se pierdan ni interrumpan |

> El cuello de botella de este proyecto no es escribir código: es decidir y verificar. Por eso
> hay una lista de bloqueos por terceros y una de prueba con usuarios reales. Un tablero sin
> esas dos listas oculta exactamente los problemas que hacen llegar tarde.

### Etiquetas (colores)

| Color | Etiqueta | Uso |
|---|---|---|
| 🔴 Rojo | `BLOQUEANTE` | Detiene a otras tareas. Se atiende antes que nada |
| 🟠 Naranja | `EXTERNO` | Depende de alguien fuera del equipo técnico |
| 🟡 Amarillo | `LEGAL/LOPNNA` | Cumplimiento normativo. **Nunca se recorta** |
| 🟢 Verde | `FRONTEND` | Next.js, PWA, pantallas |
| 🔵 Azul | `BACKEND` | Supabase, SQL, Edge Functions |
| 🟣 Morado | `INFRA/CI` | Entornos, despliegue, respaldos, integración continua |
| ⚫ Negro | `SEGURIDAD/RLS` | Control de acceso. **Nunca se recorta** |
| 🩵 Celeste | `DATOS` | Carga de datos semilla, migración de información |
| 🩷 Rosa | `QA/PRUEBA` | Pruebas, validación en campo |

### Miembros y códigos
`DP` dueño de producto · `T1` técnico backend · `T2` técnico frontend · `IA` agente de código ·
`CA` Coordinación Académica · `ADM` Administración · `LEG` Legal

### Convenciones de tarjeta
- **Título:** siempre empieza con el código de sprint. `[S0]`, `[S1]` … `[S5]`, `[EXT]`.
- **Fecha de vencimiento:** obligatoria. Es la del cierre de su sprint, salvo las externas.
- **Descripción:** qué hay que hacer y **cuándo se considera hecho**. Sin criterio de
  terminación, la tarjeta se devuelve.
- **Checklist:** en las tarjetas de más de medio día de trabajo.

### Rituales
- **Lunes, 20 min:** vaciar `Sprint actual`, cargar el sprint nuevo desde el Backlog.
- **Diario, 15 min:** repasar `En progreso` y `Bloqueado por terceros`. Solo esas dos listas.
- **Sábado en la sede:** mover a `Probado en sábado real` lo que sobrevivió al uso real.
- **Domingo, 15 min:** mover a `Hecho` lo que cumple las 7 condiciones. Lo que no, vuelve.

---

## 2. CATÁLOGO DE TARJETAS

### 🚧 Bloqueado por terceros — arrancan bloqueadas desde el día 1

| Tarjeta | Responsable | Vence |
|---|---|---|
| `[EXT] Asignar los 7 responsables del proyecto con nombre propio` | DP | 31/07 |
| `[EXT] Designar decisor único con autoridad para responder en 24 h` | DP | 31/07 |
| `[EXT] Aprobar ADR-005 (escaneo invertido), ADR-006 (offline), ADR-009 (cohortes)` | DP | 03/08 |
| `[EXT] RESOLVER: la regla de calificación 50+50+5 suma 105% (ADR-007)` | CA | 07/08 |
| `[EXT] Entregar catálogo de los 13 módulos con nombre, orden y duración` | CA | 07/08 |
| `[EXT] Digitalizar ~52 Guías de Aprendizaje — DEPENDENCIA #1` | CA | **14/08** |
| `[EXT] Política de privacidad, términos de uso y formato de consentimiento` | LEG | 14/08 |
| `[EXT] Designar dispositivo escáner por aula y quién lo opera` | ADM | 15/08 |
| `[EXT] Entregar datos de profesores y de la cohorte piloto` | ADM | 10/08 |
| `[EXT] Entregar matrícula completa para migración a producción` | ADM | 02/09 |
| `[EXT] Fijar fecha de corte de publicación de contenido en Classroom` | DP | 20/08 |

> Estas once tarjetas son el **verdadero camino crítico del proyecto**. Ninguna la puede
> resolver el equipo técnico. Si la lista no se vacía, la fecha del 5 de septiembre se mueve —
> por más rápido que se escriba el código.

---

### `[S0]` Sprint 0 — Fundaciones · vence 02/08

1. `[S0] Crear repositorio Git con la estructura acordada` — `INFRA/CI` · T1
2. `[S0] Crear proyectos Supabase zr-dev y zr-prod separados` — `INFRA/CI` · T1
3. `[S0] Conectar Vercel: main a producción, ramas a vista previa` — `INFRA/CI` · T1
4. `[S0] Registrar dominio y verificar HTTPS (requisito de cámara y PWA)` — `INFRA/CI` · T1
5. `[S0] Migraciones 001-004: extensiones, identidad, estructura académica, inscripciones` — `BACKEND` · T1+IA
6. `[S0] Migraciones 005-008: asistencia, exámenes, contenido, configuración y auditoría` — `BACKEND` · T1+IA
7. `[S0] Migración 009: TODAS las políticas de RLS de la matriz` — `SEGURIDAD/RLS` `BLOQUEANTE` · T1+IA
8. `[S0] Migración 010-011: consentimientos parentales y semilla de system_config` — `BACKEND` `LEGAL/LOPNNA` · T1
9. `[S0] Pruebas de acceso cruzado: estudiante A no lee datos de estudiante B` — `SEGURIDAD/RLS` `QA/PRUEBA` `BLOQUEANTE` · T1+IA
10. `[S0] Generar conjunto completo de datos ficticios` — `DATOS` · IA
11. `[S0] Verificar que las migraciones reconstruyen la base desde cero dos veces` — `QA/PRUEBA` · T1
12. `[S0] GitHub Actions: tipos, linter, pruebas; RLS bloquea el despliegue` — `INFRA/CI` · T1
13. `[S0] Activar respaldos diarios y EJECUTAR una restauración de prueba` — `INFRA/CI` `BLOQUEANTE` · T1
14. `[S0] Documentar operación: cómo restaurar, cuánto se pierde, cuánto tarda` — `INFRA/CI` · T1
15. `[S0] SÁBADO 01/08 — Medir línea base: minutos de pase de lista y calificación` — `QA/PRUEBA` `EXTERNO` · T1+T2+DP
16. `[S0] SÁBADO 01/08 — Probar señal en cada taller; definir dónde se aplican exámenes` — `QA/PRUEBA` · T1
17. `[S0] SÁBADO 01/08 — Censar cohortes reales: grupos, módulo, profesor, espacio` — `DATOS` `BLOQUEANTE` · DP
18. `[S0] SÁBADO 01/08 — Fotografiar guías de 2 módulos completos` — `DATOS` · T2
19. `[S0] SÁBADO 01/08 — Inventariar teléfonos escáner y probar la cámara en cada uno` — `QA/PRUEBA` · T2
20. `[S0] SÁBADO 01/08 — Entrevistar a un profesor y a una persona de administración` — `EXTERNO` · DP

---

### `[S1]` Sprint 1 — Identidad, consentimiento y carnet · vence 09/08

21. `[S1] Registro e inicio de sesión con cédula (correo sintético interno)` — `FRONTEND` `BACKEND` · T2+IA
22. `[S1] Correo de contacto obligatorio; para menores, el del representante` — `FRONTEND` `LEGAL/LOPNNA` · T2
23. `[S1] Recuperación de contraseña por correo de contacto` — `BACKEND` · T2
24. `[S1] Bifurcación por edad en el registro` — `FRONTEND` `LEGAL/LOPNNA` · T2+IA
25. `[S1] Captura de consentimiento parental con carga de documento firmado` — `FRONTEND` `LEGAL/LOPNNA` `BLOQUEANTE` · T2+T1
26. `[S1] Bloqueo por consentimiento faltante (disparador + RLS + prueba)` — `SEGURIDAD/RLS` `LEGAL/LOPNNA` `BLOQUEANTE` · T1
27. `[S1] Aprovisionamiento del secreto QR vía Edge Function` — `BACKEND` `SEGURIDAD/RLS` · T1
28. `[S1] Carnet digital con QR rotatorio de 30 s, funcional sin conexión` — `FRONTEND` · T2
29. `[S1] Esqueleto PWA: manifiesto, service worker, íconos, instalable` — `FRONTEND` `INFRA/CI` · T2
30. `[S1] Panel admin: alta individual y carga masiva de estudiantes por CSV` — `FRONTEND` · T2
31. `[S1] Panel admin: cola de verificación de consentimientos físicos` — `FRONTEND` `LEGAL/LOPNNA` · T2
32. `[S1] SÁBADO 08/08 — Registrar 5 estudiantes reales, 2 de ellos menores` — `QA/PRUEBA` · T1+T2

---

### `[S2]` Sprint 2 — Asistencia y operación del sábado · vence 16/08

33. `[S2] Gestión de sesiones: crear, abrir, cerrar, reprogramar` — `FRONTEND` `BACKEND` · T2
34. `[S2] Vista de escáner del profesor con cámara y retroalimentación grande` — `FRONTEND` `BLOQUEANTE` · T2+IA
35. `[S2] Edge Function de validación del código (ventana, sesión, cohorte, duplicado)` — `BACKEND` `SEGURIDAD/RLS` `BLOQUEANTE` · T1+IA
36. `[S2] Cola sin conexión con IndexedDB y sincronización idempotente` — `FRONTEND` `BLOQUEANTE` · T2+IA
37. `[S2] Respaldo manual por cédula, con motivo obligatorio y auditoría` — `FRONTEND` · T2
38. `[S2] Marcado de entrega de refrigerio sobre el mismo escaneo` — `BACKEND` · T2
39. `[S2] Vista de asistencia del estudiante` — `FRONTEND` · T2
40. `[S2] Reportes de asistencia exportables a CSV` — `FRONTEND` · T2
41. `[S2] Panel admin: gestión de cohortes, profesores y avance de módulo` — `FRONTEND` · T2
42. `[S2] Prueba de carga: 100 escaneos en 10 minutos` — `QA/PRUEBA` · T1
43. `[S2] SÁBADO 15/08 — Piloto de asistencia en una cohorte real, sin papel` — `QA/PRUEBA` `BLOQUEANTE` · Todos

---

### `[S3]` Sprint 3 — Evaluaciones · vence 23/08

44. `[S3] Constructor de exámenes con los tres tipos de pregunta` — `FRONTEND` · T2
45. `[S3] Banco de preguntas reutilizable entre exámenes` — `FRONTEND` `BACKEND` · T2
46. `[S3] Publicar examen: oculto a habilitado, con notificación` — `BACKEND` · T1
47. `[S3] Presentación del examen mobile-first con guardado automático` — `FRONTEND` · T2
48. `[S3] Blindar correct_answer: vista sin la columna + RLS + prueba` — `SEGURIDAD/RLS` `BLOQUEANTE` · T1
49. `[S3] Edge Function grade-attempt: autocalificación de OM y V/F` — `BACKEND` · T1+IA
50. `[S3] Cola de calificación de redacciones con rúbrica visible` — `FRONTEND` · T2
51. `[S3] Cierre automático del intento y notificación de nota` — `BACKEND` · T1
52. `[S3] Registro de notas del módulo con calc_final_score en servidor` — `BACKEND` `FRONTEND` · T2+T1
53. `[S3] Vista de notas del estudiante con umbral de aprobación visible` — `FRONTEND` · T2
54. `[S3] Auditoría de todo cambio de nota en audit_log` — `BACKEND` `SEGURIDAD/RLS` · T1
55. `[S3] SÁBADO 22/08 — Examen digital real en una cohorte` — `QA/PRUEBA` · Todos

---

### `[S4]` Sprint 4 — Contenido, feedback y visibilidad · vence 30/08

56. `[S4] Carga de contenido a bucket privado, organizada por módulo y semana` — `FRONTEND` `BACKEND` · T2
57. `[S4] Repositorio del estudiante con visor de PDF y zoom` — `FRONTEND` · T2
58. `[S4] Registro de visualizaciones de contenido` — `BACKEND` · T1
59. `[S4] Feedback micro: 3 preguntas, menos de 20 segundos` — `FRONTEND` · T2
60. `[S4] Agregado de feedback para el profesor (nunca individual, mínimo 3 respuestas)` — `BACKEND` `SEGURIDAD/RLS` · T1
61. `[S4] Notificaciones Web Push — catálogo cerrado de 4 tipos` — `BACKEND` `FRONTEND` · T1+T2
62. `[S4] Reportes de administración exportables a CSV` — `FRONTEND` · T2
63. `[S4] Panel de configuración de system_config con historial` — `FRONTEND` · T2
64. `[S4] Revisión de accesibilidad de taller: botones grandes, una mano, alto contraste` — `FRONTEND` `QA/PRUEBA` · T2
65. `[S4] SÁBADO 29/08 — Ensayo general: sábado completo sin papel ni soporte técnico` — `QA/PRUEBA` `BLOQUEANTE` · Todos

---

### `[S5]` Sprint 5 — Endurecimiento y entrega · vence 05/09

66. `[S5] LUN 31/08 — Congelamiento de funciones y aplicación de la línea de corte` — `BLOQUEANTE` · DP+T1
67. `[S5] Auditoría de seguridad: matriz de RLS tabla por tabla contra el código` — `SEGURIDAD/RLS` `BLOQUEANTE` · T1
68. `[S5] Intento real de acceso a datos ajenos con token de estudiante` — `SEGURIDAD/RLS` `QA/PRUEBA` `BLOQUEANTE` · T1
69. `[S5] Prueba de carga con 100 usuarios concurrentes` — `QA/PRUEBA` · T1
70. `[S5] Segunda restauración de respaldo, cronometrada` — `INFRA/CI` `BLOQUEANTE` · T1
71. `[S5] Migrar datos reales a producción: matrícula, profesores, cohortes, guías` — `DATOS` `BLOQUEANTE` · ADM+T1
72. `[S5] Capacitación de profesores: 90 min con sus propios teléfonos` — `EXTERNO` · T2+DP
73. `[S5] Capacitación de administración: 90 min` — `EXTERNO` · T2+DP
74. `[S5] Guía rápida de 1 página por rol, impresa` — `EXTERNO` · T2
75. `[S5] JUE 03/09 — Despliegue a producción (nunca en viernes)` — `INFRA/CI` `BLOQUEANTE` · T1
76. `[S5] JUE 03/09 — Verificación en producción: registro, escaneo y examen reales` — `QA/PRUEBA` `BLOQUEANTE` · T1+T2
77. `[S5] Plan de contingencia impreso para el sábado` — `QA/PRUEBA` · T1
78. `[S5] Activar canal de soporte con responsable de guardia el sábado` — `EXTERNO` · DP
79. `[S5] SÁB 05/09 — ENTREGA: operación en producción con toda la matrícula` — `BLOQUEANTE` · Todos
80. `[S5] DOM 06/09 — Retrospectiva y medición contra la línea base del 01/08` — `QA/PRUEBA` · Todos

---

## 3. CÓMO IMPORTAR EL CSV

**Opción A — Importación nativa de Trello (requiere plan Premium o superior):**
Tablero → menú `⋯` → *Más* → *Importar* → subir `trello_import.csv` y mapear las columnas
`Name`, `Description`, `List`, `Labels`, `Due Date`, `Members`.

**Opción B — Sin plan de pago (funciona siempre):**
Abre `trello_import.csv` en una hoja de cálculo, copia la columna `Name` de un sprint completo,
y **pégala dentro del campo de una tarjeta nueva en Trello**. Trello detecta los saltos de
línea y ofrece *"¿Crear N tarjetas?"*. Luego se añaden etiquetas y fechas por lote con la vista
de tablero.

**Opción C — Automatizado:** si más adelante quieres que yo cree y mantenga el tablero
directamente, se puede conectar la API de Trello. Hoy no está conectada en esta sesión.

---

## 4. TRES MÉTRICAS PARA MIRAR EL TABLERO

No hace falta un informe semanal. Con estas tres se sabe si el proyecto va bien:

1. **Tarjetas en `Bloqueado por terceros` con más de 48 horas.** Debe ser **cero**. Es el
   indicador más predictivo de retraso en este proyecto, porque el camino crítico está fuera
   del equipo técnico.
2. **Tarjetas en `Probado en sábado real` al cierre de cada sprint.** Si un sprint termina sin
   nada aquí, ese sprint no produjo valor verificable, aunque haya código.
3. **Tarjetas en `Fase 1.5 / Fase 2`.** Si crece rápido, el congelamiento de alcance está
   funcionando. Si está vacía en la semana 3, es señal de que las ideas nuevas se están
   colando al sprint en curso.
