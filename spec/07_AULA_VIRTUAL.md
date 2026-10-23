# 07 · AULA VIRTUAL (módulo e-learning)

> Fuente original: `ZR_App_Modulo_E-Learning.md` (Pedro/Marco, oct. 2026). Este archivo
> la adapta al esquema y a las convenciones ya existentes en `supabase/migrations/` —
> cuando los dos se contradicen, gana este archivo (regla de jerarquía de AGENTS.md §5).
>
> **Alcance de Claude Code en este módulo:** modelo de datos, RLS, lógica de servidor
> (Edge Functions / RPCs) y pruebas automatizadas. Las pantallas, estilos y pruebas
> funcionales de interfaz son de Marco — este documento no describe UI.

---

## 1. Decisión de arquitectura: reusar, no duplicar

Antes de escribir una sola tabla nueva, se revisó qué ya existe (regla de AGENTS.md:
"no inventes nada"). El esquema actual ya tiene dos piezas que el documento original
pedía reconstruir desde cero:

| Lo que pide el documento | Ya existe como | Decisión |
|---|---|---|
| `materials`, reproducción, descarga, marca de agua | `content_items` (008) — PDF/presentación/imagen/enlace/documento, `storage_path`, `is_published`, `visible_from` | **Se extiende** `content_items`, no se crea `materials` |
| Seguimiento de visualización | `content_views` (008) — hoy solo `viewed_at` | **Se reemplaza su función** por una tabla nueva, más rica (`material_progress`), porque el formato de segmentos/porcentaje no cabe en una sola marca de tiempo |
| `quizzes`, `questions`, `quiz_attempts`, `attempt_answers` | `exams`, `exam_questions`, `exam_attempts`, `exam_answers` (007) — ya autocalifica, ya cierra el intento solo, ya oculta `correct_answer` con `v_exam_questions_student` | **Se extiende** el motor de exámenes existente, no se crea un motor paralelo |

Esto evita tener dos sistemas de evaluación y dos repositorios de contenido viviendo
en paralelo — exactamente el tipo de duplicación que confunde en seis meses cuál es
la fuente de verdad.

## 2. Modelo de contenido

`Programa → Módulo → Unidad → Elementos`, igual que el documento original. Una
**unidad** (`units`) vive dentro de un módulo existente (`modules`, migración 004).
Sus elementos (`unit_items`) son materiales (`content_items`), exámenes (`exams`),
tareas (`assignments`, nueva) o un marcador de "Dudas de la unidad" — en ese orden,
arrastrables (`order_index`).

`unit_items` no usa una sola columna de referencia polimórfica (rompería las llaves
foráneas): tiene tres columnas nullable (`content_item_id`, `exam_id`,
`assignment_id`) con una restricción que exige que exactamente una coincida con
`type`, salvo `type = 'dudas'`, que no referencia nada.

## 3. Apertura, cierre y visibilidad

Tal como pide el documento (§4.2): **no hay cron que cambie estados**. El estado se
calcula al consultar, comparando `open_at`/`close_at` con `now()`, con
`public.unit_effective_status()`:

```
manual = 'cerrada'        → cerrada
manual = 'abierta'        → abierta
open_at es null           → borrador
now() < open_at           → programada
close_at pasado           → cerrada
si no                     → abierta
```

`pg_cron` solo se usa para efectos secundarios (recordatorios, expirar intentos de
examen vencidos) — igual que ya se usa hoy para los casos de IA (042) y el
recordatorio de notas (168/170).

## 4. Números de negocio → `system_config`

Regla absoluta de AGENTS.md §2.5: ningún umbral se escribe en el código. Claves
nuevas en `system_config` (se agregan en la migración que las necesita, no todas de
una vez):

| Clave | Valor por defecto | De dónde sale |
|---|---|---|
| `aula.intento_max_attempts` | 2 | §7.4 |
| `aula.intento_cooldown_hours` | 24 | §7.4 |
| `aula.intento_cap_1` / `aula.intento_cap_2` | 100 / 80 | §7.4 |
| `aula.nota_minima_certificacion` | 60 | §16.5 |
| `aula.material_completado_pct` | 90 | §6.1 |
| `aula.tarea_max_mb` | 10 | §8 |
| `aula.material_progress_guardar_cada_seg` | 15 | §6.1 |

## 5. Fases (coinciden con la tabla §14 del documento original)

| Fase | Qué entrega | Migración(es) | Estado |
|---|---|---|---|
| 1. Base | `units`, `unit_items`, estado automático/manual, RLS | 174 | ✅ este sprint |
| 2. Materiales | `content_items` extendido, `material_progress`, firma de URLs | 175 | ✅ este sprint |
| 3. Evaluaciones | `exams`/`exam_attempts` extendidos: unidad, banco de preguntas, semilla, intentos con tope, temporizador en servidor, "Requiere intervención" | 176 | pendiente |
| 4. Seguimiento | Mini-chequeo por material (reusa exams), bloqueo del quiz por contenido obligatorio | 177 | pendiente |
| 5. Tareas | `assignments`, `assignment_submissions`, bucket privado | 178 | pendiente |
| 6. Calendario | `calendar_events` generado por triggers, función de exportación iCal | 179 | pendiente |
| 7. Métricas y Dudas | `activity_log`, extender `doubts` con unidad/material, vistas por rol | 180 | pendiente |
| 8. Mejoras | Proveedor de video, marca quemada, push — infraestructura externa, no es una migración | — | fuera de alcance por ahora |

## 6. Decisiones heredadas tal cual del documento original

Todo lo de la sección 15 del documento ("Decisiones y correcciones lógicas") se
adopta sin cambios: evaluar fechas al consultar en vez de cron, reproductor propio
con proveedor intercambiable, segmentos vistos + 90% en vez de "llegó al final",
progreso visible por defecto, "Requiere intervención" en vez de bloqueo permanente,
banco aleatorio + opciones barajadas, marca de agua como disuasión (no como bloqueo
real), y validar tipo real de archivo en tareas (no solo la extensión).

Las respuestas por defecto de la sección 16 también se adoptan tal cual — están
pensadas exactamente para no tener que preguntar y poder avanzar.
