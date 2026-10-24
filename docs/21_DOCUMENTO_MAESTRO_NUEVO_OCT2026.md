# 21 · Documento maestro — reconstruido desde producción (24 de octubre de 2026)

> **Qué es esto.** El `CLAUDE.md`/`AGENTS.md` actual quedó desactualizado: desde que
> se escribió, el equipo cambió de metodología, agregó roles, construyó un sistema
> de Notas que no existía, y pasó por una fase de "todo se trabaja directo sobre
> producción" a un modelo con `staging` aparte. Este documento se construyó **leyendo
> producción de verdad** (`zr-prod`, proyecto `hagbqhnittynxebdssua`) — tablas, roles
> reales, funciones desplegadas, configuración de negocio — no copiando el documento
> viejo. Es el borrador para que Pedro lo valide, lo corrija o lo mande de vuelta.
>
> No reemplaza a `CLAUDE.md` todavía. Ver `docs/22_COMPARATIVO_...md` para qué
> cambió exactamente respecto al documento anterior, y por qué.

---

## 1. Qué es ZR App, en una frase

Una PWA para la academia técnica ZR Mecademy (Venezuela, clases los sábados) que ya
pasó de "registro + asistencia + exámenes" a una plataforma completa de gestión
académica, de ventas y de un negocio interno (ZR Coffee) — con siete roles reales,
no cuatro.

---

## 2. Lo que de verdad hay en producción (24 oct. 2026)

Confirmado contra `zr-prod` directamente (no contra código ni documentos viejos):
**131 migraciones aplicadas**, la más reciente `173_tutorial_por_pasos_todos_los_roles`.

### 2.1 · Roles — ya no son cuatro, son siete, y una persona puede tener más de uno

`profiles.role` sigue existiendo (el rol "principal"), pero desde hace un tiempo hay
además `profile_roles` (`profile_id`, `role`), una tabla **muchos-a-muchos**: una
misma persona puede tener, por ejemplo, `profesor` en `profiles.role` Y `vendedor`
en `profile_roles` al mismo tiempo. Por eso existe la pantalla `/elegir-rol`.

Roles reales que existen hoy (conteo de perfiles en producción):

| Rol | Qué hace | Perfiles con ese rol hoy |
|---|---|---|
| `estudiante` | Carnet, asistencia, exámenes, material, notas, dudas | 20 |
| `profesor` | Asistencia, material, notas, dudas | 2 |
| `admin` | Gestión operativa | 2 |
| `direccion_academica` | Todo lo de admin + notas de cualquier programa | 2 |
| `super_admin` | Todo + `system_config` | 3 |
| `vendedor` | Inscribe estudiantes, ve sus inscripciones y los programas | 1 (vía `profile_roles`) |
| `zr_coffee` | Inventario y ventas de la cantina | 1 (vía `profile_roles`) |

**Regla que sigue intacta:** el rol nunca viene del cliente. Lo asigna un
administrador desde el servidor (`profile_roles` y `profiles.role` se escriben con
RLS que exige `is_admin_up()`).

### 2.2 · El sistema de Notas real — NO es el motor de exámenes digitales

Esta es la divergencia más grande respecto al documento viejo, y la razón por la
que vale la pena leer esta sección con cuidado antes de tocar nada de evaluaciones.

El documento anterior (§1, punto 6) describe "exámenes digitales con
autocalificación" como SI fuera el mecanismo de evaluación de la academia. Existe
de verdad — las tablas `exams`/`exam_questions`/`exam_attempts`/`exam_answers`
están en producción, con RLS, con autocalificación de opción múltiple/verdadero-
falso, con la vista `v_exam_questions_student` que oculta la respuesta correcta — y
las Edge Functions `submit-attempt` y `grade-answer` están desplegadas y con
versiones (v7 y v5 respectivamente, señal de que se usaron en algún momento).

**Pero en producción, esas cuatro tablas tienen CERO filas.** El mecanismo que de
verdad usa la academia para calificar es otro, construido después
(`147_notas_en_produccion.sql`, octubre 2026):

- `manual_exam_definitions` — el profesor define una evaluación (nombre, módulo,
  peso, nota máxima) **sin preguntas digitales**; es una evaluación que pasó en el
  taller, en papel, o de cualquier forma que no sea un examen autocalificado en la
  app.
- `manual_exam_scores` — la nota que el profesor le pone a cada estudiante para esa
  evaluación.
- `module_enrollments` ganó columnas: `class_participation_score`,
  `puntualidad_manual`, `puntualidad_sabados`, `evaluated_pct` — la nota final del
  módulo se arma combinando evaluaciones + participación + puntualidad, con pesos
  configurables (`module.participation_weight_min/max`,
  `module.passing_threshold_default`, `module.passing_threshold_first` — la del
  primer módulo del programa es distinta a propósito, regla de arranque).

**Qué significa esto para quien construya sobre esto:** el motor de exámenes
digitales (`exams`...) no está "roto" ni "sin terminar" — está **construido y
funcional pero no es lo que la academia usa hoy para calificar**. Si se retoma
(por ejemplo, para un módulo de aula virtual con quizzes autocalificados), es una
pieza **aparte** del sistema de Notas real, no un reemplazo de él. No asumir que
"ya hay exámenes" significa "ya hay notas" — son dos sistemas distintos.

### 2.3 · Finanzas y ZR Coffee — confirmados como excepciones reales, ya en producción

Coinciden con lo que ya decía el documento anterior, confirmado contra producción:
`(admin)/finanzas` existe, `zr_coffee_products`/`zr_coffee_sales`/
`zr_coffee_tasa_cambio` existen con datos reales, `finanzas.whatsapp_administracion`
y `zr_coffee.margen_ganancia_pct` están en `system_config`. **Sin cambios respecto
al documento anterior en este punto** — las dos excepciones siguen siendo
exactamente eso, excepciones confirmadas, no una apertura general a Fase 2.

### 2.4 · Pantallas reales que existen y no estaban en la lista original de Fase 1

Contra el documento anterior (§1, los 11 puntos de Fase 1), lo que hay en
producción hoy e incluye bastante más:

- **Reportes y métricas de administración**: `/reportes`, `/estudiantes/estadisticas`,
  `/metricas-material`, `/cobertura-modulos`, `/feedback-modulos`,
  `/examenes-academicos` (Dirección Académica supervisa evaluaciones de cualquier
  programa).
- **Catálogo**: `/catalogo` (administración).
- **Casos con IA**: `/caso` (estudiante), `/casos-docente` (profesor) — generación
  automática de casos de diagnóstico, por cron, ligados a módulo × semana. Esto
  **no estaba en la lista de 11 puntos de Fase 1** del documento anterior, pero
  lleva meses en producción (35 casos generados, Edge Function `generar-casos`
  desplegada). Es una divergencia real entre lo que el documento decía que se iba
  a construir y lo que de verdad se construyó.
- **Mapa de dominio**: `/dominio/[cohortId]` (profesor) — sí estaba previsto
  (Fase 1, punto 11 del documento anterior, "Mi progreso"), confirmado construido.
- **Rehabilitación de exámenes**: `/rehabilitaciones` (profesor),
  `request-rehabilitation`/`approve-rehabilitation`/`respond-rehabilitation`
  desplegadas — un estudiante que abandona un intento de examen puede pedir que lo
  rehabiliten.
- **Contenido organizado en carpetas**: `content_folders` existe — el punto C-1 del
  documento de brechas de septiembre ("carpetas jerárquicas en el Classroom") **ya
  se resolvió**, no sigue pendiente.
- **Términos y condiciones**: `terms_acceptances` + `system_config['terms.version'
  /'terms.text']` existen — el punto B-1 del documento de brechas **ya se
  resolvió**.
- **Estados de asistencia tarde/justificado**: `attendance_justifications` existe,
  `attendance.tarde_umbral_minutos` está configurado — el punto B-3 **ya se
  resolvió**.
- **`elegir-rol`** y **`descargar`** (instalar la PWA) — pantallas nuevas que
  acompañan el modelo multi-rol y la instalación.

### 2.5 · Lo que sigue exactamente igual que el documento anterior

- El stack (Next.js 15 + Tailwind + Supabase + Edge Functions Deno + Vercel) — sin
  cambios, confirmado.
- Las diez reglas absolutas (§2 del documento anterior: RLS en todo, nada de notas
  calculadas en el navegador, nunca `exam_questions.correct_answer` al estudiante,
  nunca `service_role` en el navegador, nada de números de negocio en el código,
  nunca editar una migración aplicada, sin reprobación automática por inasistencia,
  sin bloqueo de acceso físico, el rol nunca viene del cliente, nada de Fase 2/3) —
  **todas siguen vigentes y confirmadas contra el código real**. No hay evidencia de
  que ninguna se haya violado en producción.
- La prohibición de pagos/cuotas fuera de la excepción de Finanzas, de
  video-microlearning con puntos/insignias, de red social, de mensajería privada —
  nada de eso existe en producción. Siguen siendo límites reales, no solo texto.
- El concepto de cohorte → módulo → sesión, y que la asistencia se registra contra
  una sesión — confirmado en el modelo de datos real, sin cambios.
- El profesor escanea al estudiante (nunca al revés) — confirmado, `validate-scan`
  sigue siendo la única función que valida un QR, y lo hace solo para quien tiene
  rol de personal.

---

## 3. En qué fase estamos, según lo que de verdad hay construido

El documento anterior organiza el trabajo en 11 puntos de "Fase 1" y prohíbe
explícitamente pagos/cuotas salvo la excepción de Finanzas. Mirando producción:

- **Todo lo operativo del día a día de Fase 1 está construido y en uso real**:
  registro, consentimiento LOPNNA, carnet con QR, asistencia, refrigerio, exámenes
  (vía el sistema de Notas real, no el motor digital), material, feedback, paneles
  de profesor/admin, mapa de dominio. El documento anterior ya daba esto por hecho
  y la realidad lo confirma.
- **Finanzas (cuotas/solvencia) ya está en producción**, como excepción confirmada
  — es decir, la academia **ya cruzó**, a propósito y con aprobación explícita, la
  línea que el documento original ponía como "Fase 2, prohibido". Eso no significa
  que el resto de Fase 2 esté abierto — Finanzas es la única puerta que se abrió,
  y quedó documentada como tal.
- **Lo que NO hay evidencia de que exista**: nada de puntos/insignias/rachas, nada
  de red social, nada de simulador visual, nada de Google Classroom, nada de app
  nativa, nada de mensajería privada entre usuarios. Las prohibiciones de Fase 2/3
  siguen siendo reales, no solo texto.

**Conclusión:** no estamos "en Fase 1 todavía" de forma pura — estamos en una
**Fase 1 extendida**, que ya incorporó dos piezas que el documento original
clasificaba como Fase 2 (Finanzas, ZR Coffee) por decisión explícita del
coordinador, y que construyó varias piezas operativas (reportes, casos con IA,
rehabilitaciones) que el documento original no anticipaba en su lista de 11 puntos
pero que no violan ninguna de las diez reglas absolutas ni las prohibiciones
explícitas. No hay evidencia de que se haya empezado "financiamiento" como fase
nueva más allá de lo que Finanzas ya cubre (cuotas y solvencia) — no hay
inversiones, préstamos, ni nada más amplio que eso.

---

## 4. Qué falta por construir, heredado del documento anterior — SIN tocar

Lo que sigue en `docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md` como pendiente y **no
tiene evidencia de haberse construido** en producción se mantiene tal cual estaba,
porque no se haya hecho no significa que haya que improvisarlo ahora:

- **2FA para cuentas de administrador** (C-4) — sigue sin existir.
- **Marca de agua con `student_code`** sobre PDFs del Classroom (C-4) — sin
  evidencia en el código revisado.
- **Límite de descargas por cuenta** (C-4) — sin evidencia.
- **Integración con Odoo** (D-1) — cero líneas de código, igual que antes.
  Explícitamente fuera de alcance hasta que haya credenciales.
- **Generación de casos de IA desde el material subido, con aprobación del
  profesor** (C-3 del documento de brechas) — lo que hay sigue generando por
  módulo × semana sin material fuente ni revisión previa, igual que en septiembre.

Estas NO se agregan como "nuevas funciones a construir ya" solo porque este
documento se está actualizando — siguen bloqueadas por las mismas preguntas
abiertas de producto que ya estaban identificadas (quién aprueba el contenido de
IA, qué tan crítico es el anti-scraping, cuándo hay credenciales de Odoo).

---

## 5. Regla nueva, pedida explícitamente en esta sesión (24 oct. 2026)

**Cada vez que se implemente un cambio, se reemplace una función, o se decida que
"esto ya no se hace así, se hace de esta otra manera", el documento maestro se
actualiza en el mismo cambio — no después, no en una sesión aparte.** Igual que ya
existe la regla del tour guiado (§12 del documento anterior: "toda función nueva
agrega su propio paso al tour, no es opcional"), esta es la misma disciplina
aplicada al documento maestro completo. Un documento maestro desactualizado es lo
que causó que hiciera falta esta sesión entera de reconstrucción — la forma de que
no se repita es que la actualización sea parte de terminar la tarea, no una tarea
aparte que se posterga.

---

## 6. Lo que este documento NO cubre todavía

Para ser honesto sobre el alcance real de esta auditoría, hecha en una sesión:

- No se revisó línea por línea cada una de las 131 migraciones — se leyeron las
  más recientes y las que describían cambios estructurales grandes (roles, notas,
  Finanzas, ZR Coffee), y se confirmaron contra las tablas y columnas reales.
- No se hizo clic en cada pantalla de producción — se confirmó su existencia por
  el listado de rutas de `main` y se cruzó contra tablas/RLS reales, no contra
  comportamiento visual.
- No se tocó la base de datos de producción en ningún momento — todo lo de este
  documento es lectura (`list_tables`, `execute_sql` de solo lectura,
  `list_edge_functions`, lectura de archivos del repo).
