> # ⛔ DOCUMENTO SUPERADO — NO CONSTRUIR SOBRE ESTE ARCHIVO
> **Superado el 30 de julio de 2026 por `10_ESQUEMA_BASE_DATOS_V2.md` y por las migraciones
> reales en `/supabase/migrations/`.**
>
> Este esquema era un buen borrador conceptual pero **no es ejecutable**: referencia tablas que
> nunca define (`teachers`, `admins`), incluye dos columnas generadas que Postgres rechaza,
> le falta la entidad `class_sessions`, le falta el concepto de cohorte, no tiene banco de
> preguntas y no define ninguna política de control de acceso.
> El detalle está en `08_AUDITORIA_TECNICA_Y_VIABILIDAD.md` §2 y §3.
>
> **La fuente de verdad del esquema son los archivos `.sql` de `/supabase/migrations/`.**
> Si un `.sql` y un documento se contradicen, manda el `.sql`.
>
> Este archivo se conserva como registro del diseño conceptual original.

---

# ESQUEMA DE BASE DE DATOS — ZR APP *(histórico)*
> Este archivo no existía en la documentación original (ver `06_FLUJOS_USUARIO_AGENTE.md`,
> sección 0, donde se señalaba el gap). Se construye ahora derivado de las reglas de negocio
> **confirmadas** por la Junta en Julio 2026 (ver `02_MODULO_FINANCIAMIENTO.md` y
> `00_CONTEXTO_MAESTRO_AGENTE.md`). Es la fuente de verdad de entidades y relaciones; las
> migraciones SQL reales deben vivir versionadas en `supabase/migrations/` (ver
> `01_STACK_TECNICO_LOWCODE.md`, sección 4), derivadas de este documento.
>
> Convención: `[PENDIENTE]` marca un campo o regla que necesita confirmación adicional antes
> de cerrarse — no bloquea construir la tabla, pero sí bloquea hardcodear el valor.

## 1. ESTUDIANTES Y CUMPLIMIENTO LEGAL

### `students`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| full_name | text | |
| cedula | text unique | |
| password_hash | text | |
| birth_date | date | usado para calcular `is_minor` |
| is_minor | boolean (generado) | `true` si edad entre 15 y 17 al momento de registro |
| onboarding_status | enum(`en_curso`,`completo`) | objetivo < 60s salvo consentimiento parental pendiente |
| program_id | FK → `programs.id` | |
| current_module_id | FK → `modules.id` nullable | |
| trust_level | int nullable (1,2,3) | `NULL` mientras cursa el módulo 1 (ver `financing_plans`) |
| created_at | timestamptz | |

### `parental_consents`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| consent_type | enum(`account_creation`,`ugc_publication`) | dos registros separados, no un solo checkbox — ver `03_MODULO_SOCIAL_VIDEO.md` sección 2 |
| representative_name | text | |
| representative_cedula | text | |
| method | enum(`fisico`,`digital`) | |
| document_url | text nullable | soporte firmado si es digitalizado |
| signed_at | timestamptz | |

**Regla:** un estudiante con `is_minor = true` y sin registro `account_creation` en
`parental_consents` no puede pasar de `onboarding_status = en_curso`. El consentimiento de
`ugc_publication` solo se exige antes de habilitar subida de contenido en Fase 3.

## 2. PROGRAMA, MÓDULOS Y GUÍAS DE APRENDIZAJE

### `programs`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | ej. "Técnico Automotriz" |
| total_modules | int default 13 | confirmado |
| total_duration_months | int default 13 | confirmado |

### `modules`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| program_id | FK → `programs.id` | |
| order_index | int | 1 a 13 |
| name | text | ej. "Transmisión" |
| duration_weeks | int default 4 | excepciones confirmadas: módulos de 3 u 8 semanas |
| inces_homologado | boolean default false | `true` para Electricidad, Transmisión, Suspensión/Frenos, Dirección |

### `learning_guides` (fuente real de las sub-competencias — ya existen físicamente)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_id | FK → `modules.id` | |
| week_number | int | 1 a N según duración del módulo |
| sub_competency_name | text | ej. "Diagnóstico de sistema de frenos" |
| pre_practice_description | text | investigación previa (entre semana) |
| practice_description | text | práctica de taller (sábado) |
| digitized | boolean default false | `false` hasta que Coordinación Académica entregue el contenido (Semana 1 del roadmap) |

### `module_enrollments`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| module_id | FK → `modules.id` | |
| theory_score | numeric(4,2) | sobre 20 |
| practice_score | numeric(4,2) | sobre 20 |
| participation_pct | numeric(4,2) | mínimo 5%, a criterio del profesor — no fijo |
| final_score | numeric(4,2) (generado) | `theory_score*0.5 + practice_score*0.5`, ajustado con participación |
| passing_threshold | numeric(4,2) (generado) | `10` si `order_index = 1`, si no `12` |
| status | enum(`en_curso`,`aprobado`,`reprobado`,`retirado`) | |
| approved_at | timestamptz nullable | |

**Regla de asistencia (no rígida):** no existe campo de "número de faltas permitidas". La
reprobación se deriva naturalmente de `final_score` insuficiente por falta de notas
acumuladas — el sistema **no debe implementar** una baja automática por conteo de
inasistencias (ver `00_CONTEXTO_MAESTRO_AGENTE.md`, sección 3.4).

## 3. ASISTENCIA Y REFRIGERIOS

### `attendance_events`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| module_id | FK → `modules.id` | |
| session_date | date | sábado correspondiente |
| scanned_at | timestamptz | |
| snack_claimed | boolean default false | mismo evento habilita refrigerio — no crear tabla NFC separada |

## 4. EVALUACIONES

### `exams`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_id | FK → `modules.id` | |
| teacher_id | FK → `teachers.id` | |
| type | enum(`opcion_multiple`,`verdadero_falso`,`redaccion_abierta`) | |
| status | enum(`oculto`,`habilitado`,`en_progreso`,`entregado`,`calificado`) | |
| max_score | numeric default 20 | confirmado |
| passing_score | numeric default 10 | confirmado, aplica a evaluación individual |

### `exam_attempts`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| exam_id | FK → `exams.id` | |
| student_id | FK → `students.id` | |
| answers | jsonb | |
| score | numeric(4,2) nullable | `NULL` hasta calificar (redacción abierta) |
| graded_by | FK → `teachers.id` nullable | `NULL` si fue auto-calificado |
| graded_at | timestamptz nullable | |

## 5. MICRO-LEARNING Y MAPA DE DOMINIO (Flujo A — separado de UGC)

### `learning_videos`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| learning_guide_id | FK → `learning_guides.id` | liga 1:1 al objetivo semanal real |
| video_url | text | Cloudflare Stream / Mux |
| question | text | |
| correct_answer | text | |
| duration_seconds | int check ≤30 | |

### `learning_video_responses`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| video_id | FK → `learning_videos.id` | |
| student_id | FK → `students.id` | |
| is_correct | boolean | |
| points_awarded | int | |
| responded_at | timestamptz | |

### `mastery_map`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| learning_guide_id | FK → `learning_guides.id` | una fila por sub-competencia |
| status | enum(`no_iniciado`,`en_progreso`,`dominado`) | |
| dominated_via | enum(`micro_learning`,`evaluacion_practica`) | evaluación práctica es la única fuente que no depende de auto-calificación |
| updated_at | timestamptz | |

## 6. FINANCIAMIENTO (ver `02_MODULO_FINANCIAMIENTO.md` para las reglas completas)

### `financing_plans`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| module_order_index | int | `1` = estructura fija; `>1` = Cash & Carry |
| plan_type | enum(`modulo_1_fijo`,`cash_carry`) | |
| initial_pct | numeric | 40% si `modulo_1_fijo`; 60/50/40% según nivel si `cash_carry` |
| installments_count | int | 3 (módulo 1) |
| installment_amount_usd | numeric | $30 fijo en módulo 1 |

### `student_trust_level`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| level | int (1,2,3) nullable | `NULL` durante módulo 1 |
| effective_from_module_id | FK → `modules.id` | |
| upgrade_rule_version | text | `[PENDIENTE]` — número exacto de pagos puntuales para subir de nivel aún no confirmado, ver `02_MODULO_FINANCIAMIENTO.md` sección 2 |
| updated_at | timestamptz | |

### `installments`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| module_id | FK → `modules.id` | |
| installment_number | int | |
| amount_usd | numeric | |
| due_date | date | sábado correspondiente |
| status | enum(`pendiente`,`pagado`,`vencido`) | |

### `payments`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| installment_id | FK → `installments.id` nullable | nullable para pago de contado completo ($130) |
| amount_usd | numeric | |
| amount_bs | numeric | calculado con `bcv_rate` |
| bcv_rate | numeric | tasa BCV del día de la transacción, nunca fija |
| method | enum(`binance`,`pago_movil`,`transferencia`,`efectivo`) | |
| receipt_url | text nullable | nulo si `efectivo` |
| status | enum(`pendiente_revision`,`aprobado`,`rechazado`) | **inmutable** una vez aprobado/rechazado — corrección crea nuevo registro |
| rejection_reason | enum(`monto_no_coincide`,`referencia_invalida`,`comprobante_duplicado`,`otro`) nullable | estructurado, no texto libre |
| reviewed_by | FK → `admins.id` nullable | |
| reviewed_at | timestamptz nullable | |
| created_at | timestamptz | |

### `academic_incentive_redemptions` (10% por rendimiento en quizzes) y `points_redemptions`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| type | enum(`incentivo_academico_10pct`,`canje_puntos_dominio`) | |
| trigger_score | numeric nullable | ej. >18/20 para el incentivo académico |
| applied_to_installment_id | FK → `installments.id` nullable | |
| accounting_entry_ref | text | referencia al asiento contable — **nunca** un `UPDATE` simple de balance |
| created_at | timestamptz | |

### `snack_fund_ledger` (nuevo — vínculo financiero confirmado, sección 10 de `02_`)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| source_payment_id | FK → `payments.id` | pago inicial de $60 del módulo 1 que originó la reserva |
| amount_reserved_usd | numeric | 30% del excedente del inicial |
| week_of | date | semana/sábado a la que se destina |
| created_at | timestamptz | |

## 7. FEEDBACK

### `feedback_micro`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| class_session_id | FK → `attendance_events.id` | |
| answers | jsonb | máximo 3 preguntas |
| submitted_at | timestamptz | |

### `feedback_macro`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| module_id | FK → `modules.id` | |
| open_text | text | |
| badge_issued | boolean default false | |
| badge_url | text nullable | |

## 8. CERTIFICACIÓN

### `certifications`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| type | enum(`final_semprom_proem`,`inces_modulo`) | |
| module_id | FK → `modules.id` nullable | solo aplica a `inces_modulo` (Electricidad, Transmisión, Suspensión/Frenos, Dirección) |
| issued_at | timestamptz | |
| qr_verification_code | text unique | dirige al portafolio profesional |
| digital_signature_ref | text | firma electrónica institucional certificada |
| pdf_url | text | |

**Regla:** `certifications.type = final_semprom_proem` solo puede emitirse si los 13
`module_enrollments` del estudiante tienen `status = aprobado`.

### `partial_transcripts` (nuevo — mejora aprobada por la Junta)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| requested_at | timestamptz | |
| modules_included | jsonb | snapshot de `module_enrollments` aprobados al momento del retiro |
| pdf_url | text | |

Esta entidad es **independiente** de `certifications` — no tiene validez de título oficial,
solo sirve como aval parcial de currículum para un estudiante que se retira.

## 9. RED SOCIAL / UGC (Fase 3 — no construir sin spike de moderación resuelto)

### `ugc_videos`, `ugc_video_comments`, `ugc_reports`, `moderation_log`
Sin cambios respecto al modelo descrito en `03_MODULO_SOCIAL_VIDEO.md` sección 3. Toda esta
familia de tablas depende de que `parental_consents.consent_type = ugc_publication` exista
para el estudiante autor antes de permitir su primer `INSERT` en `ugc_videos`.

### `specialization_roles` (Fase 3)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| student_id | FK → `students.id` | |
| role_name | text | ej. "Especialista en Electricidad" |
| computed_score | numeric | |
| computed_at | timestamptz | |

`[PENDIENTE]` — no hay owner académico asignado para diseñar los cuestionarios dinámicos que
alimentan esta tabla (ver `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md`). No construir la lógica
de cálculo hasta que exista ese contenido.

## 10. PARAMETRIZACIÓN OBLIGATORIA (nunca hardcodear)
Consistente con `01_STACK_TECNICO_LOWCODE.md` sección 4 y `06_FLUJOS_USUARIO_AGENTE.md`
sección 5.1, estos valores viven en una tabla de configuración server-side
(`system_config` o equivalente), editable solo por Super Admin/Dirección Académica:
- Porcentajes de inicial por nivel Cash & Carry (60/50/40%).
- Umbral de puntos para el incentivo académico (actualmente 18/20).
- Porcentaje mínimo de participación (actualmente mínimo 5%, definido por cada profesor).
- Umbral de aprobación de módulo (10 para módulo 1, 12 para el resto).
- Porcentaje de reserva del fondo de refrigerios (actualmente 30%).
- `[PENDIENTE]` Reglas exactas de progresión entre niveles de confianza.
