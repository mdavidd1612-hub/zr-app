# SPRINT · AULA VIRTUAL
**Octubre 2026** · Objetivo: módulo de aula virtual completo del lado de servidor
(modelo de datos, RLS, lógica, pruebas). Ver `spec/07_AULA_VIRTUAL.md` para el porqué
de cada decisión. **La interfaz es de Marco** — estas tareas no crean pantallas.

> Ejecuta en orden. No empieces una fase sin haber cumplido la verificación de la
> anterior — cada fase depende de las tablas de la anterior.

---

## FASE 1 · Base (migración 174) — ✅ hecha y verificada en staging

### T-AV-001 · Modelo de unidades
**Haz:** `supabase/migrations/174_aula_virtual_unidades.sql` — tablas `units` y
`unit_items`, enums `unit_item_type`/`unit_manual_status`, función
`unit_effective_status()`, función `unit_item_is_visible()`, RLS completa.
**Verificado:**
- `unit_effective_status()` devuelve borrador/programada/abierta/cerrada correctamente
  para las 5 combinaciones de fecha/override manual (probado con SQL directo).
- RLS: un estudiante ve unidades `abierta`/`cerrada` de SU módulo, no ve `borrador`
  ni `programada`, no ve unidades de otro módulo (probado con `set role authenticated`
  + `request.jwt.claims` simulando al estudiante de prueba).
- Unidad cerrada = solo lectura (sus elementos siguen visibles), no desaparece.
- `get_advisors` (security): sin avisos nuevos sobre `units`/`unit_items`.
- `npm run typecheck`: limpio, tipos regenerados desde staging.

---

## FASE 2 · Materiales (migración 175) — siguiente

### T-AV-002 · Extender content_items
**Antes:** T-AV-001.
**Haz:** `alter table content_items add column unit_id uuid references units(id)`,
`allow_download boolean not null default true`, `duration_seconds int`,
`show_progress boolean not null default true`, `check_quiz_id uuid references exams(id)`.
`unit_id` nullable a propósito: el contenido existente (pre-aula-virtual) sigue
funcionando sin pertenecer a ninguna unidad.

### T-AV-003 · material_progress (reemplaza el rol de content_views)
**Haz:** tabla nueva `material_progress` (student_id, content_item_id, segments jsonb,
percent numeric, completed_at, validated, updated_at), RLS igual que `content_views`
(estudiante lee/escribe la suya, personal lee todas). `completado` = `percent >= cfg_int('aula.material_progress_completado_pct', 90)`.
Se guarda cada `cfg_int('aula.material_progress_guardar_cada_seg', 15)` segundos — ese
número lo aplica el cliente (Marco), aquí solo se deja la config lista.

### T-AV-004 · Firma de URLs según allow_download
**Haz:** Edge Function o ruta de servidor que firma la URL del material: si
`allow_download = false`, URL de vida corta (minutos) y sin exponer el `storage_path`
real al cliente salvo por esa URL firmada.
**Verifica:** `npm run test:rls` (estudiante A no lee el storage_path de estudiante B
ni de un material no publicado).

---

## FASE 3 · Evaluaciones (migración 176)

### T-AV-005 · Extender el motor de exámenes existente
**Haz:** `alter table exams add column unit_id uuid references units(id)`,
`kind text check (kind in ('formativo','certificacion')) not null default 'formativo'`,
`scale numeric not null default 100`, `weight numeric`,
`max_attempts int not null default cfg_int('aula.intento_max_attempts', 2)` (como
default de columna no puede leer system_config en tiempo de creación de tabla — se deja
`default 2` y se documenta que el valor de negocio real se lee de `system_config` al
VALIDAR, no al insertar), `cooldown_hours int not null default 24`,
`show_answers_after_close boolean not null default false`.

### T-AV-006 · Banco de preguntas y aleatorización
**Haz:** `exam_questions` gana `bank_group text` opcional; `exams` gana
`questions_per_attempt int` (null = todas). `exam_attempts` gana `seed int not null
default floor(random()*1000000000)`. La selección de N preguntas al azar con esa
semilla se resuelve en una función `fn_attempt_questions(p_attempt_id uuid)` — el
cliente nunca arma el banco, siempre lo pide al servidor.

### T-AV-007 · Temporizador y tope de intentos en servidor
**Haz:** `exam_attempts` gana `attempt_number int`, `expires_at timestamptz`,
`score_cap_applied numeric`. Trigger que calcula `expires_at = started_at +
exams.duration_minutes` al insertar. Función `fn_submit_expired_attempts()` (vía
`pg_cron`, cada minuto) que autoentrega los intentos vencidos con lo que había
contestado. El tope del segundo intento (`cfg_num('aula.intento_cap_2', 80)`) se
aplica en `fn_close_attempt_if_graded` (007) al calcular `total_score`.

### T-AV-008 · "Requiere intervención"
**Haz:** nuevo estado alcanzable cuando se agotan los intentos sin aprobar una
certificación; tabla `intervention_grants` (attempt extra otorgado por un profesor,
con motivo, queda en el historial). Implementa `unit_prerequisite_met()` de verdad
(placeholder de la Fase 1, migración 174).

### T-AV-009 · Pruebas
**Haz:** `tests/reglas/` — segundo intento no antes de 24h, tope 80% se aplica, el
examen se autoentrega al vencer el tiempo, dos estudiantes ven preguntas en distinto
orden con la misma semilla reproducible.

---

## FASE 4 · Seguimiento (migración 177)

### T-AV-010 · Mini-chequeo y bloqueo por contenido obligatorio
**Haz:** valida `check_quiz_id` de T-AV-002: al completar un material con chequeo
asociado, se marca `validated = true` en `material_progress` solo si el intento de
ese mini-examen aprobó. Función `fn_unit_required_complete(p_unit_id, p_student_id)`
que usan las políticas de `exam_attempts` para bloquear presentar la certificación de
una unidad si quedan materiales `required = true` sin completar.

---

## FASE 5 · Tareas (migración 178)

### T-AV-011 · assignments y submissions
**Haz:** `assignments` (unit_id, due_at, max_mb default `cfg_int('aula.tarea_max_mb', 10)`),
`submissions` (assignment_id, student_id, file_path, version, submitted_at, grade,
feedback, estado pendiente/entregada/tardía/calificada). Bucket privado
`tareas` (storage), URLs firmadas. **Aquí se agrega la FK pendiente:**
`alter table unit_items add constraint fk_unit_items_assignment foreign key
(assignment_id) references assignments(id) on delete cascade;` (dejada pendiente a
propósito en la migración 174).
**Haz también:** validar el tipo real del archivo (no solo la extensión) al subir.

---

## FASE 6 · Calendario (migración 179)

### T-AV-012 · calendar_events generado por triggers
**Haz:** tabla `calendar_events` + triggers en `units`, `exams`, `assignments` que
insertan/actualizan su evento correspondiente solo (nunca se carga a mano). Función
de exportación iCal (`fn_calendar_ical(p_student_id)` o Edge Function).

---

## FASE 7 · Métricas y Dudas (migración 180)

### T-AV-013 · activity_log
**Haz:** tabla append-only (mismo patrón que `audit_log`, migración 002) alimentada
por triggers en las acciones de la sección 11.1 del documento original.

### T-AV-014 · Dudas por unidad/material
**Haz:** extender `doubts` (migración 034) con `unit_id`/`content_item_id`/
`exam_id`/`assignment_id` nullable (incógnita de cuál referencia, mismo patrón de
`unit_items`), estados abierta/respondida/resuelta.

### T-AV-015 · Vistas de métricas por rol
**Haz:** `v_aula_metrics_estudiante`, `v_aula_metrics_profesor`,
`v_aula_metrics_direccion` — agregados, nunca filas individuales de otro estudiante
salvo para personal autorizado (mismo patrón que `v_feedback_session_summary`, 008).

---

## FASE 8 · Mejoras — fuera de alcance de estas tareas

Proveedor de video, marca quemada, PWA push, importación masiva: decisiones de
infraestructura/presupuesto, no migraciones. Se retoman cuando haya una decisión de
proveedor (spec/07_AULA_VIRTUAL.md §5, Fase 8).
