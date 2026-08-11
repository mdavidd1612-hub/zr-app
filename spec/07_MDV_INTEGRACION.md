# 07 · INTEGRACIÓN DEL MODELO DE DOMINIO VERIFICADO (MDV)
> Este documento especifica cómo se integra la metodología MDV en ZR App.
> Es el puente entre los documentos pedagógicos de `Metodologia/` y el código.
>
> **Regla de oro:** las reglas de negocio MDV viven en la base de datos (triggers,
> funciones, RLS) y en Edge Functions. El frontend solo pregunta y muestra.

---

## 1. RESUMEN: QUÉ ES EL MDV

El Modelo de Dominio Verificado organiza la formación en dos carriles:

| Carril | Cuándo | Qué hace | Peso en la nota |
|---|---|---|---|
| **Abierto** | Lunes a viernes, 20-25 min/día | Microlecciones, simulaciones, dudas, autochequeo | **0%** — habilita la compuerta, no puntúa |
| **Seguro** | Sábado presencial | Evaluación de desempeño con rúbrica + defensa técnica | **100%** |

**Decisión inviolable:** la nota solo nace el sábado. El trabajo digital vale 0% y habilita
la compuerta. Esta regla se implementa en el backend: no existe columna `nota` en ninguna
tabla del carril abierto.

---

## 2. FLUJO SEMANAL COMPLETO

```
LUNES 20min
  → Microlección 1 y 2 (video con preguntas incrustadas)
  → Tutor IA disponible (N1)
  → Tabla: weekly_activities (activity_type = 'microleccion')
  → Al completar: activity_completions

MARTES 20min
  → Microlección 3 + Simulador
  → Tabla: weekly_activities (activity_type = 'microleccion' + 'simulacion')

MIÉRCOLES 25min
  → Caso simulado + DUDA OBLIGATORIA
  → La duda es bloqueante: no puede marcar el día como completado sin ella
  → Tabla: weekly_activities (activity_type = 'caso_simulado' + 'duda_obligatoria')
  → Al enviar duda: activity_completions + weekly_progress.doubt_submitted = true

JUEVES 45-60min
  → Videollamada "Clínica de errores"
  → El instructor entra con datos: qué falló el grupo, qué dudas hay
  → Tabla: weekly_activities (activity_type = 'clinica_errores')

VIERNES 15min
  → Autochequeo (8 preguntas, N0, sin material)
  → Intentos ilimitados, calificación más alta
  → Al completar: activity_completions con score
  → weekly_progress.self_check_score se actualiza
  → 22:00: Edge Function close-gate-a cierra la compuerta

SÁBADO (presencial)
  08:00  Control de entrada (8 preguntas, 20 min, modo kiosk)
         → Tabla: exams con exam_purpose = 'control_entrada'
  08:20  Clínica de errores (instructor proyecta fallos del grupo)
         → Datos: v_error_heatmap
  08:45  Demo mínima (video o instructor presencial)
  09:05  Taller Estaciones (4 estaciones × 4 estudiantes)
         → Tabla: workshop_role_assignments
  14:00  Evaluación de desempeño (1 estudiante, 1 instructor, 1 competencia)
         → Tablas: performance_evaluations + eval_criteria_results
         → Trigger: fn_calculate_eval_outcome
  15:30  Defensa técnica (3 preguntas de banco de 10, 5 min)
         → Tablas: defense_questions + technical_defenses
         → Trigger: fn_defense_blocks_mastery
  16:30  Ticket de reflexión (3 min)
         → Tabla: reflection_tickets
```

---

## 3. LAS TRES COMPUERTAS

### Compuerta A — Acceso al sábado
**Tabla:** `weekly_progress`
**Trigger:** `fn_calculate_gate_a`
**Edge Function:** `close-gate-a` (cron viernes 22:00)

**Condiciones para `saturday_enabled = true`:**
1. `activities_completed >= activities_required` (todas las actividades requeridas)
2. `self_check_score >= cfg('mdv.self_check_threshold')` (por defecto 5 de 8)
3. `doubt_submitted = true` (duda del miércoles enviada)

**Si no cumple después del cierre:** `status = 'refuerzo'`, `saturday_enabled = false`.
El estudiante asiste al sábado pero hace refuerzo, no evalúa desempeño.

### Compuerta B — Dominio con ítems críticos
**Tabla:** `performance_evaluations`
**Trigger:** `fn_calculate_eval_outcome`

**Aritmética de la rúbrica:**
- 4 ítems críticos × 20 puntos = 80 puntos
- 8 ítems normales × 2.5 puntos = 20 puntos
- Total: 100 puntos. **Nota de aprobación: 81.**
- Fallar UN solo ítem crítico → máximo alcanzable = 80 → reprobado automáticamente.

**Lógica del trigger:**
```
SI cualquier ítem crítico tiene meets_criterion = false
  → outcome = 'requiere_refuerzo'
SI NO, Y total_score < passing_score
  → outcome = 'en_desarrollo'
SI NO
  → outcome = 'dominada'
```

### Compuerta C — Defensa técnica
**Tabla:** `technical_defenses`
**Trigger:** `fn_defense_blocks_mastery`

**Regla:** si `level_achieved = 'nivel_1'` → fuerza `outcome = 'requiere_refuerzo'`
en la evaluación vinculada, sin importar la rúbrica.

---

## 4. ESTADOS DE COMPETENCIA

### En la evaluación (eval_outcome)
| Estado | Condición | Color |
|---|---|---|
| `dominada` | Rúbrica ≥ 81 + todos los críticos OK + defensa ≥ nivel_3 | Verde |
| `en_desarrollo` | Críticos OK pero rúbrica incompleta o defensa nivel_2 | Amarillo |
| `requiere_refuerzo` | Cualquier crítico falla O defensa nivel_1 | Rojo |

### En el pasaporte (mastery_status)
| Estado | Mapeo desde eval_outcome | Acción |
|---|---|---|
| `dominado` | ← `dominada` | Pasaporte verde. Avanza. |
| `en_progreso` | ← `en_desarrollo` | Pasaporte amarillo. Reintento. |
| `requiere_refuerzo` | ← `requiere_refuerzo` | Pasaporte rojo. Refuerzo obligatorio. |
| `no_iniciado` | Sin evaluación aún | Pasaporte gris. |

**Regla de mejora:** el trigger `fn_sync_mastery_from_eval` solo mejora el estado, nunca
lo degrada. El mejor intento manda. Repetir no castiga.

---

## 5. NIVELES DE IA

| Nivel | Nombre | Qué puede hacer el estudiante | Implementación |
|---|---|---|---|
| **N0** | Sin IA | Nada. Sin acceso al tutor. | Actividades del sábado + autochequeo del viernes |
| **N1** | IA como Tutor | Hacer preguntas al tutor. El tutor NUNCA da la respuesta. | Enlace externo a proyecto Claude/GPT con prompt restrictivo |
| **N2** | IA como Asistente | Organizar información. Debe verificar contra ficha del fabricante. | Checkbox obligatorio "Verifiqué contra ficha" antes de entregar |
| **N3** | IA como Copiloto | Usar IA libremente. Debe declarar cómo la usó. | Formulario `ia_declarations` obligatorio antes de entregar |
| **N4** | IA como Objeto de Auditoría | Recibir diagnóstico de IA con errores y detectarlos. | Examen con `exam_purpose = 'retencion'` que incluye texto con errores |

**Implementación para el piloto:** el tutor IA es un enlace externo (`system_config.mdv.ia_tutor_url`).
No se construye dentro de ZR App. Las instrucciones del tutor están en
`Metodologia/MDV-implementacion-tecnica-lowcode.md` §6.2.

---

## 6. MAPA DE TABLAS

### Tablas nuevas (migración 015)
| Tabla | Propósito | Quién escribe | Quién lee |
|---|---|---|---|
| `weekly_activities` | Config de actividades lun-vie | Instructor/admin | Todos |
| `activity_completions` | Registro de completación | Estudiante (vía Edge Function) | Estudiante + personal |
| `weekly_progress` | Compuerta A agregada | Edge Function `close-gate-a` | Todos |
| `rubric_templates` | Plantillas de rúbricas | Instructor/admin | Todos |
| `rubric_criteria` | Criterios con flag crítico | Instructor/admin | Todos |
| `performance_evaluations` | Evaluación del sábado | Instructor (vía Edge Function) | Estudiante + personal |
| `eval_criteria_results` | Resultado por criterio | Instructor (vía Edge Function) | Estudiante + personal |
| `defense_questions` | Banco de preguntas | Instructor/admin | Personal |
| `technical_defenses` | Resultado de defensa | Instructor (vía Edge Function) | Estudiante + personal |
| `reflection_tickets` | Ticket de reflexión | Estudiante | Estudiante + personal |
| `workshop_role_assignments` | Roles del taller | Edge Function | Todos en la sesión |
| `ia_declarations` | Declaración uso IA | Estudiante | Estudiante + personal |

### Tablas existentes modificadas
| Tabla | Cambio | Migración |
|---|---|---|
| `exams` | Campo `exam_purpose` (evaluacion/control_entrada/autochequeo/retencion) | 015 |
| `mastery_map` | Nuevo valor de enum: `requiere_refuerzo` | 015 (ALTER TYPE) |
| `mastery_map` | Nuevas fuentes: `defensa_tecnica`, `evaluacion_rubrica` | 015 (ALTER TYPE) |

### Vistas nuevas
| Vista | Datos | Uso principal |
|---|---|---|
| `v_pasaporte_mdv` | Competencias + última evaluación + defensa | Pantalla del pasaporte |
| `v_gate_a_status` | Estado de compuerta A por estudiante/sesión | Dashboard del profesor el sábado |
| `v_error_heatmap` | Criterios que más fallan, tasa de fallo | Preparación de clínica de errores |

---

## 7. CONFIGURACIÓN MDV (system_config)

| Clave | Default | Descripción |
|---|---|---|
| `mdv.self_check_threshold` | 5 | Mínimo del autochequeo (de 8) para compuerta A |
| `mdv.gate_close_time` | 22:00 | Hora de cierre de compuerta A los viernes |
| `mdv.rubric_passing_score` | 81 | Nota de aprobación de rúbricas |
| `mdv.critical_item_points` | 20 | Puntos por ítem crítico |
| `mdv.normal_item_points` | 2.5 | Puntos por ítem normal |
| `mdv.defense_questions_draw` | 3 | Preguntas sorteadas en defensa |
| `mdv.defense_questions_bank` | 10 | Mínimo de preguntas por banco |
| `mdv.entry_control_questions` | 8 | Preguntas del control de entrada |
| `mdv.entry_control_time_minutes` | 20 | Tiempo del control de entrada |
| `mdv.reflection_ticket_required` | true | Si el ticket de reflexión es obligatorio |
| `mdv.ia_tutor_url` | (vacío) | URL del tutor IA externo |
| `mdv.ia_tutor_max_exchanges` | 3 | Máximo de intercambios por tema |
| `mdv.video_evidence_max_seconds` | 90 | Duración máx del video de evidencia |

**Toda la app lee de aquí.** Cambiar un umbral es editar una fila, no desplegar código.

---

## 8. REGLAS DE NEGOCIO IMPLEMENTADAS

### Regla 1: La nota solo nace el sábado
No existe columna `nota` en las tablas del carril abierto. La única tabla con peso
evaluativo es `performance_evaluations`. El carril abierto se excluye del cálculo:
cuenta para la compuerta, pero no puntúa.

### Regla 2: Puntos críticos no promedian
Implementado en `fn_calculate_eval_outcome`: si cualquier criterio con
`is_critical = true` tiene `meets_criterion = false`, el outcome es
`requiere_refuerzo` sin importar el puntaje total.

### Regla 3: Repetir no castiga
`attempt_number` se registra pero no afecta el resultado final. El trigger
`fn_sync_mastery_from_eval` solo mejora el estado en `mastery_map`, nunca
lo degrada. La nota es el estado de dominio, no un promedio numérico.

### Regla 4: Compuerta A es real
El trigger `fn_calculate_gate_a` evalúa automáticamente. El Edge Function
`close-gate-a` cierra la compuerta los viernes a las 22:00. No hay bypass
manual. Si no cumplió, va a refuerzo.

### Regla 5: Defensa nivel 1 bloquea
El trigger `fn_defense_blocks_mastery` fuerza `outcome = requiere_refuerzo`
si la defensa es `nivel_1`, sin importar la rúbrica.
