# SPRINT MDV-3 · EXÁMENES, CONTENIDO, ADMIN Y DESPLIEGUE
**Días 10-14 (de 14)** · Objetivo: exámenes digitales, control de entrada del sábado,
panel de administración, reportes MDV, tutor IA enlazado, y despliegue a producción.

---

## T-M301 · Edge Functions de exámenes
**Archivos:**
- `supabase/functions/submit-attempt/index.ts`
- `supabase/functions/grade-answer/index.ts`
- `supabase/functions/create-staff-user/index.ts`

**Haz:** según `spec/03_EDGE_FUNCTIONS.md` funciones 4, 5 y 6. Sin cambios respecto al original.

**Verifica:**
- El estudiante entrega un examen y las respuestas objetivas se autocalifican.
- El profesor califica redacciones abiertas.
- Un admin crea cuentas de personal.

---

## T-M302 · Pantallas de exámenes (estudiante)
**Archivos:** `app/(estudiante)/examenes/page.tsx`, `app/(estudiante)/examenes/[examId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3.
- Lista de exámenes disponibles (habilitados/cerrados/calificados).
- Presentar examen: una pregunta por pantalla, guardado automático.
- **Nuevo:** distinguir exámenes por `exam_purpose`:
  - `evaluacion` → se muestra en la lista normal de exámenes.
  - `control_entrada` → accesible solo el sábado, pantalla especial con timer prominente.
  - `autochequeo` → accesible desde `/semana`, intentos ilimitados, calificación más alta.
  - `retencion` → aparece solo en semanas 6 y 12.

**Verifica:**
- Preguntas SIEMPRE de `v_exam_questions_student` (nunca `exam_questions` directo).
- Guardado automático al cambiar de pregunta.
- Control de entrada muestra timer de 20 minutos.

---

## T-M303 · Control de entrada del sábado
**Archivo:** `app/(estudiante)/control-entrada/[examId]/page.tsx`.
**Haz:** pantalla especial para el control de entrada:
- **Modo kiosk:** pantalla completa (Fullscreen API), botón de salida deshabilitado.
- Timer de 20 minutos prominente.
- 8 preguntas sorteadas del banco.
- Sin copiar/pegar en los campos de respuesta.
- Detectar cambio de pestaña (blur event) → registrar alerta.
- Un solo intento.
- Al terminar: puntaje inmediato. Si < 4/8 → mensaje "Clínica de errores prioritaria".

**Verifica:**
- La pantalla entra en fullscreen al iniciar.
- El blur se detecta y registra.
- Solo un intento permitido.
- El puntaje se muestra al terminar.

---

## T-M304 · Repositorio de contenido
**Archivos:** `app/(estudiante)/contenido/page.tsx`, `app/(estudiante)/contenido/[moduleId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3. Sin cambios respecto al original.
Lista de módulos → dentro: material agrupado por semana.

**Verifica:** visor de PDF funciona, descarga funciona, se registra en `content_views`.

---

## T-M305 · Pantallas de exámenes (profesor)
**Archivos:** `app/(profesor)/examenes/*`, `app/(profesor)/calificar/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4.
- Constructor de exámenes con `exam_purpose` selector.
- Al crear un examen, elegir: Evaluación / Control de entrada / Autochequeo / Retención.
- Cola de calificación de redacciones abiertas.

**Verifica:**
- Los puntos deben sumar exacto antes de publicar.
- La rúbrica de corrección siempre visible al calificar.

---

## T-M306 · Pantalla de notas (profesor)
**Archivo:** `app/(profesor)/notas/[cohortId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4.
Tabla editable con teoría, práctica, participación. Nota final calculada por la base.

**Agregar columna MDV:** "Estado de dominio" que muestra el resumen del pasaporte
(cuántas competencias dominadas de cuántas).

**Verifica:** las notas se calculan por la base, no por el frontend.

---

## T-M307 · Pantalla de contenido (profesor)
**Archivo:** `app/(profesor)/contenido/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §4.
Subir material: archivo, título, módulo, semana, publicar ahora o en fecha.

**Verifica:** el material subido aparece para el estudiante.

---

## T-M308 · Panel de administración
**Archivos:** `app/(admin)/panel/page.tsx`, `app/(admin)/estudiantes/page.tsx`,
`app/(admin)/consentimientos/page.tsx`, `app/(admin)/cohortes/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §5.

Panel con tarjetas numéricas + indicadores MDV:
- Estudiantes activos
- **Consentimientos pendientes** (rojo si hay alguno)
- Asistencia del último sábado
- **Compuerta A: habilitados vs total** (nuevo, MDV)
- **Competencias dominadas esta semana** (nuevo, MDV)

**Verifica:**
- Los números son correctos.
- Los consentimientos pendientes son imposibles de ignorar.

---

## T-M309 · Reportes MDV
**Archivo:** `app/(admin)/reportes/page.tsx`.
**Haz:** según la spec de pantallas MDV — `/reportes/mdv`.

Reportes con CSV export:
1. **Asistencia** por cohorte y sesión.
2. **Dominio al primer intento** — % de competencias dominadas al primer intento.
3. **Intentos hasta dominio** — promedio de intentos por competencia.
4. **Fallos en ítems críticos** — `v_error_heatmap`, cuáles fallan más.
5. **Compuerta A** — cuántos pasan cada semana.
6. **Avance académico** — aprobados/reprobados por módulo.

**Verifica:** cada reporte carga datos reales y exporta a CSV correctamente.

---

## T-M310 · Heatmap de errores (profesor)
**Archivo:** `app/(profesor)/heatmap/page.tsx`.
**Haz:** según la spec de pantallas MDV.
Tabla desde `v_error_heatmap`, ordenada por tasa de fallo descendente.
Ítems críticos resaltados.

**Verifica:** el heatmap muestra datos reales de las evaluaciones de prueba.

---

## T-M311 · Configuración (super_admin)
**Archivo:** `app/(admin)/configuracion/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §5.
Tabla editable de `system_config`, incluyendo las nuevas claves `mdv.*`.

**Verifica:** cambiar `mdv.self_check_threshold` afecta el cálculo de la compuerta.

---

## T-M312 · Tutor de IA (enlace externo)
**Haz:**
1. Configurar `system_config` con la URL del tutor: `mdv.ia_tutor_url`.
2. En la pantalla `/semana`, las actividades con `ia_level` N1 o N2 muestran un botón
   "Consultar tutor IA" que abre la URL en nueva pestaña.
3. En la sección 0 del carnet, agregar enlace "Tutor de IA" con icono.

**El tutor es un proyecto externo de Claude o GPT con las instrucciones restrictivas
del documento MDV (sección 6.2).** No se construye dentro de ZR App para el piloto.

**Verifica:** el enlace abre el tutor en nueva pestaña.

---

## T-M313 · Feedback por sesión
**Archivos:** `app/(estudiante)/feedback/[sessionId]/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3.
3 preguntas, escala 1-5, anónimo, 20 segundos.

**Verifica:** el profesor NO puede ver respuestas individuales (solo agregado con mín. 3).

---

## T-M314 · Notificaciones push
**Archivo:** `supabase/functions/send-push/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 7.
Agregar tipo de notificación para compuerta A.

**Verifica:** las notificaciones se envían por Web Push.

---

## T-M315 · PWA y Service Worker
**Archivos:** `app/manifest.ts`, `public/sw.js`.
**Haz:** según `spec/04_PANTALLAS.md` §6.
- Cachear esqueleto + carnet + semana.
- NO cachear exámenes ni control de entrada.

**Verifica:** instalar en Android e iPhone reales. Cámara funciona en modo instalado.

---

## T-M316 · Testing end-to-end
**Haz:** según `spec/05_PRUEBAS.md` + las pruebas MDV adicionales.

**Pruebas MDV obligatorias:**
1. Un estudiante completa todas las actividades de la semana → `saturday_enabled = true`.
2. Un estudiante que no completa → `saturday_enabled = false` después del cierre.
3. Evaluación con todos los críticos OK + score ≥ 81 → pasaporte verde.
4. Evaluación con un crítico fallido → pasaporte rojo, sin importar el score.
5. Defensa nivel 1 → fuerza requiere_refuerzo aunque la rúbrica sea perfecta.
6. Segundo intento con todo OK → pasaporte verde (repetir no castiga).
7. El estudiante A no puede ver el pasaporte del estudiante B (RLS).
8. El carril abierto NO aporta puntos al total del curso.

**Verifica:** `npm run verify` pasa.

---

## T-M317 · Deploy a producción
**Haz:**
1. Deploy de Next.js en Vercel.
2. Deploy de Edge Functions en Supabase.
3. Configurar variables de entorno en Vercel.
4. Configurar cron para `close-gate-a` (viernes 22:00) y `send-push` (cada 5 min).
5. Verificar HTTPS, dominio, y que la PWA es instalable.
6. Verificar respaldo automático configurado.

**Verifica:**
- La app abre desde un teléfono con datos móviles.
- Se puede instalar como PWA.
- El login funciona.
- El QR se genera y se puede escanear.
- Una evaluación completa de punta a punta funciona.

---

## T-M318 · Ensayo general MDV (15 pasos)
**Antes:** T-M317.
**Haz:** con 3 personas del equipo, cuentas de prueba, dispositivos reales:

| # | Acción | Criterio |
|---|---|---|
| 1 | Registrarse y entrar | Llega al carnet en < 60 seg |
| 2 | Ver la semana y completar lunes | Actividad marcada como completada |
| 3 | Completar todas las actividades de la semana | Compuerta muestra "Habilitado" |
| 4 | Intentar abrir evaluación del sábado sin compuerta | **No puede** |
| 5 | Cerrar compuerta (simular cron) | saturday_enabled se calcula |
| 6 | Control de entrada en modo kiosk | Timer funciona, una sola oportunidad |
| 7 | Evaluación con un ★ crítico en NO CUMPLE | Outcome = requiere_refuerzo |
| 8 | Reintento con todo correcto | Outcome = dominada, pasaporte verde |
| 9 | Defensa técnica con 3 preguntas sorteadas | Nivel registrado |
| 10 | Defensa nivel 1 bloquea | Outcome cambia a requiere_refuerzo |
| 11 | Ticket de reflexión | Se guarda correctamente |
| 12 | Pasaporte muestra colores correctos | Verde/amarillo/rojo/gris |
| 13 | Subir video de evidencia con datos móviles | Sube en < 2 min |
| 14 | Tutor IA se niega a dar respuesta | 3 intentos, se niega siempre |
| 15 | Heatmap de errores muestra datos | Criterios críticos resaltados |

**Si algún punto falla, se corrige antes de abrir a estudiantes.**
