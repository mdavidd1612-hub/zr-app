# DOCUMENTO TÉCNICO DE ARQUITECTURA
## Modelo de Dominio Verificado (MDV) — Sistema Unificado Low-Code
### MVP en 1 Semana | Agosto 2026

---

## 1. RESUMEN EJECUTIVO

Este documento especifica la arquitectura, modelo de datos y plan de implementación para unificar todo el ecosistema MDV en **una sola aplicación software**, construida con enfoque **low-code** en un lapso de **5 días hábiles**.

**Decisión clave:** El trabajo digital (lunes-viernes) vale 0% de la nota y habilita la compuerta del sábado. El sábado presencial vale 100%. Esta regla se implementa como lógica de negocio inviolable en el backend.

---

## 2. STACK LOW-CODE RECOMENDADO

| Capa | Tecnología | Justificación | Costo |
|:---|:---|:---|:---|
| **Base de Datos & Auth** | **Supabase** (PostgreSQL) | Auth, RLS, Storage, Edge Functions, realtime. API auto-generada. | Gratis / $25 |
| **App Estudiante** | **FlutterFlow** | Genera web + mobile nativo. Templates educativos. Conector nativo Supabase. | $50-70/mes |
| **Panel Instructor/Admin** | **FlutterFlow** (rol admin) o **Retool** | Mismo proyecto FF con rutas por rol, o Retool para tablas rápidas. | $0-50 |
| **Videos & H5P** | Vimeo Pro + H5P self-hosted | Embed seguro con domain restriction. H5P en subdominio propio. | $20/mes |
| **Simulador** | Electude API o H5P branching | Integración vía iframe con paso de contexto (user_id, caso_id). | Licencia existente |
| **IA Tutor / Auditoría** | OpenAI GPT-4o via **Supabase Edge Function** | Prompts controlados, temperatura 0.2, system prompt fijo. Nunca entrega respuesta completa. | Pay-per-use |
| **Videollamada Jueves** | Whereby o Daily.co | Embed en app, sala fija por grupo, sin instalaciones. | $0-10 |
| **Notificaciones** | OneSignal + Supabase Triggers | Push y email para compuertas, recordatorios, resultados. | Gratis |
| **Pasaporte PDF** | PDF-lib (Edge Function) | Generación de pasaporte de competencias firmado digitalmente. | $0 |

**Alternativa ultra-low-code (si no hay desarrollador mobile):**
Usar **Directus** como plataforma única. En 3 días se tiene el backend + panel admin + APIs. El estudiante accede via app web progresiva (PWA) generada desde Directus o una template de FlutterFlow ligera.

---

## 3. MODELO DE DATOS (Supabase PostgreSQL)

### 3.1 Tablas Core

```sql
-- Usuarios (extiende auth.users)
profiles (
  id uuid references auth.users,
  rol enum('estudiante','instructor','coordinador','admin'),
  nombre text,
  programa_id uuid,
  grupo_id uuid,
  activo boolean default true
);

-- Programas y Módulos
programas (
  id uuid primary key,
  nombre text, -- "Mecánica Automotriz"
  especialidad text
);

modulos (
  id uuid primary key,
  programa_id uuid,
  nombre text, -- "Sistema de carga y arranque"
  duracion_semanas int,
  activo boolean
);

-- Competencias (el mapa)
competencias (
  id uuid primary key,
  modulo_id uuid,
  codigo text, -- "C1", "C2"
  descripcion text, -- verbo observable
  semana int,
  depende_de uuid[], -- array de competencias prerequisito
  puntos_criticos text[] -- ítems que no promedian
);

-- Semanas y Días (carril abierto)
semanas (
  id uuid primary key,
  modulo_id uuid,
  numero int,
  competencias_ids uuid[]
);

dias_carril_abierto (
  id uuid primary key,
  semana_id uuid,
  dia enum('lunes','martes','miercoles','jueves','viernes'),
  tipo enum('microleccion','simulacion','clinica','autochequeo'),
  duracion_min int,
  nivel_ia enum('N0','N1','N2','N3'),
  contenido jsonb, -- URLs videos, preguntas, simulador config
  obligatorio boolean,
  compuerta_a_requisito boolean -- si es necesario para entrar sábado
);

-- Microlecciones y preguntas incrustadas (H5P-like)
microlecciones (
  id uuid primary key,
  dia_id uuid,
  orden int,
  titulo text,
  video_url text,
  duracion_seg int
);

preguntas_incrustadas (
  id uuid primary key,
  microleccion_id uuid,
  tiempo_aparicion_seg int, -- a los 180 segundos
  enunciado text,
  opciones jsonb,
  respuesta_correcta text,
  feedback_incorrecto text -- "Revisa del minuto 2:15 al 3:00"
);

-- Dudas obligatorias (miércoles)
dudas (
  id uuid primary key,
  estudiante_id uuid,
  semana_id uuid,
  texto text,
  creado_en timestamp,
  resuelta_en timestamp,
  respondida_por uuid -- instructor
);

-- Compuerta A: Tracking semanal del estudiante
seguimiento_semanal (
  id uuid primary key,
  estudiante_id uuid,
  semana_id uuid,
  estado enum('en_progreso','completado','incompleto','refuerzo'),
  progreso_porcentaje int,
  autochequeo_score int, -- 0-8
  compuerta_a_cerrada boolean, -- viernes 22:00
  habilitado_sabado boolean, -- calculado
  intentos_autochequeo int,
  duda_enviada boolean
);

-- SÁBADO: Carril Seguro
jornadas_sabado (
  id uuid primary key,
  modulo_id uuid,
  semana_id uuid,
  fecha date,
  max_estudiantes int default 20,
  instructores_ids uuid[],
  estado enum('programada','en_curso','cerrada')
);

inscripciones_sabado (
  id uuid primary key,
  jornada_id uuid,
  estudiante_id uuid,
  estado enum('confirmado','refuerzo','no_evalua','ausente'),
  compuerta_a_cumplida boolean -- bloqueo estricto
);

-- Control de entrada (sábado 08:00)
controles_entrada (
  id uuid primary key,
  jornada_id uuid,
  estudiante_id uuid,
  preguntas jsonb, -- 8 preguntas sorteadas de banco
  respuestas jsonb,
  score int, -- 0-8
  aprobado boolean, -- no es nota, es requisito para continuar
  iniciado_en timestamp,
  entregado_en timestamp
);

-- Casos de taller
casos_taller (
  id uuid primary key,
  semana_id uuid,
  sintoma text,
  restriccion text,
  instrumentos text[],
  criterio_exito text,
  trampa_deliberada text,
  solucion_json jsonb
);

-- Listas de cotejo (evaluación sábado)
listas_cotejo (
  id uuid primary key,
  competencia_id uuid,
  caso_taller_id uuid,
  items jsonb -- [{"item": "Retira anillos...", "critico": true, "orden": 1}]
);

evaluaciones_desempeno (
  id uuid primary key,
  jornada_id uuid,
  estudiante_id uuid,
  competencia_id uuid,
  lista_cotejo_id uuid,
  intento_numero int,
  items_evaluados jsonb, -- [{"item_id": "", "cumple": true/false, "observacion": ""}]
  puntos_criticos_ok boolean, -- SI UNO FALLA = NO DOMINADA
  estado enum('dominada','en_desarrollo','requiere_refuerzo'),
  video_ejecucion_url text, -- 60-90 segundos
  instructor_id uuid,
  evaluado_en timestamp
);

-- Defensa técnica (3 preguntas sorteadas de 10)
bancos_defensa (
  id uuid primary key,
  competencia_id uuid,
  pregunta text,
  nivel enum('1','2','3','4') -- nivel de respuesta esperado
);

defensas_tecnicas (
  id uuid primary key,
  evaluacion_id uuid,
  preguntas_sorteadas uuid[], -- 3 IDs
  respuestas jsonb,
  nivel_alcanzado enum('1','2','3','4'),
  instructor_id uuid,
  duracion_seg int
);

-- Pasaporte de competencias (vista acumulativa)
pasaportes (
  id uuid primary key,
  estudiante_id uuid,
  modulo_id uuid,
  competencias jsonb -- {"C1": {"estado": "verde", "intento": 1, "fecha": "..."}, ...}
);

-- Auditoría de IA (Nivel 4, semana 4)
auditorias_ia (
  id uuid primary key,
  estudiante_id uuid,
  modulo_id uuid,
  diagnostico_ia text, -- el texto con errores deliberados
  errores_detectados jsonb, -- [{"error": "", "por_que": "", "medicion": ""}]
  nivel enum('1','2','3','4'),
  evaluado_en timestamp
);

-- Prueba de retención (semanas 6 y 12)
pruebas_retencion (
  id uuid primary key,
  estudiante_id uuid,
  modulo_id uuid,
  semana_aplicacion int, -- 6 o 12
  contenido_referencia uuid[], -- semanas evaluadas
  parte_practica jsonb,
  parte_razonamiento jsonb,
  score_practica int,
  score_razonamiento int,
  aplicada_en timestamp,
  sin_acceso boolean default true -- sin dispositivos, sin IA
);

-- Tickets de reflexión (cierre sábado)
tickets_reflexion (
  id uuid primary key,
  estudiante_id uuid,
  jornada_id uuid,
  antes_pensaba text,
  ahora_entiendo text,
  mayor_error text,
  proxima_vez text,
  creado_en timestamp
);

-- Declaración de uso de IA (Nivel 3)
declaraciones_ia (
  id uuid primary key,
  estudiante_id uuid,
  tarea_id uuid,
  herramienta text,
  pregunta_hecha text,
  respuesta_entregada text,
  aceptado_porque text,
  corregido_porque text,
  verificacion text, -- ficha fabricante, medición, norma
  decision_propia text
);

-- Roles rotativos sábado
roles_sabado (
  id uuid primary key,
  jornada_id uuid,
  estacion int,
  estudiante_id uuid,
  rol enum('operador','inspector_calidad','documentador','responsable_seguridad'),
  rotacion int -- 1 o 2
);

-- Notificaciones y Compuertas
notificaciones (
  id uuid primary key,
  usuario_id uuid,
  tipo enum('compuerta_cierre','recordatorio','resultado','alerta_seguridad'),
  mensaje text,
  leida boolean,
  creado_en timestamp
);
```

### 3.2 Row Level Security (RLS) — Reglas críticas

```sql
-- Estudiante solo ve sus propios datos
ALTER TABLE evaluaciones_desempeno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estudiante_own_eval" ON evaluaciones_desempeno
  FOR SELECT USING (auth.uid() = estudiante_id);

-- Instructor ve solo su grupo/jornada
CREATE POLICY "instructor_group" ON evaluaciones_desempeno
  FOR ALL USING (auth.uid() = ANY(instructor_id));

-- Compuerta A: nadie puede editar manualmente 'habilitado_sabado' a true si no cumple reglas
-- Se valida via Edge Function o Trigger
```

---

## 4. ARQUITECTURA DE FLUJOS

### 4.1 Flujo Semanal del Estudiante (Carril Abierto)

```
LUNES 20min → App muestra "Micro 1 y 2" → Video con preguntas incrustadas (H5P embed)
              → Respuestas guardadas en 'respuestas_microleccion'
              → IA Tutor disponible (N1): Edge Function /tutor con system prompt restrictivo

MARTES 20min → Micro 3 + Simulador (Electude iframe con token de sesión)
              → Registro de intentos en simulador

MIÉRCOLES 25min → Caso simulado + DUDA OBLIGATORIA
                 → Input de texto bloqueante. No puede marcar día como completado sin duda.
                 → Duda alimenta dashboard del instructor para Jueves

JUEVES 45-60min → Videollamada (Whereby embed) → "Clínica de errores"
                 → Instructor entra con data: qué falló el grupo, qué dudas hay
                 → Wooclap embed para respuestas anónimas en vivo

VIERNES 15min → Autochequeo (8 preguntas, N0, sin material)
               → Sistema evalúa automáticamente
               → 22:00 Trigger cierra compuerta (seguimiento_semanal.compuerta_a_cerrada = true)
               → Si completado + autochequeo ≥ 5/8 → habilitado_sabado = true
               → Si incompleto → estado = 'refuerzo', no evalúa desempeño sábado
```

### 4.2 Flujo Sábado (Carril Seguro)

```
08:00 → Control de entrada (8 preguntas, app en modo kiosk/sin salida)
        → Timer 20 min. Sin copiar/pegar. Sin cambiar de app.
        → Score inmediato. Si < 4/8 → Clínica de errores prioritaria.

08:20 → Clínica de errores (instructor proyecta fallos del grupo)
        → App instructor muestra heatmap de errores del control

08:45 → Demo mínima (video o instructor presencial)

09:05 → Taller Estaciones (4 estaciones × 4 estudiantes)
        → App asigna roles rotativos automáticamente
        → Inspector de calidad usa app para checklist rápido
        → Responsable seguridad confirma protocolos en app antes de iniciar

14:00 → Desempeño observado (1 estudiante, 1 instructor, 1 competencia)
        → Instructor usa app en tablet: lista de cotejo digital
        → Punto crítico = toggle especial. Si NO → competencia = 'requiere_refuerzo' automático
        → Estudiante graba video 60-90 seg desde app (cámara nativa, sube a Storage)

15:30 → Defensa técnica (5 min)
        → App sortea 3 preguntas de banco de 10
        → Instructor califica nivel 1-4 en app
        → Si defensa nivel 1 o punto crítico mal → NO DOMINADA

16:30 → Ticket de reflexión (3 min)
        → Formulario obligatorio: antes pensaba / ahora entiendo / mi error / próxima vez
        → Sellado digital de competencias en pasaporte
```

### 4.3 Estados de Competencia

| Estado | Condición técnica | Acción automática |
|:---|:---|:---|
| **DOMINADA** | Lista ≥ 90% + defensa nivel 3/4 + puntos críticos OK | Pasaporte verde. Avanza a siguiente. |
| **EN DESARROLLO** | Puntos críticos OK, pero lista incompleta o defensa nivel 2 | Pasaporte amarillo. Reintento programado. |
| **REQUIERE REFUERZO** | Punto crítico falla o defensa nivel 1 | Pasaporte rojo. Refuerzo obligatorio. No avanza. |

---

## 5. MÓDULOS DEL SOFTWARE (Mapeo MDV)

### Módulo 1: Gestión Académica (Admin/Coordinación)
- CRUD de programas, módulos, competencias, semanas
- Asignación de instructores a jornadas
- Configuración de puntos críticos por lista de cotejo
- Reporte de retención (semanas 6 y 12)

### Módulo 2: Experiencia del Estudiante (App)
- Dashboard "Lo de hoy": una sola pantalla con la tarea del día
- Reproductor de microlecciones con pausas forzadas
- Simulador integrado (iframe con paso de estado)
- Formulario de dudas obligatorio
- Autochequeo con temporizador
- Pasaporte visual (verde/amarillo/rojo)

### Módulo 3: Modo Taller (Sábado)
- Check-in digital con geolocalización (opcional) o código QR
- Control de entrada: modo examen (fullscreen, sin salir)
- Asignación automática de roles y estaciones
- Lista de cotejo digital con puntos críticos destacados
- Grabación de video de ejecución (nativo)
- Defensa técnica: sorteo de preguntas + registro de respuestas
- Ticket de reflexión

### Módulo 4: IA con Límites (Tutor + Auditoría)
- **Tutor N1/N2**: Edge Function `/tutor` con prompt:
  ```
  Eres un instructor de mecánica automotriz. 
  NUNCA des la respuesta completa. 
  SIEMPRE responde con una pregunta guía o una pista. 
  Si el estudiante no ha intentado nada, insiste en que intente primero.
  ```
- **Auditoría N4**: Endpoint `/auditoria` entrega diagnóstico con errores. Estudiante responde estructurado. Sistema califica automáticamente con rubrica.

### Módulo 5: Analítica e Informes
- Dashboard instructor: heatmap de errores, estudiantes en riesgo
- Pasaporte descargable (PDF)
- Evidencias: videos de ejecución, defensas, tickets
- Métrica clave: "Retención a 6 semanas" vs "Rendimiento asistido"

---

## 6. PLAN DE IMPLEMENTACIÓN: 1 SEMANA

### DÍA 1 — LUNES: Fundamentos y Datos
**Objetivo:** Backend operativo con datos de prueba.

| Hora | Tarea | Entregable |
|:---|:---|:---|
| 0-2h | Setup Supabase proyecto. Auth habilitado. | Proyecto Supabase live |
| 2-4h | Crear tablas core (SQL anterior). Relaciones y enums. | Esquema completo en Supabase |
| 4-6h | Seed data: Módulo piloto completo (4 semanas, 9 competencias, microlecciones, bancos de defensa, casos de taller). | Datos de prueba realistas |
| 6-8h | RLS básicas. Storage buckets: videos, evidencias, pasaportes. | Seguridad inicial |

### DÍA 2 — MARTES: App Estudiante (FlutterFlow)
**Objetivo:** Carril abierto navegable.

| Hora | Tarea | Entregable |
|:---|:---|:---|
| 0-2h | Nuevo proyecto FlutterFlow. Conectar Supabase. Auth login. | App base con login |
| 2-4h | Pantalla "Mi Semana": lista de días, progreso, estado de compuerta. | Dashboard estudiante |
| 4-6h | Pantalla de microlección: reproductor video + preguntas incrustadas (simulado con formulario FF). | Flujo lunes-martes |
| 6-8h | Pantalla de duda obligatoria (miércoles) + autochequeo (viernes). | Flujo miércoles-viernes |

### DÍA 3 — MIÉRCOLES: Modo Taller y Evaluación
**Objetivo:** Sábado digitalizado.

| Hora | Tarea | Entregable |
|:---|:---|:---|
| 0-2h | Pantalla Control de Entrada: 8 preguntas, timer, modo fullscreen. | Examen sábado AM |
| 2-4h | Pantalla Lista de Cotejo: items checkables, puntos críticos en rojo, alerta si se marca NO en crítico. | Evaluación instructor |
| 4-6h | Pantalla Defensa: sorteo de 3 preguntas de 10. Registro de calificación 1-4. | Defensa técnica |
| 6-8h | Subida de video de ejecución (cámara nativa → Supabase Storage). | Evidencia digital |

### DÍA 4 — JUEVES: IA, Compuertas y Automatizaciones
**Objetivo:** Lógica de negocio inteligente.

| Hora | Tarea | Entregable |
|:---|:---|:---|
| 0-2h | Supabase Edge Function `/tutor`: integración OpenAI con prompt restrictivo (pistas, no respuestas). | Tutor IA operativo |
| 2-4h | Edge Function `/auditoria`: genera diagnóstico con errores, recibe respuesta, califica nivel 1-4. | Auditoría IA N4 |
| 4-6h | Trigger/Function "Cierre de Compuerta": viernes 22:00 evalúa progreso y setea `habilitado_sabado`. | Compuerta A automática |
| 6-8h | Trigger post-evaluación: si punto crítico = false → estado = 'requiere_refuerzo'. | Compuerta B automática |

### DÍA 5 — VIERNES: Pasaporte, Panel Admin y Deploy
**Objetivo:** Sistema cerrado y desplegado.

| Hora | Tarea | Entregable |
|:---|:---|:---|
| 0-2h | Pantalla Pasaporte: grid de competencias con colores y fechas. | Pasaporte visual |
| 2-4h | Edge Function `/pasaporte-pdf`: genera PDF con evidencias. | Pasaporte descargable |
| 4-6h | Panel Instructor (Retool o pantallas admin en FF): jornadas del sábado, asignación de roles, heatmap de errores. | Panel de gestión |
| 6-8h | Testing end-to-end con datos de prueba. Deploy web. APK generada (opcional). | MVP en producción |

### FIN DE SEMANA (Opcional): Pulido
- Integración real con H5P (iframe + postMessage)
- Configuración de videollamada Whereby
- Notificaciones push con OneSignal
- Carga de videos reales al storage

---

## 7. ESPECIFICACIÓN DE IA POR NIVEL

### N0 — Sin IA
- Implementación: App en modo "kiosk" el sábado. Edge Function bloquea acceso a `/tutor`.
- Jueves en vivo: videollamada con instructor humano.
- Viernes: autochequeo sin acceso a tutor.

### N1 — IA como Tutor
- Endpoint: `POST /tutor`
- Body: `{"pregunta": "...", "contexto": "microleccion_C2", "historial": []}`
- System Prompt:
```
Eres un instructor senior de mecánica automotriz. 
REGLAS:
1. NUNCA des la respuesta completa o el procedimiento paso a paso.
2. SIEMPRE guía con una pregunta o una analogía.
3. Si el estudiante no ha intentado resolver, dile: "Inténtalo primero y dime dónde te atoras."
4. Máximo 3 intercambios por tema. Luego deriva al instructor humano.
5. Nivel de detalle: pista escrita de máximo 2 oraciones.
```

### N2 — IA como Asistente
- Permite organizar información, pero exige verificación.
- En app: checkbox "Verifiqué contra ficha del fabricante" obligatorio antes de entregar.

### N3 — IA como Copiloto
- Formulario obligatorio de declaración de uso (tabla `declaraciones_ia`).
- Sin declaración, la entrega se bloquea.

### N4 — IA como Objeto de Auditoría
- Endpoint: `POST /auditoria/evaluar`
- El estudiante recibe texto base (diagnóstico con 6 errores).
- Responde estructurado: array de errores detectados.
- Sistema califica:
  - Nivel 4: 5-6 errores, identifica el de seguridad, propone medición para cada uno.
  - Nivel 3: 4 errores incluyendo seguridad.
  - Nivel 2: 2-3 errores.
  - Nivel 1: Acepta respuesta o rechaza sin explicar.

---

## 8. REGLAS DE NEGOCIO IMPLEMENTADAS (Back-end)

### Regla 1: La nota solo nace el sábado
```sql
-- No existe columna 'nota' en trabajo digital.
-- La única tabla con peso es evaluaciones_desempeno (sábado).
```

### Regla 2: Puntos críticos no promedian
```javascript
// Edge Function: al guardar evaluación
if (evaluacion.items.some(i => i.critico && !i.cumple)) {
  evaluacion.estado = 'requiere_refuerzo';
  evaluacion.puntos_criticos_ok = false;
}
```

### Regla 3: Repetir no castiga
```sql
-- intento_numero se registra, pero no afecta nota final.
-- La nota es el estado de dominio, no un promedio numérico.
```

### Regla 4: Compuerta A es real
```javascript
// Trigger viernes 22:00
const seguimiento = await getSeguimiento(estudianteId, semanaId);
if (!seguimiento.completado || seguimiento.autochequeo_score < 5) {
  await updateInscripcionSabado(estudianteId, { estado: 'refuerzo', no_evalua: true });
}
```

---

## 9. ANEXOS TÉCNICOS

### Anexo A: API Endpoints Principales

| Método | Endpoint | Descripción |
|:---|:---|:---|
| POST | `/auth/v1/signup` | Registro estudiante |
| GET | `/rest/v1/dias_carril_abierto?semana_id=eq.X` | Contenido semanal |
| POST | `/functions/v1/tutor` | Consulta al tutor IA |
| POST | `/functions/v1/auditoria` | Ejercicio N4 |
| POST | `/rest/v1/dudas` | Enviar duda obligatoria |
| GET | `/rest/v1/controles_entrada?jornada_id=eq.X` | Control de entrada |
| POST | `/rest/v1/evaluaciones_desempeno` | Guardar evaluación sábado |
| POST | `/functions/v1/pasaporte-pdf` | Generar pasaporte |

### Anexo B: Estructura de Carpetas (Supabase Storage)

```
videos/
  microlecciones/
    semana1/
  evidencias/
    estudiante_uuid/
      ejecucion_semana1.mp4
pasaportes/
  pdf_generados/
```

### Anexo C: Variables de Entorno (Supabase / FlutterFlow)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=sk-...
WHEREBy_API_KEY=...
ONESIGNAL_APP_ID=...
```

### Anexo D: Checklist de Seguridad para Sábado (Implementación Técnica)

- [ ] App en modo fullscreen durante control de entrada y defensa
- [ ] Deshabilitar copiar/pegar en campos de respuesta
- [ ] Detectar cambio de pestaña/app (blur event) → alerta + registro
- [ ] Cámara y micrófono solo activos durante grabación de evidencia
- [ ] Geofencing opcional: solo permite evaluación dentro de coordenadas del taller

---

## 10. PRÓXIMOS PASOS POST-MVP

1. **Semana 2**: Integración nativa H5P (self-hosted) para preguntas incrustadas reales.
2. **Semana 3**: Simulador Electude con API de eventos (progreso del estudiante).
3. **Semana 4**: Machine learning básico para predecir estudiantes en riesgo de no pasar compuerta A.
4. **Mes 2**: App white-label para otras especialidades (industrial, petrolera).

---

*Documento generado para implementación MVP del Modelo de Dominio Verificado.*
*Stack validado para bajo código, máxima velocidad y reglas de negocio inviolables.*
