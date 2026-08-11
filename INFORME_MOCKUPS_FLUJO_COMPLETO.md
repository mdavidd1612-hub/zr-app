# 📋 INFORME: MOCKUPS Y FLUJO COMPLETO ZR APP

**Fecha:** 11 de agosto de 2026  
**Versión:** 1.0 (Fase 1 + MDV)  
**Plazo de entrega:** 25 de agosto de 2026

---

## ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estudiante: Flujo Completo](#estudiante-flujo-completo)
3. [Profesor: Flujo Completo](#profesor-flujo-completo)
4. [Administración: Flujo Completo](#administración-flujo-completo)
5. [Directivas: Vista General](#directivas-vista-general)
6. [Especificaciones de Diseño](#especificaciones-de-diseño)

---

## RESUMEN EJECUTIVO

ZR App es una PWA instalable para gestionar la academia técnica ZR Mecademy. Los mockups anteriores muestran el flujo completo para **cuatro roles clave**:

| Rol | Pantallas Principales | Objetivo |
|---|---|---|
| **Estudiante** | Carnet, Semana, Pasaporte, Exámenes | Gestión académica personal y carril abierto |
| **Profesor** | Hoy, Escanear, Evaluar, Defensa, Compuerta, Roles | Asistencia, evaluación presencial y gestión de competencias |
| **Admin** | Panel, Estudiantes, Consentimientos, Reportes MDV | Supervisión y reportes de la academia |
| **Super Admin** | Panel + Configuración | Ajuste de umbrales y parámetros del sistema |

**Reglas de oro que gobiernan el diseño:**
- ✅ Botones de 56 px mínimo (uso de pie en taller)
- ✅ Texto mínimo 16 px
- ✅ Contraste 4.5:1 (luz solar en taller)
- ✅ Navegación en tercio inferior (alcance de pulgar)
- ✅ Colores oficiales de ZR Mecademy 2025 (azul navy, azul de marca)
- ✅ Datos reales desde Supabase, nunca en frontend

---

## ESTUDIANTE: FLUJO COMPLETO

### 📍 Antes de comenzar: `/login` → `/registro` → `/consentimiento` (si aplica)

| Pantalla | Campos | Validación | Siguiente |
|---|---|---|---|
| **Login** | Cédula (V-00000000), Contraseña | Mínimo 8 caracteres | `/carnet` |
| **Registro** | Nombre, Cédula, F. Nac., Correo, Teléfono, Contraseña | Edad < 18 → consentimiento | `/registro/consentimiento` o `/carnet` |
| **Consentimiento** | Datos representante, método, documento | LOPNNA obligatorio | `/carnet` |

---

### 1️⃣ `/carnet` - Pantalla de Inicio (La más importante)

**Propósito:** Punto de entrada diario. El estudiante ve de un vistazo qué le espera.

**Orden inviolable de tarjetas (de arriba a abajo):**

#### Tarjeta 1: «Próximo Sábado» (Fondo: `--zr-blue-light` #98BAE3)
```
📅 PRÓXIMO SÁBADO · 15 de agosto
Semana 2 · Diagnóstico de batería

Para llegar preparado:
Investiga los tipos de batería y cómo se mide su densidad.
                                                    Ver →
```
- **Origen de datos:** Vista `v_proximo_sabado`
- **Campos obligatorios:** `session_date`, `module_name`, `pre_practice_description`
- **Acción:** Enlace a `/semana` (carril abierto para prepararse)
- **Estado vacío:** *"No tienes clase programada por ahora"*
- **Nota:** Si no hay guía (`pre_practice_description` vacío): muestra solo fecha y módulo

#### Tarjeta 2: «Mi Progreso» (Fondo: `--zr-blue-light`)
```
🛂 MI PROGRESO · Electricidad Automotriz
●●◐○ Dominas 2 de 4 competencias
                              Ver pasaporte →
```
- **Origen de datos:** Vista `v_pasaporte_mdv`
- **Puntos de color:** `dominado` (verde), `en_progreso` (amarillo), `requiere_refuerzo` (rojo), `no_iniciado` (gris)
- **Acción:** Enlace a `/pasaporte`
- **Cambio vs. Fase 1:** Ahora muestra 4 estados MDV, no solo aprobado/pendiente

#### Tarjeta 3: El Carnet Propiamente Dicho
```
┌─────────────────────────────┐
│ [Avatar]                    │
│ Juan López                  │
│ V-30000001                  │
│                             │
│ Cohorte 2A · Módulo 1       │
│                             │
│     ┌─────────────┐         │
│     │   [QR]      │         │
│     │ (Rotatorio) │         │
│     └─────────────┘         │
│                             │
│ Módulos aprobados: 3 de 13  │
└─────────────────────────────┘
```
- **Foto:** Avatar de iniciales si no existe foto
- **QR:** Código TOTP de 6 dígitos, se regenera cada 30 segundos, con barra visual
- **Marco QR:** Borde `--zr-navy` de 2 px
- **Tamaño QR:** 60% del ancho de la pantalla mínimo
- **Contador:** *"Módulos aprobados: X de Y"* (de `students.passed_modules`)
- **Aviso:** Si hay consentimiento pendiente, banner en `--zr-warning` sobre el carnet

**Navegación inferior (4 botones):**
```
🎫 Carnet   |   📅 Semana   |   📝 Exámenes   |   📚 Material
```
- Activo: ícono en `--zr-blue-light`, botón en `--zr-navy`
- Inactivo: gris tenue

**Acciones secundarias (enlaces debajo del carnet):**
- "Ver historial de clases →" → `/clases`
- "Ver mis notas →" → `/notas`

---

### 2️⃣ `/semana` - Carril Abierto (Lunes-Viernes)

**Propósito:** Panel semanal. Actividades de lun-vie que habilitan la compuerta A.

#### Encabezado Fijo
```
SEMANA 2 · Diagnóstico de batería
████████░░░░░░  4 de 6 actividades

✅ Habilitado para el sábado
(o: ⚠️ Te faltan 2 actividades)
```
- **Título:** `SEMANA [week_number] · [learning_guide.sub_competency_name]`
- **Barra de progreso:** Actividades completadas / actividades donde `is_gate_requirement = true`
  - Fondo: `--zr-blue-light`
  - Relleno: `--zr-blue`
- **Estado de compuerta:** Datos de `weekly_progress` para la sesión del próximo sábado
  - `saturday_enabled = true` → franja verde: *"Habilitado para el sábado"*
  - `saturday_enabled = false` → franja amarilla: *"Te faltan N actividades"*

#### Tarjetas de Actividad (Una por Día)
```
LUNES
📹 Micro-lección: Tipos de batería
20 min · [N1]
                              ✅ →

MARTES
🎮 Simulación: Densímetro virtual
15 min · [N2]
                              ○ →

MIÉRCOLES
❓ Duda obligatoria
10 min
                              🔒
```

| Campo | Fuente | Notas |
|---|---|---|
| Día | `weekly_activities.day_of_week` | En mayúsculas |
| Icono | `activity_type`: 📹 microleccion, 🎮 simulacion, 🧩 caso_simulado, ❓ duda_obligatoria, ✏️ autochequeo, 🔧 clinica_errores | Icono fijo para cada tipo |
| Título | `weekly_activities.title` | Máximo 50 caracteres |
| Duración | `weekly_activities.duration_minutes` + " min" | Ej. "20 min" |
| Nivel IA | `weekly_activities.ia_level` | Formato: `[N0]`, `[N1]`, etc. Color: `--zr-blue-mid` |
| Estado | `activity_completions` para este estudiante | Ver detalles abajo |

**Estados de cada tarjeta:**

- **Completada:**
  - Borde izquierdo 4px: `--zr-success`
  - Icono: ✅ (verde)
  - Fondo: blanco
  - No clickeable, sin enlace

- **Pendiente (desbloqueada):**
  - Borde izquierdo 4px: `--zr-blue-mid`
  - Icono: ○ (gris)
  - Fondo: blanco
  - Clickeable → `/semana/[activityId]`

- **Bloqueada:**
  - Borde izquierdo 4px: `--zr-border`
  - Icono: 🔒 (gris)
  - Fondo: `#F0F0F0` (tenue)
  - Texto atenuado
  - No clickeable
  - **Razón:** La actividad del día anterior no está completa

**Caso especial - Viernes (Autochequeo):**
Después de completar, muestra el puntaje:
- `score >= mdv.self_check_threshold` → *"6/8"* en verde (`--zr-success`)
- `score < threshold` → *"6/8"* en rojo (`--zr-error`)

**Caso especial - Miércoles (Duda Obligatoria):**
Indicador de envío:
- Si enviada: *"Enviada ✓"* en verde
- Si no enviada y ya pasó el día: *"Sin enviar"* en rojo

**Estados especiales:**

| Caso | Mensaje |
|---|---|
| Sin actividades configuradas | *"Tu profesor aún no ha publicado las actividades de esta semana."* |
| Cargando | Esqueleto de 5 tarjetas grises pulsando |
| Error | *"No pudimos cargar tus actividades. Verifica tu conexión e intenta de nuevo."* + botón **Reintentar** |

---

### 3️⃣ `/semana/[activityId]` - Detalle de Actividad

**Encabezado fijo:**
```
← LUNES · Tipos de batería      [N1] 📹
```
- Botón atrás (←) regresa a `/semana`
- Título: Día y nombre de la actividad
- Badge: Nivel IA + Icono de tipo

**Renderizado según `activity_type`:**

#### `microleccion` (Video)
- Reproductor embebido
- Fuente: `content_config.video_url`
- Si `content_config.embedded_questions` existe: pausar video en timestamps y mostrar preguntas tipo quiz
- Cada pregunta respondida se guarda en `activity_completions.response_data`
- Botón **Marcar como completada** al final

#### `simulacion` (Iframe)
- `<iframe>` a `content_config.simulator_url`
- Pantalla completa (menos barra superior)
- Botón **Marcar como completada** visible solo después de 60 segundos

#### `caso_simulado` (Ramificaciones)
- Escenario renderizado desde `content_config`
- Cada decisión lleva a la siguiente pantalla
- Al final: resumen de decisiones tomadas

#### `duda_obligatoria` (Texto)
```
Escribe aquí tu duda sobre el tema de esta semana...

[                                              ]
[                                              ]

12 / 50 caracteres mínimos

                    [ENVIAR DUDA]
```
- Placeholder: *"Escribe aquí tu duda..."*
- Contador: *"12 / 50 caracteres mínimos"*
- Botón **Enviar duda** deshabilitado hasta 50 caracteres (configurable: `content_config.min_characters`)
- Al enviar: insertar en `activity_completions` con `response_data = { "doubt_text": "..." }`
- Edge Function `complete-activity` actualiza `weekly_progress.doubt_submitted = true`

#### `autochequeo` (Examen Mini)
- Interfaz tipo examen (una pregunta por pantalla)
- Reutiliza estilos de `/examenes/[examId]`
- **Diferencias:**
  - Intentos ilimitados
  - Se guarda el mejor puntaje
  - Al terminar: resultado inmediato (*"6 de 8"*) + retroalimentación por pregunta
- Preguntas de `content_config.question_bank_id` o `content_config.questions`

#### `clinica_errores` (Videollamada)
```
Tu profesor revisará los errores más comunes de la semana.

[UNIRSE A LA CLÍNICA DE ERRORES]

[Marcar como completada]
```
- Tarjeta informativa con URL: `content_config.call_url`
- Botón grande: **Unirse a la clínica de errores** (abre en nueva pestaña)
- Botón secundario: **Marcar como completada**

**Al completar cualquier actividad:**
1. Insertar/actualizar `activity_completions`
2. Llamar Edge Function `complete-activity` → actualiza `weekly_progress`
3. Toast verde 2 seg: *"Actividad completada"*
4. Navegar de vuelta a `/semana`

**Si nivel IA es N3:**
Antes de marcar completada, mostrar formulario `ia_declarations`:
- Herramienta usada
- Pregunta
- Respuesta recibida
- Por qué se aceptó o corrigió
- Verificación
- Decisión propia

Sin la declaración, no se puede completar.

---

### 4️⃣ `/pasaporte` - Pasaporte de Competencias (Reemplaza `/progreso`)

**Encabezado:**
```
🛂 PASAPORTE DE COMPETENCIAS
Electricidad Automotriz

Dominas 2 de 4 competencias
●● ◐ ○
```
- Título: `PASAPORTE DE COMPETENCIAS · [module.name]`
- Resumen: *"Dominas X de Y competencias"*
  - X = filas con `mastery_status = 'dominado'`
  - Y = total de `learning_guides` del módulo
- Puntos de color: uno por competencia con el color de su estado

**Tarjetas de Competencia:**
```
┌──────────────────────────┐
│ SEMANA 1                 │
│ Ley de Ohm aplicada      │
│                          │
│ ██ DOMINADA              │
│ Intento 1 · 92 pts · 8 ago
│ Defensa: Nivel 3         │
└──────────────────────────┘
```

| Campo Visual | Fuente (`v_pasaporte_mdv`) |
|---|---|
| Semana | `week_number` |
| Nombre competencia | `sub_competency_name` |
| Estado | `mastery_status` |
| Número intento | `last_eval_attempt` |
| Puntaje | `last_eval_score` |
| Fecha | `last_eval_date` (formato: `d mmm`) |
| Críticos OK | `last_eval_critical_ok` |
| Nivel defensa | `last_defense_level` (solo si existe) |

**Estados y colores:**

| Estado | Badge | Borde | Texto |
|---|---|---|---|
| `dominado` | Verde `#16A34A` | Verde | *"DOMINADA"* |
| `en_progreso` | Amarillo `#EAB308` | Amarillo | *"EN PROGRESO"* |
| `requiere_refuerzo` | Rojo `#DC2626` | Rojo | *"REQUIERE REFUERZO"* |
| `no_iniciado` | Gris `#C9D6EA` | Gris | *"PENDIENTE"* |

**Reglas inviolables:**
- ❌ Nunca porcentajes (*"50% completado"*)
- ❌ Nunca ranking o comparación con otros estudiantes
- ❌ Nunca puntos, niveles, insignias

**Estados especiales:**
- Sin competencias: *"Este módulo aún no tiene competencias definidas."*
- Cargando: Esqueleto de 4 tarjetas grises
- Error: *"No pudimos cargar tu pasaporte. Verifica tu conexión..."* + botón **Reintentar**

---

### 5️⃣ `/examenes` - Exámenes y Evaluaciones

**Lista de exámenes con estado `habilitado`, `cerrado` o `calificado`.**

Cada tarjeta:
```
┌────────────────────────────────┐
│ Control de Entrada             │
│ Sábado 08:00 · 20 min          │
│                                │
│      [PRESENTAR EXAMEN]        │
└────────────────────────────────┘
```

| Intento | Qué muestra |
|---|---|
| Sin empezar | Botón **Presentar examen** |
| En progreso | Botón **Continuar** + *"Empezaste hace X"* |
| Entregado | *"Entregado. Esperando calificación"* |
| Calificado | Nota grande: `16,5 / 20` (verde o rojo) |

---

### 6️⃣ `/examenes/[examId]` - Detalle de Examen

**Una pregunta por pantalla.**

```
Pregunta 3 de 10 ─ Tiempo: 15 min

¿Cuál es el tipo de batería más común?

[  Batería de plomo            ]
[  Batería de litio             ]
[  Batería de níquel-cadmio    ]
[  Batería de fosfato de hierro]

[Anterior] ───────────── [Siguiente]
```

- Barra de progreso arriba: `Pregunta X de Y`
- Si hay límite de tiempo: timer en esquina superior
- Una opción por pantalla según tipo:
  - **Opción múltiple:** Tarjetas grandes, tocables completas
  - **Verdadero/falso:** Dos botones enormes, mitad y mitad
  - **Redacción abierta:** Área de texto + contador de caracteres
- Abajo: **Anterior** y **Siguiente**
- En última pregunta: **Entregar examen** en ámbar con confirmación

**Guardado automático:**
- Cada respuesta se guarda al cambiar de pregunta
- Si se pierde conexión o se cierra la app, nada se pierde

**⚠️ CRÍTICO:**
```typescript
// CORRECTO: Lee siempre de v_exam_questions_student
SELECT * FROM v_exam_questions_student WHERE exam_id = ?

// INCORRECTO: Expone la respuesta correcta al frontend
SELECT * FROM exam_questions WHERE exam_id = ?
```

---

### 7️⃣ `/contenido` - Material de Estudio

- Lista de módulos con material
- Dentro: agrupado por semana
- Cada elemento: icono de tipo, título, tamaño
- Al tocar: visor PDF con zoom
- Al abrir: registrar en `content_views`

---

### 8️⃣ `/notas` - Calificaciones

Tabla por módulo:
```
Módulo              Teoría  Práctica  Part.  Final  Estado
─────────────────────────────────────────────────────────
Electricidad        18      17        16     16,8   ✅
Hidráulica          15      14        13     14,2   ❌
```

- Debajo de la nota final: *"Aprueba con 12"*
- Umbrales: `system_config.passing_score`

---

### 9️⃣ `/feedback/[sessionId]` - Opinión sobre la Clase

```
¿Cómo estuvo la clase de hoy?

Claridad del instructor:
⭐ ⭐ ⭐ ⭐ ⭐

Ritmo de la clase:
⭐ ⭐ ⭐ ⭐ ⭐

Ambiente en el taller:
⭐ ⭐ ⭐ ⭐ ⭐

                    [ENVIAR]
```

- Máximo 3 preguntas
- Escala de 1 a 5 con estrellas o caritas grandes
- Debe responderse en menos de 20 segundos
- Botón: **Enviar**
- Después: *"Gracias. Tu respuesta es anónima para tu profesor."*

---

## PROFESOR: FLUJO COMPLETO

### 🎯 Antes de la clase: Preparación

| Pantalla | Acciones |
|---|---|
| `/sesiones` | Ver sesiones, crear, reprogramar |
| `/examenes` | Crear y editar exámenes |
| `/contenido` | Subir material para la semana |

---

### 1️⃣ `/hoy` - Pantalla de Inicio (Profesor)

**Lo que el profesor ve a las 08:00:**

```
┌────────────────────────────────┐
│ COHORTE 2A                     │
│ Diagnóstico de Batería         │
│                                │
│ Salón: Taller 1                │
│ Estudiantes: 24                │
│                                │
│ [ABRIR CLASE Y PASAR ASISTENCIA]
└────────────────────────────────┘

📊 Pendientes
3 exámenes por calificar

📈 Última Sesión
22 de 24 asistieron
```

- Tarjeta grande con cohorte de hoy
- Datos: `session_date`, `cohort_name`, `module_name`, `classroom`, `student_count`
- Al tocar: cambia sesión a `abierta` y navega a `/escanear/[sessionId]`
- Contadores: exámenes sin calificar, resumen última sesión

---

### 2️⃣ `/escanear/[sessionId]` - La Pantalla Crítica

**Disposición:**
- 70% arriba: cámara en vivo (sin marcos decorativos)
- Franja de resultado (muy grande)
- Abajo: contador, botón búsqueda, indicador de cola

```
[  CÁMARA EN VIVO  ]

════════════════════════════════════════
   ✅ JUAN LÓPEZ REGISTRADO
════════════════════════════════════════

Asistencia: 18 / 24 ─ 1 sin sincronizar

[BUSCAR POR CÉDULA] [Refr. ☁️]
```

**Franja de resultado:**
- ✅ Verde: *"[NOMBRE]"* (Raleway 40px), pitido corto
- ⚠️ Amarillo: *"Ya registrado"* (no es error), pitido suave
- ❌ Rojo: Motivo del error (código vencido, estudiante no encontrado, etc.), pitido doble

El resultado permanece 2 segundos y vuelve a escanear solo.

**Modo refrigerio:**
Interruptor arriba cambia entre *"Asistencia"* y *"Refrigerio"*. Llama a `claim-snack` en vez de `validate-scan`.

**Sin conexión (obligatorio):**
```typescript
// 1. Cada escaneo entra a IndexedDB con synced: false
// 2. Se intenta enviar de inmediato
// 3. Si falla por red: queda en cola, mostrar "N sin sincronizar"
// 4. Al volver online: reintenta en orden
// 5. Respuesta { duplicate: true } = éxito, limpia cola
```

**Búsqueda por cédula (respaldo manual):**
- Abre lista de estudiantes de la cohorte
- Buscador por nombre o cédula
- Al elegir: pide motivo obligatoriamente (*"olvidó teléfono"*, *"sin batería"*, *"otro"*)
- Registra con `method = 'manual'`
- Queda auditado

---

### 3️⃣ `/sesiones` - Gestión de Sesiones

- Lista de sesiones de sus cohortes
- Acciones: abrir, cerrar, reprogramar, ver asistencia

---

### 4️⃣ `/examenes`, `/examenes/nuevo`, `/examenes/[examId]/editar` - Constructor de Exámenes

```
Título: Diagnóstico de Batería
Módulo: Electricidad ▼
Propósito: evaluacion ▼
Publicado: ○ No / ● Sí

═════════════════════════════════════════

PREGUNTAS (reordenables)

[1] Opción múltiple: "¿Qué es una batería?" (20 pts)
[2] Verdadero/Falso: "El ácido sulfúrico es..." (10 pts)
[3] Redacción abierta: "Explica el proceso..." (20 pts)

┌─────────────────────────────────┐
│ Puntos asignados: 18 / 20      │ ← En rojo si no cuadra
└─────────────────────────────────┘

[PUBLICAR EXAMEN] ← Deshabilitado si no suma exacto
```

**Por cada pregunta:**
- **Opción múltiple:** Enunciado, 2-6 opciones, marcar correcta, puntos
- **Verdadero/falso:** Enunciado, cuál es correcta, puntos
- **Redacción:** Enunciado, rúbrica (opcional), puntos

**Indicador permanente:** `Puntos asignados: X / 20` (configurable)
- Botón **Publicar** deshabilitado si no suma exacto
- Si intenta publicar sin cuadrar, base lo rechaza

---

### 5️⃣ `/calificar` - Cola de Redacciones Abiertas

```
"Explica el proceso de carga de una batería"
Respuesta máxima: 20 puntos

Rúbrica (siempre visible):
├─ Menciona los terminales: 5 pts
├─ Explica polaridad: 5 pts
├─ Identifica químico: 5 pts
└─ Propone medición: 5 pts

RESPUESTA DEL ESTUDIANTE:
"La batería se carga conectando..."

Puntaje: [  ] / 20
Comentario: [                    ]

[GUARDAR Y SIGUIENTE]
```

- Cola de redacciones sin puntaje
- Más antiguas primero
- Enunciado, rúbrica siempre visible, respuesta, campos puntaje y comentario
- Nombre del estudiante visible (no es anónimo)

---

### 6️⃣ `/notas/[cohortId]` - Calificaciones de la Cohorte

Tabla editable:
```
Estudiante    Teoría  Práctica  Part.  Final  Estado
───────────────────────────────────────────────────
Juan López     18      17        16    16,8    ✅
María Pérez    15      16        17    16,0    ✅
Carlos Gómez   12      11        12    11,7    ❌
```

- Tabla editable: uno escribe valores en Teoría, Práctica, Participación
- **Peso de participación:** Control arriba (mínimo 5%, configurable)
- **Nota final y estado:** En gris, calculados por la base de datos, no editables

---

### 7️⃣ `/contenido` - Subir Material

```
Material
[Subir archivo]

Título: [Tipos de baterías]
Módulo: Electricidad ▼
Semana: 2 ▼
Tipo: [PDF ▼]

[○ Publicar ahora / ● En fecha específica]
Si en fecha: [Escoger fecha]

[SUBIR]
```

- Archivo, título, módulo, semana
- Publicar ahora o en fecha específica

---

### 8️⃣ `/evaluar/[sessionId]` - Evaluación de Desempeño (Rúbrica) ⭐ MDV

**Pantalla principal del instructor el sábado. Diseñada para tablet, funcional en teléfono.**

#### Selector de Estudiante (Parte Superior)
```
EVALUACIÓN · Semana 2
Diagnóstico de Batería

Estudiante: [▼ Buscar o seleccionar...]
```

- Dropdown con búsqueda por nombre/cédula
- **Solo muestra estudiantes con `saturday_enabled = true`** (datos de `v_gate_a_status`)
- Si estudiante no habilitado necesita evaluación: mostrar aviso amarillo

#### Rúbrica (Al Seleccionar Estudiante)
```
Rúbrica: Diagnóstico de Batería
Aprueba con: 81 pts

┌─ CRÍTICO ──────────────────────┐
│ 🔴 Usa EPP completo            │
│ ○ CUMPLE  ● NO CUMPLE          │
│ Observación: [_______________] │
└────────────────────────────────┘

┌────────────────────────────────┐
│ Identifica tipo de batería      │
│ ● CUMPLE  ○ NO CUMPLE          │
│ Observación: [_______________] │
└────────────────────────────────┘

Puntaje parcial: 62,5 / 100

⚠️ ÍTEM CRÍTICO FALLIDO
La competencia será REQUIERE REFUERZO

[Grabar video (máx 90 s)]

[GUARDAR EVALUACIÓN]

Intento 2 (el mejor resultado manda)
```

**Comportamiento:**
- Cada criterio: toggle binario CUMPLE / NO CUMPLE (botones 56px)
- Criterios críticos: borde rojo, badge "CRÍTICO"
- Si cualquier crítico está en NO CUMPLE: banner rojo permanente
- Puntaje parcial se calcula en tiempo real: `[suma] / [total_points]`
- Campo de observación opcional debajo de cada criterio

**Evidencia de video:**
- Botón: **Grabar video** (abre cámara nativa)
- Duración máxima: `mdv.video_evidence_max_seconds` (90 s por defecto)
- Se sube al bucket `evidencias` de Supabase Storage
- Botón secundario: **Subir desde galería**
- Si existe: miniatura + botón **Regrabar**

**Al Guardar Evaluación:**
1. Validar que todos los criterios tengan valor
2. Llamar Edge Function `evaluate-performance` con:
   - `session_id`, `student_id`, `learning_guide_id`, `rubric_template_id`
   - Array de `{ criterion_id, meets_criterion, observation }`
   - `video_evidence_url` si existe
3. Trigger `fn_calculate_eval_outcome` calcula el outcome
4. Trigger `fn_sync_mastery` actualiza `mastery_map`
5. Mostrar resultado con color:
   - ✅ Verde: *"DOMINADA — [score] pts"*
   - ⚠️ Ámbar: *"EN DESARROLLO — [score] pts. Puede intentar de nuevo."*
   - ❌ Rojo: *"REQUIERE REFUERZO"* + razón
6. Limpiar formulario para siguiente estudiante

---

### 9️⃣ `/defensa/[evaluationId]` - Defensa Técnica ⭐ MDV

```
DEFENSA TÉCNICA
María López · Diagnóstico de Batería
Evaluación: 92 pts · DOMINADA

┌────────────────────────────────┐
│   SORTEAR PREGUNTAS            │
│ Se elegirán 3 preguntas al azar│
└────────────────────────────────┘
```

**Después de tocar Sortear:**

```
Pregunta 1 de 3 ─── Tiempo: 02:34

¿Qué sucede si conectas el cargador
con la polaridad invertida?

Nota del instructor:
[________________________________]
[________________________________]

[Anterior] ────────── [Siguiente]
```

**Temporizador:** Esquina superior derecha
- Formato: `MM:SS`
- Color: `--zr-navy`
- A los 5 min cambia a `--zr-warning`
- Informativo, no bloquea

**Selector de Nivel (Parte Inferior):**
```
NIVEL ALCANZADO

○ Nivel 1 — Acepta o rechaza sin explicar
○ Nivel 2 — Identifica 2-3 errores
○ Nivel 3 — Identifica 4+ errores, incluyendo seguridad
○ Nivel 4 — Identifica 5-6 errores, propone medición

⚠️ Nivel 1 bloquea la competencia

[REGISTRAR DEFENSA]
```

**Advertencia Nivel 1:** Si se selecciona, banner rojo:
*"Defensa nivel 1 — la competencia será REQUIERE REFUERZO sin importar el puntaje de la rúbrica."*

**Al Registrar:**
1. Validar que se haya seleccionado un nivel
2. Llamar Edge Function `grade-defense` con:
   - `evaluation_id`, `questions_drawn`, `responses`, `level_achieved`, `duration_seconds`
3. Mostrar confirmación y navegar de vuelta a `/evaluar/[sessionId]`

---

### 🔟 `/compuerta/[sessionId]` - Estado de Compuerta A ⭐ MDV

**Panel de solo lectura. La compuerta es automática, no se modifica manualmente.**

```
COMPUERTA A · Sábado 15 de agosto
Semana 2 · Diagnóstico de Batería
18 de 24 habilitados

Nombre          Act.   Auto  Duda  Sáb
────────────────────────────────────
López, M.      5/5    6/8    ✓    🟢
Pérez, J.      5/5    7/8    ✓    🟢
Gómez, A.      3/5     —     ✗    🔴
Rivas, C.      5/5    4/8    ✓    🔴
```

| Columna | Fuente (`v_gate_a_status`) | Nota |
|---|---|---|
| Nombre | `full_name` | |
| Actividades | `activities_completed` / `activities_required` | |
| Autochequeo | `self_check_score` / 8 (o `—` si no presentado) | |
| Duda | `doubt_submitted` → ✓ o ✗ | |
| Sábado | `saturday_enabled` → 🟢 o 🔴 | Verde: habilitado, Rojo: no |

**Orden:** Habilitados arriba, no habilitados abajo. Dentro de cada grupo: alfabético.
**Acciones:** Ninguna. Es informativa.

---

### 1️⃣1️⃣ `/roles/[sessionId]` - Asignación de Roles del Taller ⭐ MDV

```
ROLES DEL TALLER · Semana 2

[ASIGNAR ROLES AUTOMÁTICAMENTE]
Se asignarán 4 roles por estación

═══════════════════════════════════════

ESTACIÓN 1
🔧 Operador:      López, M.
🔍 Inspector:     Pérez, J.
📝 Documentador:  Gómez, A.
🛡️ Seguridad:     Rivas, C.

ESTACIÓN 2
🔧 Operador:      Torres, L.
...
```

**Al tocar Asignar:**
- Edge Function `assign-workshop-roles` con `session_id`
- Distribuye estudiantes `saturday_enabled = true` en estaciones de 4
- Asigna roles rotativos (si tuvo rol la semana anterior, no repite)
- Inserta en `workshop_role_assignments`

**Intercambio manual:**
- Al tocar nombre: selector con demás de la misma estación
- Al seleccionar otro: se intercambian los roles
- Edge Function actualiza `workshop_role_assignments`

**Estados:**
- Antes de asignar: *"Los roles aún no se han asignado. Toca el botón..."*
- Asignando: Spinner en botón
- Error: *"No se pudo asignar roles. Intenta de nuevo."*

---

### 1️⃣2️⃣ `/heatmap` - Mapa de Calor de Errores ⭐ MDV

```
MAPA DE CALOR DE ERRORES
Criterios con más fallos

Criterio             Comp.    Fallos  Tasa
───────────────────────────────────────
🔴 Usa EPP           Bater.   12/15   80%
🔴 Desconecta neg.   Bater.    8/15   53%
   Mide densidad     Bater.    5/15   33%
   Identifica tipo   Bater.    2/15   13%
```

| Columna | Fuente (`v_error_heatmap`) |
|---|---|
| Criterio | `criterion` (con 🔴 si `is_critical`) |
| Competencia | `competency` (abreviada en móvil) |
| Fallos | `times_failed` / `times_evaluated` |
| Tasa | `failure_rate` con sufijo `%` |

**Colores de tasa:**
- ≥ 50%: Texto en `--zr-error` (rojo)
- 25–49%: Texto en `--zr-warning` (amarillo)
- < 25%: Texto en `--zr-navy`

**Ítems críticos:**
- Fondo tenue rojo (10% opacidad)
- Indicador 🔴 delante del nombre

**Orden:** Por `failure_rate` descendente. Críticos siempre arriba.

---

## ADMINISTRACIÓN: FLUJO COMPLETO

### 1️⃣ `/panel` - Panel de Inicio

```
ESTUDIANTES ACTIVOS
102

CONSENTIMIENTOS PENDIENTES
5 ← En rojo si hay alguno

ASISTENCIA ÚLTIMO SÁBADO
96%

EXÁMENES SIN CALIFICAR
8
```

Cuatro tarjetas con números grandes.

---

### 2️⃣ `/estudiantes` - Gestión de Estudiantes

**Tabla con buscador:**

```
[Buscar por nombre o cédula...]

Filtros:
[Todas las cohortes ▼] [Todos ▼] [Todos ▼]

Nombre             Cédula        Edad  Cohorte  Estado       Consentimiento
────────────────────────────────────────────────────────────────────────────
López, Juan        V-30000001    17    2A       Activo       Pendiente
Pérez, María       V-30000002    18    2A       Activo       OK
Gómez, Carlos      V-30000003    16    2B       Suspendido   OK
```

**Columnas:** Nombre, Cédula, Edad, Cohorte, Estado, Consentimiento
**Filtros:** Cohorte, Estado, Menores de edad
**Acciones:** Ver, editar, cambiar cohorte, suspender
**Botones:** **Nuevo estudiante**, **Cargar CSV**

**Carga por CSV:**
Columnas exactas (en este orden):
```
nombre_completo,cedula,fecha_nacimiento,correo_contacto,telefono,cohorte
```

- Muestra vista previa con errores marcados por fila
- **Todo o nada:** O entra todo el archivo o no entra nada

---

### 3️⃣ `/consentimientos` - Gestión de Consentimientos

**Cola de `v_students_blocked` (menores sin consentimiento o sin verificar):**

```
Por cada menor:

Juan López, 17 años
Cédula del representante: V-12345678
Correo: representante@email.com
Estado: Falta consentimiento

[Documento adjunto: consentimiento.pdf]

[VERIFICAR]
```

- Esta pantalla evita incumplimiento LOPNNA
- Aviso en `/panel` si hay pendientes
- Imposible de ignorar

---

### 4️⃣ `/cohortes` - Gestión de Cohortes

- Crear cohortes
- Asignar profesor y salón
- Avanzar de módulo (requiere confirmación explícita)
- Ver estudiantes

---

### 5️⃣ `/reportes` - Reportes Generales

Cuatro reportes, todos con botón **Exportar a CSV:**

1. **Asistencia por cohorte y sesión**
2. **Avance académico:** Aprobados, reprobados, en curso por módulo
3. **Uso del repositorio:** Qué material se abre y cuál no
4. **Exámenes pendientes:** Con antigüedad en horas

---

### 6️⃣ `/reportes/mdv` ⭐ - Reportes MDV (Admin)

**Cinco reportes específicos de MDV, todos con **Exportar a CSV**:**

#### 1. Dominio al Primer Intento
```
68% DOMINAN AL PRIMER INTENTO
(Competencias donde last_eval_attempt = 1)
```
- Agrupado por módulo y cohorte
- Cifra grande en verde (`--zr-success`)

#### 2. Intentos Hasta Dominio
```
Competencia            Promedio  Mín.  Máx.
─────────────────────────────────────
Ley de Ohm             1.2       1     2
Diagnóstico Batería    1.8       1     3
Sistema de Carga       2.1       1     4
```
- Promedio de `attempt_number` en evaluación con `outcome = 'dominada'`
- Datos de `performance_evaluations`

#### 3. Fallos en Ítems Críticos
```
Criterio             Instructor  Fallos  Tasa
────────────────────────────────────────
Usa EPP              Pérez, J.   8/12    67%
Usa EPP              López, M.   4/12    33%
```
- Agrupa `v_error_heatmap` por instructor
- Identifica si un instructor evalúa diferente a otro

#### 4. Retención Diferida
```
[Gráfico]
Puntaje original vs. Retención Semana 6 vs. Retención Semana 12
```
- Compara puntajes de exámenes con `exam_purpose = 'retencion'`
- Semanas 6 y 12 contra puntaje original de desempeño
- Solo se muestra si hay datos

#### 5. Cumplimiento de Compuerta A
```
Fecha Sesión    Habilitados  Total  Porcentaje
─────────────────────────────────
Sáb 15 ago      18           24     75%
Sáb 22 ago      21           24     87%
```
- Datos de `weekly_progress`: % de `saturday_enabled = true` por sesión

**Filtros comunes:**
- Selector de cohorte
- Selector de módulo
- Rango de fechas

**Estados:**
- Sin datos: *"No hay datos suficientes para este reporte."*
- Cargando: Esqueleto + *"Generando reporte..."*

---

### 7️⃣ `/configuracion` (Solo `super_admin`) ⭐

Tabla editable de `system_config`:

```
Clave                            Descripción                  Valor Actual  Editado por
───────────────────────────────────────────────────────────────────────────
mdv.self_check_threshold         Mínimo autochequeo (de 8)    [5    ]       Ana García
mdv.gate_close_time              Hora cierre compuerta (24h)  [22:00]       Ana García
mdv.rubric_passing_score         Nota aprobación (0-100)      [81   ]       Ana García
mdv.defense_questions_draw       Preguntas sorteadas          [3    ]       Admin
```

- Por cada clave: descripción, valor actual (editable), quién cambió por última vez
- Historial de cambios debajo

**Regla de oro:** *"Toda la aplicación lee de aquí. Cambiar un umbral es editar una fila, no desplegar código."*

---

## DIRECTIVAS: VISTA GENERAL

**Rol `super_admin` tiene acceso a todo lo de Admin, más `/configuracion`.**

La dirección académica accede a:
- Dashboard de reportes
- Control de configuración de umbrales
- Auditoría de consentimientos
- Exportación de datos

---

## ESPECIFICACIONES DE DISEÑO

### Paleta de Colores (Manual de Identidad ZR Mecademy 2025)

| Nombre | Hex | Uso |
|---|---|---|
| Navy (Principal) | `#21284F` | Barras, texto principal |
| Azul de Marca | `#3869B1` | Logo, botón primario |
| Azul Claro (Informativo) | `#98BAE3` | Fondos de tarjeta, franjas info |
| Verde (Éxito) | `#16A34A` | Aprobado, registrado, dominado |
| Amarillo (Advertencia) | `#EAB308` | Ya registrado, en progreso |
| Rojo (Error) | `#DC2626` | Código vencido, reprobado, crítico |
| Fondo de Página | `#F5F7FB` | Canvas |
| Blanco | `#FFFFFF` | Superficies |
| Borde Tenue | `#C9D6EA` | Divisiones |

### Tipografía

| Contexto | Familia | Tamaño | Peso |
|---|---|---|---|
| Título pantalla | Raleway | 24 px | 700 |
| Nota grande, resultado | Raleway | 40 px | 700 |
| Subtítulo | Raleway | 20 px | 600 |
| Texto general, botones | Roboto | 16 px | 400 |
| Etiqueta de campo | Roboto | 14 px | 500 |
| **Mínimo absoluto** | — | **14 px** | — |

### Componentes

| Elemento | Medida | Nota |
|---|---|---|
| Botón altura | 56 px | Mínimo, uso con guantes |
| Área táctil mínima | 48 × 48 px | WCAG |
| Texto mínimo | 16 px | 14 px solo etiquetas |
| Contraste | 4.5:1 mínimo | WCAG AA |
| Radio esquinas | 12 px | Tarjetas, modales |
| Ancho referencia | 360 px | Diseña primero aquí |
| Relleno página | 16 px | Margen exterior |

### Iconografía

`lucide-react`, local. Trazo 2 px, mínimo 24 px (32 px en acciones principales).

| Concepto | Icono |
|---|---|
| Carnet / inicio | `IdCard` |
| Semana / calendario | `Calendar` |
| Exámenes | `ClipboardList` |
| Material | `BookOpen` |
| Escanear | `ScanLine` |
| Progreso / dominio | `Target` |
| Próximo sábado | `CalendarClock` |
| Refrigerio | `Coffee` |
| Aprobado | `CircleCheck` |
| Error | `CircleAlert` |

### Voz y Tono

| Regla | Sí | No |
|---|---|---|
| Tuteo | *"Ya tienes nota"* | *"Usted tiene una calificación"* |
| Español Venezuela | *"Tu profesor habilitó..."* | Regionalismos forzados |
| Errores claros | *"El código venció..."* | *"Error 403: token inválido"* |
| Sin jerga | *"No hay internet. Se guardó..."* | *"Fallo de sincronización"* |
| Celebra logros | *"Dominaste batería"* | *"¡Iniciaste sesión! 🎉"* |
| Sin culpa al usuario | *"No encontramos esa cédula"* | *"Escribiste mal"* |

**Formato local:**
- Decimal: coma (16,5)
- Fechas: `sáb 15 ago 2026`
- Horas: 24 h (08:30)
- Cédula: con guion (V-30000001)

---

## CHECKLIST DE VERIFICACIÓN

Antes de dar por terminada cada pantalla, verificar:

- [ ] Compila sin errores (`npm run typecheck`)
- [ ] RLS habilitado en todas las tablas (estudiante A no ve datos de B)
- [ ] `npm run test:rls` pasa
- [ ] `npm run test` pasa
- [ ] Camino feliz y camino de error funcionan
- [ ] Funciona en pantalla de 360 px (teléfono, no solo desktop)
- [ ] Si toca MDV: triggers y Edge Functions funcionan correctamente
- [ ] Ningún número de negocio está hardcodeado (todo de `system_config`)
- [ ] Se probó en Android e iPhone reales (si incluye cámara)

**Comando único:**
```bash
npm run verify
```

---

## MAPEO DE TABLAS Y VISTAS

| Pantalla | Lee de | Escribe en |
|---|---|---|
| `/carnet` | `v_proximo_sabado`, `v_pasaporte_mdv`, `students`, `totp_secrets` | — |
| `/semana` | `weekly_activities`, `activity_completions`, `weekly_progress` | Edge Function `complete-activity` |
| `/semana/[activityId]` | `content_config`, `question_banks` | `activity_completions`, `ia_declarations` |
| `/pasaporte` | `v_pasaporte_mdv` | — |
| `/examenes` | `exams`, `exam_attempts` | — |
| `/examenes/[examId]` | `v_exam_questions_student` ⚠️ NO `exam_questions` | `exam_answers` vía Edge Function |
| `/evaluar/[sessionId]` | `v_gate_a_status`, `rubric_templates`, `rubric_criteria` | Edge Function `evaluate-performance` |
| `/defensa/[evaluationId]` | `defense_questions` | Edge Function `grade-defense` |
| `/heatmap` | `v_error_heatmap` | — |
| `/escanear/[sessionId]` | `sessions`, `attendance` | Edge Function `validate-scan` / `claim-snack` |

---

## MIGRACIÓN 015: Tablas Nueva MDV

```sql
-- Tablas nuevas (todas con RLS)
- weekly_activities
- activity_completions
- weekly_progress
- rubric_templates
- rubric_criteria
- performance_evaluations
- eval_criteria_results
- defense_questions
- technical_defenses
- reflection_tickets
- workshop_role_assignments
- ia_declarations

-- Tablas existentes modificadas
- exams: + campo exam_purpose
- mastery_map: + enum requiere_refuerzo

-- Vistas nuevas
- v_pasaporte_mdv
- v_gate_a_status
- v_error_heatmap
```

Todas implementadas en `/supabase/migrations/015_mdv_integration.sql`.

---

## PRÓXIMOS PASOS

1. **Leer este informe línea por línea** — cada pantalla tiene especificación exacta
2. **Implementar en orden de tareas:** `SPRINT_MDV_0.md` → `SPRINT_MDV_3.md`
3. **Probar cada pantalla** en teléfono real (Android + iPhone)
4. **Pasar `npm run verify`** antes de cada commit
5. **Entregar 25 de agosto 2026**

---

**Documento preparado por:** Claude (AI Agent)  
**Para:** ZR Mecademy - Academia Técnica Automotriz  
**Estado:** Especificación Ejecutable v1.0
