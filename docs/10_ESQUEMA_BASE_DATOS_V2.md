# ESQUEMA DE BASE DE DATOS V2 — ZR APP
> **Reemplaza a `04_ESQUEMA_BASE_DATOS.md` como fuente de verdad.** El documento `04_` se
> conserva como registro del diseño conceptual original; este es el esquema ejecutable.
>
> **Qué corrige:** los bloqueantes B-1 a B-6 y los defectos D-1 a D-13 de
> `08_AUDITORIA_TECNICA_Y_VIABILIDAD.md`, aplicando las decisiones de
> `09_DECISIONES_ARQUITECTONICAS.md`.
>
> **Regla de trabajo:** las migraciones reales viven versionadas en `supabase/migrations/`.
> Este documento es el diseño; la migración es la implementación. Si divergen, manda la
> migración y este documento se actualiza — nunca al revés.

---

## 0. CONVENCIONES

- Toda tabla lleva `id uuid primary key default gen_random_uuid()` salvo las de extensión de
  perfil, cuya clave primaria es también foránea a `profiles.id`.
- Toda tabla lleva `created_at timestamptz not null default now()`.
- Las tablas mutables llevan además `updated_at timestamptz` mantenido por disparador.
- Nombres de tabla en plural e inglés (consistente con `04_`); valores de enumeración en
  español (consistente con las reglas de negocio y con lo que ve el usuario).
- `[F2]` marca lo que pertenece a Fase 2 y **no se construye ahora**. Se documenta aquí para
  que el diseño de Fase 1 no cierre puertas.
- Toda tabla nace con RLS habilitada. Ver §7.

---

## 1. IDENTIDAD Y ROLES
> Cierra B-1 y B-2. Aplica ADR-001.

### `profiles`
Extensión 1 a 1 de `auth.users`. Es la tabla de identidad común a los cuatro roles.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK → `auth.users.id` ON DELETE CASCADE | mismo id que el usuario de Supabase Auth |
| role | enum(`estudiante`,`profesor`,`admin`,`super_admin`) not null | replicado en `app_metadata` del JWT |
| full_name | text not null | |
| cedula | text unique not null | identificador de acceso |
| contact_email | text not null | canal de recuperación; para menores, correo del representante |
| phone | text nullable | |
| avatar_url | text nullable | |
| status | enum(`activo`,`suspendido`,`egresado`,`retirado`) not null default `activo` | |
| created_at / updated_at | timestamptz | |

> **Nunca** existe una columna `password_hash`. Las credenciales viven exclusivamente en
> `auth.users`.

### `students`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK → `profiles.id` | |
| birth_date | date not null | |
| cohort_id | FK → `cohorts.id` nullable | de aquí se deriva el módulo actual (ADR-009) |
| enrollment_date | date not null | |
| onboarding_status | enum(`en_curso`,`completo`) not null default `en_curso` | |
| emergency_contact_name | text nullable | |
| emergency_contact_phone | text nullable | |
| trust_level | int nullable `[F2]` | `NULL` durante el módulo 1 |

**Corrección de D-1 — `is_minor` no es una columna.** La minoría de edad depende de la fecha
actual, así que una columna generada es imposible en Postgres (exige expresiones `IMMUTABLE`) y
además quedaría desactualizada al cumplir 18 años. Se resuelve con una función y una vista:

```sql
create or replace function public.age_years(p_birth_date date)
returns int language sql immutable as $$
  select extract(year from age(current_date, p_birth_date))::int;
$$;
-- immutable respecto a sus argumentos; se recalcula en cada consulta.

create or replace view public.v_students as
select s.*,
       p.full_name, p.cedula, p.contact_email, p.status,
       public.age_years(s.birth_date)               as age_years,
       public.age_years(s.birth_date) < 18          as is_minor
from public.students s
join public.profiles p on p.id = s.id;
```

### `teachers`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK → `profiles.id` | |
| specialties | text[] | ej. `{electricidad, transmision}` |
| is_active | boolean not null default true | |

### `admins`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK → `profiles.id` | |
| can_approve_payments | boolean not null default false `[F2]` | |
| can_issue_certificates | boolean not null default false | |

### `parental_consents`
Sin cambios de fondo respecto a `04_` §1, con dos precisiones:

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| consent_type | enum(`account_creation`,`ugc_publication`) | dos registros separados, nunca un solo checkbox |
| representative_name | text not null | |
| representative_cedula | text not null | |
| representative_email | text not null | **debe coincidir con `profiles.contact_email` del menor** (ADR-001) |
| method | enum(`fisico`,`digital`) | |
| document_url | text nullable | soporte firmado en Storage, bucket privado |
| signed_at | timestamptz not null | |
| verified_by | FK → `admins.id` nullable | quién validó el documento físico |

**Regla de bloqueo (disparador, no solo UI):** un estudiante con `age_years < 18` y sin registro
`account_creation` no puede pasar a `onboarding_status = completo`, y las políticas de RLS le
niegan lectura de contenido y exámenes.

---

## 2. ESTRUCTURA ACADÉMICA
> Cierra B-4 y B-5. Aplica ADR-009.

### `programs`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | "Técnico Automotriz" |
| total_modules | int default 13 | |
| total_duration_months | int default 13 | |

### `modules`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| program_id | FK → `programs.id` | |
| order_index | int not null | 1 a 13 · unique(program_id, order_index) |
| name | text not null | |
| duration_weeks | int not null default 4 | excepciones confirmadas: 3 y 8 |
| inces_homologado | boolean not null default false | Electricidad, Transmisión, Suspensión/Frenos, Dirección |

### `cohorts` — **nueva, cierra B-5**
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| program_id | FK → `programs.id` | |
| name | text not null | ej. "Cohorte 2026-B, sábado 8am" |
| current_module_id | FK → `modules.id` nullable | el módulo que cursa hoy |
| teacher_id | FK → `teachers.id` nullable | docente asignado al módulo en curso |
| location | text nullable | "Taller 2" |
| start_date | date | |
| status | enum(`activa`,`finalizada`,`suspendida`) not null default `activa` | |

> `students.current_module_id` de `04_` **se elimina**: se deriva de `cohorts.current_module_id`.
> Un dato derivado que se guarda a mano se desincroniza.

### `learning_guides`
Igual que `04_` §2, con dos cambios:

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_id | FK → `modules.id` | |
| week_number | int not null | |
| order_in_week | int not null default 1 | **nuevo**: una semana puede tener varias sub-competencias |
| sub_competency_name | text not null | |
| pre_practice_description | text | |
| practice_description | text | |
| digitized | boolean not null default false | |
| source_document_url | text nullable | **nuevo**: foto o escaneo de la guía física original |

### `class_sessions` — **nueva, cierra B-4**
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| cohort_id | FK → `cohorts.id` | |
| module_id | FK → `modules.id` | |
| teacher_id | FK → `teachers.id` | |
| session_date | date not null | el sábado correspondiente · unique(cohort_id, session_date) |
| week_number | int not null | |
| status | enum(`programada`,`abierta`,`cerrada`,`reprogramada`,`cancelada`) not null default `programada` | |
| opened_at / closed_at | timestamptz nullable | ventana en que se acepta asistencia |
| rescheduled_from | FK → `class_sessions.id` nullable | soporta la reprogramación que exige `00_` §3.4 |
| notes | text nullable | |

### `module_enrollments`
> Cierra D-2 y D-3. Aplica ADR-007.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| module_id | FK → `modules.id` | unique(student_id, module_id) |
| cohort_id | FK → `cohorts.id` | |
| theory_score | numeric(4,2) nullable | sobre 20 |
| practice_score | numeric(4,2) nullable | sobre 20 |
| participation_score | numeric(4,2) nullable | sobre 20 |
| participation_weight | numeric(4,3) not null default 0.05 | **check ≥ 0.05** · lo fija el profesor por inscripción |
| passing_threshold | numeric(4,2) not null | **copiado al inscribir**, no calculado: 10 si es el primer módulo del programa, 12 en el resto |
| final_score | numeric(4,2) nullable | calculado por función, no columna generada |
| status | enum(`en_curso`,`aprobado`,`reprobado`,`retirado`) not null default `en_curso` | |
| approved_at | timestamptz nullable | |

**Cálculo de la nota final (Opción A de ADR-007, sujeta a confirmación académica):**
```sql
create or replace function public.calc_final_score(
  p_theory numeric, p_practice numeric, p_participation numeric, p_weight numeric
) returns numeric language sql immutable as $$
  select round(
      p_theory       * ((1 - p_weight) / 2)
    + p_practice     * ((1 - p_weight) / 2)
    + p_participation * p_weight
  , 2);
$$;
```
Se aplica por disparador `before insert or update` sobre `module_enrollments`, dejando
`final_score` en `NULL` mientras alguno de los tres componentes lo esté.

> **Recordatorio normativo:** no existe ni debe existir un contador de faltas que reprobar
> automáticamente. La reprobación se deriva solo de `final_score < passing_threshold`.

---

## 3. ASISTENCIA Y REFRIGERIOS
> Aplica ADR-005 y ADR-006.

### `student_qr_secrets`
| Campo | Tipo | Notas |
|---|---|---|
| student_id | uuid PK, FK → `students.id` | |
| secret | text not null | base32 para TOTP · **nunca legible por el cliente tras el aprovisionamiento inicial** |
| rotated_at | timestamptz | permite invalidar en caso de pérdida del teléfono |

### `attendance_events` — corregida
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | FK → `class_sessions.id` | **antes era un `session_date` suelto** |
| student_id | FK → `students.id` | **unique(session_id, student_id)** — garantiza idempotencia de la sincronización sin conexión |
| scanned_at | timestamptz not null | momento real del escaneo, no de la sincronización |
| synced_at | timestamptz nullable | `NULL` mientras esté en cola local |
| scanned_by | FK → `profiles.id` | quién escaneó (profesor o admin) |
| method | enum(`qr`,`manual`) not null default `qr` | todo registro manual queda marcado y auditable |
| manual_reason | text nullable | obligatorio si `method = manual` |
| device_id | text nullable | identifica el dispositivo escáner |
| snack_claimed_at | timestamptz nullable | refrigerio entregado — mismo evento, sin tabla aparte |
| snack_claimed_by | FK → `profiles.id` nullable | |

**Inmutable:** `REVOKE UPDATE, DELETE`. Excepción controlada: `snack_claimed_at` y
`snack_claimed_by` se escriben una única vez mediante una función de servidor que rechaza el
segundo intento.

---

## 4. EVALUACIONES
> Cierra B-6.

### `exams` — corregida
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_id | FK → `modules.id` | |
| cohort_id | FK → `cohorts.id` nullable | permite un examen por sección |
| teacher_id | FK → `teachers.id` | |
| title | text not null | |
| status | enum(`oculto`,`habilitado`,`cerrado`,`calificado`) not null default `oculto` | *(los estados `en_progreso` y `entregado` pertenecen al intento, no al examen)* |
| max_score | numeric(4,2) not null default 20 | |
| passing_score | numeric(4,2) not null default 10 | |
| opens_at / closes_at | timestamptz nullable | |
| duration_minutes | int nullable | `NULL` = sin límite |
| published_by | FK → `teachers.id` nullable | |
| published_at | timestamptz nullable | dispara la notificación |

> **El campo `type` desaparece del examen.** El tipo pertenece a cada pregunta: un examen real
> mezcla opción múltiple, verdadero/falso y redacción.

### `exam_questions` — **nueva, cierra B-6**
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| exam_id | FK → `exams.id` ON DELETE CASCADE | |
| order_index | int not null | |
| type | enum(`opcion_multiple`,`verdadero_falso`,`redaccion_abierta`) not null | |
| statement | text not null | |
| options | jsonb nullable | `[{"key":"a","text":"..."}]` para opción múltiple |
| correct_answer | jsonb nullable | `NULL` en redacción abierta |
| points | numeric(4,2) not null | la suma por examen debe igualar `max_score` (validado por disparador) |
| rubric | text nullable | guía de corrección para redacción abierta |
| learning_guide_id | FK → `learning_guides.id` nullable | liga la pregunta a la sub-competencia; alimenta el mapa de dominio en Fase 2 |

> `correct_answer` **nunca** se envía al cliente estudiante. Las políticas de RLS lo impiden y
> la consulta del estudiante usa una vista que excluye esa columna.

### `exam_attempts`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| exam_id | FK → `exams.id` | unique(exam_id, student_id) |
| student_id | FK → `students.id` | |
| status | enum(`en_progreso`,`entregado`,`calificado`) not null default `en_progreso` | |
| started_at / submitted_at | timestamptz | |
| total_score | numeric(4,2) nullable | suma de `exam_answers.awarded_points` |
| graded_at | timestamptz nullable | |

### `exam_answers` — **nueva**
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| attempt_id | FK → `exam_attempts.id` ON DELETE CASCADE | |
| question_id | FK → `exam_questions.id` | unique(attempt_id, question_id) |
| answer | jsonb | |
| awarded_points | numeric(4,2) nullable | autocalificado o asignado por el profesor |
| auto_graded | boolean not null default false | |
| graded_by | FK → `teachers.id` nullable | |
| graded_at | timestamptz nullable | |
| teacher_feedback | text nullable | |

**Autocalificación:** Edge Function `grade-attempt`, ejecutada al entregar. Califica opción
múltiple y verdadero/falso; deja en `NULL` las de redacción abierta y encola el intento. Cuando
no queda ninguna respuesta sin puntaje, el intento pasa a `calificado`. **La calificación nunca
ocurre en el cliente** (`01_` §4.3).

---

## 5. CONTENIDO Y FEEDBACK

### `content_items` — **nueva** (repositorio propio, ADR-004)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_id | FK → `modules.id` | |
| week_number | int nullable | organización programa → módulo → semana |
| learning_guide_id | FK → `learning_guides.id` nullable | |
| title | text not null | |
| type | enum(`pdf`,`presentacion`,`imagen`,`enlace`,`documento`) not null | |
| storage_path | text nullable | bucket privado de Supabase Storage |
| external_url | text nullable | usado si `type = enlace` (p. ej. Classroom durante la transición) |
| size_bytes | bigint nullable | |
| uploaded_by | FK → `profiles.id` | |
| visible_from | timestamptz nullable | publicación programada |
| is_published | boolean not null default false | |

### `content_views`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| content_item_id | FK → `content_items.id` | |
| student_id | FK → `students.id` | |
| viewed_at | timestamptz | alimenta el reporte "uso de e-learning" de `06_` §4 |

### `feedback_micro` — corregida (D-5)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| session_id | FK → **`class_sessions.id`** | **antes apuntaba a `attendance_events.id`** · unique(session_id, student_id) |
| answers | jsonb not null | máximo 3 preguntas, validado por disparador contra `system_config` |
| submitted_at | timestamptz | |

### `feedback_macro`
Sin cambios estructurales respecto a `04_` §7. La emisión de insignia (`badge_issued`,
`badge_url`) es **Fase 2** `[F2]`; los campos se crean ahora para no migrar después.

---

## 6. TRANSVERSALES
> Cierra D-6, D-7 y D-8. Aplica ADR-010.

### `system_config` — **nueva**
| Campo | Tipo | Notas |
|---|---|---|
| key | text PK | ej. `module.passing_threshold_default` |
| value | jsonb not null | |
| description | text not null | |
| updated_by | FK → `profiles.id` | |
| updated_at | timestamptz | |

Escritura restringida a `super_admin`. Un disparador copia cada cambio a
`system_config_history` (misma forma + `changed_at`, `old_value`).

**Claves obligatorias en Fase 1:**
| Clave | Valor inicial |
|---|---|
| `module.passing_threshold_first` | `10` |
| `module.passing_threshold_default` | `12` |
| `module.participation_weight_min` | `0.05` |
| `exam.individual_passing_score` | `10` |
| `exam.max_score` | `20` |
| `attendance.qr_window_seconds` | `30` |
| `attendance.qr_drift_tolerance` | `1` (ventanas de tolerancia por desfase de reloj) |
| `feedback.micro_max_questions` | `3` |
| `grading.sla_hours` | `72` |

### `audit_log` — **nueva**
| Campo | Tipo | Notas |
|---|---|---|
| id | bigserial PK | |
| actor_profile_id | FK → `profiles.id` nullable | `NULL` si lo hizo un proceso del sistema |
| action | text not null | `insert` / `update` / `delete` / acción de negocio |
| entity | text not null | nombre de la tabla |
| entity_id | uuid nullable | |
| before / after | jsonb nullable | |
| ip | inet nullable | |
| created_at | timestamptz | |

Se llena por **disparadores de base de datos**, no por código de aplicación. Append-only:
`REVOKE UPDATE, DELETE` para todos los roles.

**Tablas auditadas en Fase 1:** `profiles`, `students`, `module_enrollments`, `exam_answers`,
`attendance_events`, `parental_consents`, `system_config`, `content_items`.
**Se añaden en Fase 2:** `payments`, `installments`, `points_redemptions`.

### `notifications` — **nueva**
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| profile_id | FK → `profiles.id` | |
| type | text not null | del catálogo de notificaciones |
| title / body | text | |
| payload | jsonb nullable | |
| channel | enum(`push`,`email`,`in_app`) | |
| sent_at / read_at | timestamptz nullable | |

### Entidades de Fase 2 y 3 `[F2]` `[F3]`
Se conservan tal como las define `04_`, con estas correcciones ya acordadas y **pendientes de
implementar cuando llegue su fase**:
- `exchange_rates` — **nueva** (D-9): `rate_date PK`, `rate_bs_per_usd`, `source`
  (`bcv`/`manual`), `fetched_at`, `set_by`. Con alarma de tasa vencida: si no hay tasa del día,
  el sistema bloquea el registro de pagos en bolívares en vez de usar una tasa antigua.
- `invoices` — **nueva** (D-10): exigida por la regla contable de `02_` §3.
- `payments` — soporte de **pago parcial** de una cuota (D-11) mediante una tabla de asignación
  `payment_allocations (payment_id, installment_id, amount_usd)`.
- `snack_fund_ledger` — no implementable hasta que se defina la base de cálculo del "30% del
  excedente" (D-12).
- `learning_videos` — relación **1:N** con `learning_guides`, no 1:1 (D-13).
- `certifications`, `partial_transcripts`, `ugc_*`, `specialization_roles` — sin cambios.

---

## 7. MATRIZ DE ROW LEVEL SECURITY
> Cierra B-3. Aplica ADR-002. **Ninguna tabla se crea sin su política en la misma migración.**

Lectura de la matriz: `propio` = solo sus propias filas · `cohorte` = filas de las cohortes
asignadas · `todo` = todas las filas · `—` = sin acceso.

| Tabla | Estudiante | Profesor | Admin | Super Admin |
|---|---|---|---|---|
| `profiles` | lee propio; edita teléfono y avatar | lee propio + estudiantes de su cohorte | lee/escribe todo | lee/escribe todo |
| `students` | lee propio | lee cohorte | lee/escribe todo | lee/escribe todo |
| `parental_consents` | lee propio | — | lee/escribe todo | lee/escribe todo |
| `teachers` / `admins` | — | lee propio | lee todo | lee/escribe todo |
| `programs` / `modules` | lee todo | lee todo | lee todo | lee/escribe todo |
| `cohorts` | lee la propia | lee las asignadas | lee/escribe todo | lee/escribe todo |
| `learning_guides` | lee las de su módulo | lee cohorte | lee/escribe todo | lee/escribe todo |
| `class_sessions` | lee las de su cohorte | lee/escribe las suyas | lee/escribe todo | lee/escribe todo |
| `module_enrollments` | **lee propio, nunca escribe** | lee/escribe cohorte | lee/escribe todo | lee/escribe todo |
| `attendance_events` | lee propio | inserta y lee cohorte | inserta y lee todo | lee todo |
| `student_qr_secrets` | **— (ni siquiera propio)** | — | — | — |
| `exams` | lee solo `habilitado` de su módulo | lee/escribe los suyos | lee todo | lee/escribe todo |
| `exam_questions` | lee **vía vista sin `correct_answer`**, solo si el examen está habilitado | lee/escribe los suyos | lee todo | lee/escribe todo |
| `exam_attempts` | lee/escribe propio mientras esté `en_progreso` | lee cohorte | lee todo | lee todo |
| `exam_answers` | escribe propio antes de entregar; después solo lee | lee/califica cohorte | lee todo | lee todo |
| `content_items` | lee `is_published` de su módulo | lee/escribe los suyos | lee/escribe todo | lee/escribe todo |
| `content_views` | inserta propio | lee agregado de cohorte | lee todo | lee todo |
| `feedback_micro` | inserta y lee propio | **lee solo agregado, nunca individual** | lee todo | lee todo |
| `feedback_macro` | inserta y lee propio | lee agregado | lee todo | lee todo |
| `system_config` | lee las claves públicas | lee las claves públicas | lee todo | **lee/escribe todo** |
| `audit_log` | — | — | lee todo | lee todo |
| `notifications` | lee/marca leídas las propias | idem | idem | idem |

**Notas críticas:**
1. **`student_qr_secrets` no es legible por nadie** vía la API pública. El secreto se entrega
   una única vez, en el aprovisionamiento inicial, a través de una Edge Function autenticada.
   La validación del código siempre ocurre en el servidor.
2. **El profesor nunca ve feedback micro individual.** Si lo viera, el feedback dejaría de ser
   sincero y el módulo perdería su razón de ser. Solo accede al agregado por sesión, y solo si
   hay 3 o más respuestas (umbral anti-identificación, en `system_config`).
3. **El estudiante nunca escribe su propia calificación.** Todas las notas se escriben mediante
   Edge Functions con `service_role`.
4. **`correct_answer` jamás llega al cliente estudiante.** Se aplica doble barrera: política de
   RLS más una vista `v_exam_questions_student` que no incluye la columna.

---

## 8. ORDEN DE MIGRACIONES

| # | Archivo | Contenido |
|---|---|---|
| 001 | `001_extensions_and_enums.sql` | `pgcrypto`, `pg_cron`; todos los tipos enumerados |
| 002 | `002_identity.sql` | `profiles`, `students`, `teachers`, `admins`, disparador de sincronía con `auth.users`, función `age_years`, vista `v_students` |
| 003 | `003_academic_structure.sql` | `programs`, `modules`, `cohorts`, `learning_guides`, `class_sessions` |
| 004 | `004_enrollments_grading.sql` | `module_enrollments`, `calc_final_score`, disparadores de nota y umbral |
| 005 | `005_attendance.sql` | `student_qr_secrets`, `attendance_events`, restricciones de inmutabilidad |
| 006 | `006_exams.sql` | `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, vista para estudiante |
| 007 | `007_content_feedback.sql` | `content_items`, `content_views`, `feedback_micro`, `feedback_macro` |
| 008 | `008_config_audit_notifications.sql` | `system_config` + historial, `audit_log` + disparadores, `notifications` |
| 009 | `009_rls_policies.sql` | **todas** las políticas de la matriz §7 |
| 010 | `010_parental_consents.sql` | `parental_consents` + disparador de bloqueo de onboarding |
| 011 | `011_seed_config.sql` | claves iniciales de `system_config` |

**Regla:** las migraciones 001 a 011 se ejecutan **completas** en el Sprint 0. No se avanza a
construir pantallas con el esquema a medias. Un cambio de esquema con datos vivos cuesta
diez veces más que hacerlo bien antes de que existan datos.

---

## 9. DATOS SEMILLA MÍNIMOS PARA ARRANCAR

| Conjunto | Volumen | Origen | Responsable | Fecha límite |
|---|---|---|---|---|
| 1 programa | 1 fila | Ya definido | Equipo técnico | 02/08 |
| 13 módulos con nombre, orden y duración | 13 filas | Coordinación Académica | **Por asignar** | 07/08 |
| Cohortes activas y su módulo actual | ~3-6 filas | Recolección en sede el 01/08 | Equipo técnico | 03/08 |
| Guías de Aprendizaje | **~52 filas** | Guías físicas existentes | **Por asignar — dependencia #1** | **14/08** |
| Profesores | ~5-10 filas | Administración | Administración | 10/08 |
| Estudiantes de la cohorte piloto | ~20-30 filas | Administración | Administración | 15/08 |
| Matrícula completa | ~100 filas | Administración | Administración | 02/09 |
| `system_config` | 9 claves | Migración 011 | Equipo técnico | 02/08 |

**Datos ficticios en paralelo:** se genera un conjunto de datos falsos completo desde el Sprint
0 para que el desarrollo no se detenga esperando a la academia. El plan nunca depende de que
un dato externo llegue a tiempo para poder seguir construyendo — solo para poder *entregar*.
