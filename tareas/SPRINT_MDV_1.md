# SPRINT MDV-1 · IDENTIDAD, CARNET Y CARRIL ABIERTO
**Días 3-5 (de 14)** · Objetivo: el estudiante se registra, ve su carnet con pasaporte MDV,
y puede recorrer las actividades de la semana.

---

## T-M101 · Middleware de protección de rutas
**Archivo:** `middleware.ts` (raíz).
**Haz:** según `spec/04_PANTALLAS.md` §1.
- Sin sesión → `/login`.
- Rol equivocado → redirigir a la pantalla de inicio de su rol.
- Rutas públicas: `/login`, `/registro`, `/registro/consentimiento`, `/recuperar`.

**Verifica:** entra como estudiante e intenta abrir `/panel`. Debe mandarte a `/carnet`.

---

## T-M102 · Diseño base y componentes comunes
**Archivos:** `app/globals.css`, `tailwind.config.ts`, `components/ui/*`.
**Haz:** según `spec/06_IDENTIDAD_VISUAL.md` y `spec/04_PANTALLAS.md` §0.
Componentes: `Boton`, `Campo`, `Tarjeta`, `Aviso`, `Cargando`, `EstadoVacio`,
`BadgeEstado` (verde/amarillo/rojo/gris para estados de competencia),
`BadgeIA` (muestra nivel N0-N4 con color).

**Verifica:** todos los botones miden al menos 56 px, texto nunca baja de 16 px.

---

## T-M103 · Login y registro
**Archivos:** `app/login/page.tsx`, `app/registro/page.tsx`, `app/registro/consentimiento/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §2. Igual que Sprint 1 original (T-103 a T-105).

**Verifica:**
- Login con `V-30000001` / `Prueba123!` → `/carnet`.
- Registro de menor → consentimiento obligatorio.
- Registro de mayor → carnet directo.

---

## T-M104 · Edge Function `provision-qr`
**Archivo:** `supabase/functions/provision-qr/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 1. Sin cambios respecto al original.

**Verifica:** devuelve secreto para estudiante, error para profesor.

---

## T-M105 · Carnet digital con pasaporte MDV
**Archivo:** `app/(estudiante)/carnet/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3, **actualizado con MDV**.

**Orden de tarjetas (no negociable):**
1. **Próximo sábado** — datos de `v_proximo_sabado`.
2. **Mi progreso MDV** — resumen del pasaporte, datos de `v_pasaporte_mdv`.
   Muestra: "Dominas X de Y competencias" con indicadores de color.
   Enlace "Ver pasaporte →" a `/pasaporte`.
3. **Estado de la semana** — datos de `weekly_progress`.
   Muestra: "Actividades completadas: X de Y" y si está habilitado para el sábado.
   Enlace "Ver semana →" a `/semana`.
4. **Carnet QR** — foto/iniciales, nombre, cédula, QR rotatorio.

**Verifica:**
- El QR se regenera cada 30 segundos.
- La tarjeta de progreso muestra estados con colores.
- Todo funciona sin internet (QR se calcula en el dispositivo).

---

## T-M106 · Pasaporte de competencias
**Archivo:** `app/(estudiante)/pasaporte/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3 — pantalla `/pasaporte`.
Lee de la vista `v_pasaporte_mdv`.

Cada competencia muestra:
- Semana y nombre
- Estado con color: DOMINADA (verde), EN PROGRESO (amarillo), REQUIERE REFUERZO (rojo), PENDIENTE (gris)
- Último intento: número, puntaje, fecha
- Nivel de defensa si existe

**Sin porcentajes, sin barras, sin comparación con otros.**

**Verifica:**
- Muestra TODAS las competencias del módulo, incluidas las pendientes.
- Los colores corresponden al estado.
- Pantalla vacía dice "Aún no tienes evaluaciones" con explicación.

---

## T-M107 · Pantalla de la semana (carril abierto)
**Archivo:** `app/(estudiante)/semana/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` — pantalla `/semana`.

- Header: "SEMANA [N] · [nombre de competencia]"
- Barra de progreso: X de Y actividades completadas.
- Estado de compuerta: "Habilitado para el sábado ✓" (verde) o "Te faltan X actividades" (ámbar).
- Lista de actividades por día (lunes a viernes):
  - Icono según tipo (video, simulación, pregunta, chat, quiz)
  - Título, duración, badge de nivel IA
  - Estado: completada ✓, pendiente, bloqueada (si día anterior incompleto)
- Al tocar una actividad → `/semana/[activityId]`.

**Datos:** `weekly_activities` filtradas por `learning_guide_id` de la semana actual,
cruzadas con `activity_completions` del estudiante.

**Verifica:**
- Las actividades se muestran en orden (lunes → viernes).
- Una actividad completada muestra check verde.
- El estado de compuerta refleja el progreso real.

---

## T-M108 · Detalle de actividad
**Archivo:** `app/(estudiante)/semana/[activityId]/page.tsx`.
**Haz:** renderiza según el `activity_type`:

- **microleccion:** reproductor de video con preguntas incrustadas (leyendo de `content_config`).
  Si no hay video configurado, muestra contenido de texto.
- **simulacion:** iframe con la URL de `content_config.simulator_url`.
- **caso_simulado:** preguntas de ramificación desde `content_config`.
- **duda_obligatoria:** textarea con mínimo 50 caracteres + botón "Enviar duda".
  Al enviar: insertar en `activity_completions` con `response_data`.
- **autochequeo:** quiz de 8 preguntas, intentos ilimitados, calificación más alta.
  Al completar: insertar en `activity_completions` con `score`.
- **clinica_errores:** enlace a videollamada + nota "Tu profesor te espera a las [hora]".

Al completar cualquier actividad: insertar en `activity_completions` y actualizar
la barra de progreso en `/semana`.

**Verifica:**
- La duda obligatoria no se puede enviar con menos de 50 caracteres.
- El autochequeo muestra puntaje y permite reintentar.
- Al completar todas las actividades requeridas, la compuerta muestra "Habilitado".

---

## T-M109 · Edge Function `close-gate-a`
**Archivo:** `supabase/functions/close-gate-a/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 8.
Ejecutada por cron los viernes a las 22:00. Cierra la compuerta A de todas las sesiones
del sábado siguiente.

**Verifica:**
- Estudiante con todo completado → `saturday_enabled = true`.
- Estudiante sin completar → `saturday_enabled = false`, `status = 'refuerzo'`.
- Se crean notificaciones para los que no pasaron.

---

## T-M110 · Navegación del estudiante
**Archivo:** `app/(estudiante)/layout.tsx`.
**Haz:** navegación inferior con 4 botones:
**Carnet · Semana · Exámenes · Material**

"Clases" (historial de asistencia) se accede desde un enlace en la pantalla del carnet.
"Notas" se accede desde el perfil o desde el carnet.

**Verifica:** la navegación funciona en 360px de ancho, los botones son grandes y táctiles.
