# SPRINT 4 · CONTENIDO, FEEDBACK Y VISIBILIDAD
**24 → 30 de agosto** · Prueba en campo: **sábado 29 de agosto (ensayo general)**
Objetivo: cerrar el ciclo completo de un sábado y dar visibilidad a la administración.

---

## T-401 · Subida de contenido
**Archivo:** `app/(profesor)/contenido/page.tsx`.
**Haz:** formulario de carga: archivo, título, descripción, módulo, semana, guía asociada
(opcional), publicar ahora o en una fecha.
Sube al bucket **privado** `contenido`, en la ruta `{module_id}/{week_number}/{uuid}-{nombre}`.
Guarda `storage_path` y `size_bytes`.
**Límite:** 25 MB por archivo. Si es mayor, mensaje claro pidiendo comprimirlo.
**Verifica:** el archivo no es accesible por URL pública. Solo por URL firmada.

---

## T-402 · Repositorio del estudiante
**Archivos:** `app/(estudiante)/contenido/page.tsx`,
`app/(estudiante)/contenido/[moduleId]/page.tsx`.
**Haz:** lista de módulos con material; dentro, agrupado por semana.
Al abrir un elemento, generar una URL firmada de 60 minutos desde el servidor.
**Verifica:** un estudiante de la cohorte A no puede abrir material de un módulo que no cursa.
Compruébalo consultando la API directamente, no solo la interfaz.

---

## T-403 · Visor de PDF
**Archivo:** `components/VisorPdf.tsx`.
**Haz:** visor con zoom (los esquemas técnicos se leen ampliados), navegación por páginas y
botón de descarga como respaldo.
**Verifica:** en un teléfono, el zoom con dos dedos funciona y el documento se lee.

---

## T-404 · Registro de visualizaciones
**Archivo:** parte de T-402.
**Haz:** insertar en `content_views` al abrir un elemento. Una vez por sesión de navegación, no
en cada desplazamiento.
**Verifica:** el reporte de uso muestra números coherentes.

---

## T-405 · Feedback micro
**Archivo:** `app/(estudiante)/feedback/[sessionId]/page.tsx`.
**Haz:** máximo 3 preguntas (el número sale de `system_config`), escala de 1 a 5 con caritas o
estrellas grandes, todo en una sola pantalla.
Debe responderse en **menos de 20 segundos**. Cronométralo de verdad.
Formato de `answers`: `[{"q":"...","a":4}]`.
Al enviar: *"Gracias. Tu respuesta es anónima para tu profesor."*
**Verifica:** ese mensaje es cierto — comprueba en la base que el profesor no tiene política de
lectura individual sobre `feedback_micro`.

---

## T-406 · Aviso de feedback al cerrar la clase
**Archivo:** parte de T-201.
**Haz:** al pasar una sesión a `cerrada`, crear una notificación `feedback_disponible` para los
estudiantes que asistieron. En `/clases` aparece el botón **Opinar sobre esta clase**.
**Verifica:** solo lo reciben quienes tienen asistencia registrada en esa sesión.

---

## T-407 · Feedback agregado para el profesor
**Archivo:** `app/(profesor)/sesiones/page.tsx` (sección nueva).
**Haz:** mostrar `v_feedback_session_summary`: promedio por pregunta y cantidad de respuestas.
Si hay menos de 3 respuestas: *"Aún no hay suficientes respuestas para mostrar el resumen."*
**Nunca muestres una respuesta individual.** No es una preferencia de diseño: si el profesor
pudiera ver quién dijo qué, nadie volvería a decir la verdad y el módulo entero perdería
sentido.
**Verifica:** con 2 respuestas no muestra nada; con 3 sí.

---

## T-408 · Notificaciones Web Push
**Archivos:** `lib/push.ts`, `supabase/functions/send-push/index.ts`,
`public/sw.js` (ampliación).
**Haz:**
1. Pedir permiso de notificaciones **después** del primer inicio de sesión, nunca al abrir.
2. Guardar la suscripción en `push_subscriptions`.
3. La Edge Function `send-push` según `spec/03_EDGE_FUNCTIONS.md` función 7.
4. Programarla con `pg_cron` cada 5 minutos.
5. En el service worker, manejar el clic para navegar según `payload`.

**Catálogo cerrado: 4 tipos y nada más.** El estudiante que recibe ocho avisos un sábado
desinstala la aplicación.
**Verifica:** publica un examen y comprueba que llega la notificación a un teléfono real.

---

## T-409 · Centro de notificaciones
**Archivo:** `components/CampanaNotificaciones.tsx`.
**Haz:** icono de campana con el contador de no leídas, y un panel con la lista. Al tocar una,
marcarla como leída y navegar a donde apunte.
**Verifica:** el contador baja al leer.

---

## T-410 · Reportes de administración
**Archivo:** `app/(admin)/reportes/page.tsx`.
**Haz:** los cuatro reportes de `spec/04_PANTALLAS.md` §5, todos con exportación a CSV:
1. Asistencia por cohorte y sesión.
2. Avance académico por módulo.
3. Uso del repositorio.
4. Exámenes pendientes de calificar, con antigüedad en horas.

**Verifica:** los CSV abren bien en Excel, con acentos correctos. Usa BOM UTF-8, o los nombres
en español salen con caracteres rotos.

---

## T-411 · Panel de configuración
**Archivo:** `app/(admin)/configuracion/page.tsx`. **Solo `super_admin`.**
**Haz:** tabla editable de `system_config` con descripción, valor actual y quién lo cambió.
Debajo, el historial de `system_config_history`.
**Verifica:** un `admin` normal no puede entrar. Cambia el umbral de aprobación y comprueba que
la nueva inscripción lo toma.

---

## T-412 · Revisión de accesibilidad de taller
**Archivo:** todas las pantallas.
**Haz:** revisa una por una contra las reglas de `spec/04_PANTALLAS.md` §0:
- [ ] Ningún botón mide menos de 56 px de alto.
- [ ] Ningún texto baja de 16 px.
- [ ] Todas las acciones principales están en el tercio inferior.
- [ ] Contraste mínimo 4.5:1 en todo.
- [ ] Nada se desborda a 360 px de ancho.
- [ ] Toda acción con red muestra estado de carga.
- [ ] Todo error dice qué hacer después.
- [ ] Todo estado vacío explica por qué está vacío.

**Esto no es cosmético.** La app se usa de pie, con guantes, bajo el sol. Un botón pequeño
significa que alguien vuelve al papel.

---

---

# AÑADIDOS PARA EL ESTUDIANTE
> Aprobados el 30/07/2026. Justificación completa en
> `docs/13_DISENO_DE_PRODUCTO_ESTUDIANTE.md`.
>
> **Por qué existen:** la Fase 1, tal como estaba planificada, era ~80% valor para la academia
> y ~20% para el estudiante. Estas tres tareas voltean esa proporción. Son lo único del sprint
> que el estudiante nota de inmediato.

## T-413 · Migración 014: mapa de dominio
**Archivo:** copiar `supabase/migrations/014_mastery_map.sql` y aplicarlo.
**Haz:** `supabase db reset`, luego `npm run db:types`.
**Verifica:** existen `mastery_map`, `v_mi_dominio` y `v_proximo_sabado`. La consulta de tablas
sin RLS sigue devolviendo cero filas. Agrega la prueba de acceso cruzado de `mastery_map` a
`tests/rls/acceso-cruzado.test.ts`.

## T-414 · Tarjeta «Próximo sábado»
**Archivo:** `components/ProximoSabado.tsx`, insertada en `app/(estudiante)/carnet/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3, tarjeta 1. Lee de `v_proximo_sabado`.
**Medio día de trabajo.** No requiere tabla nueva: el dato ya existe en `learning_guides` y
hoy se transmite de palabra al final de la clase, cuando ya nadie presta atención.
**Verifica:**
- Con guía digitalizada, muestra la investigación previa.
- Sin guía digitalizada, muestra solo fecha y módulo. **No inventa texto.**
- Sin sesión próxima, muestra el estado vacío correcto.

## T-415 · Pantalla «Mi progreso»
**Archivos:** `app/(estudiante)/progreso/page.tsx`, más la tarjeta resumen en el carnet.
**Haz:** según `spec/04_PANTALLAS.md` §3. Lee de `v_mi_dominio`.
**Verifica:**
- Aparecen **todas** las competencias del módulo, no solo las que tienen fila en `mastery_map`.
- Sin porcentajes, sin barras de nivel, sin puntos, **sin comparación con otros estudiantes**.
- Un estudiante no puede escribir su propio dominio (la política de RLS lo impide).

## T-416 · Marcar competencia dominada (profesor)
**Archivo:** `app/(profesor)/dominio/[cohortId]/page.tsx`.
**Haz:** tabla de estudiantes × competencias del módulo. El profesor marca tras la práctica de
taller. Al marcar `dominado`, el sistema exige indicar cómo se verificó (lo obliga el
disparador de la base).
**Diseño:** pensado para marcar **una competencia a varios estudiantes de una vez**, no
estudiante por estudiante. Si marcar a 25 personas toma 25 pasos, el profesor no lo va a usar.
**Verifica:** un profesor no puede marcar a estudiantes de una cohorte que no atiende.

## T-417 · Reordenar la pantalla de inicio del estudiante
**Archivo:** `app/(estudiante)/carnet/page.tsx`.
**Haz:** orden definitivo: **Próximo sábado → Mi progreso → Carnet con QR.**
**Verifica:** a 360 px de ancho, las tres tarjetas se ven sin desbordar y el QR sigue
alcanzándose con un pulgar.

> **Si el sprint va apretado:** T-414 se queda (medio día, alto impacto). T-415, T-416 y T-417
> se caen juntos a Fase 1.5 — no tiene sentido entregar el mapa de dominio sin la forma de
> llenarlo.

---

## SÁBADO 29 DE AGOSTO · ENSAYO GENERAL
Una cohorte opera el sábado completo solo con la app: asistencia, contenido, examen, feedback y
refrigerio. **Sin respaldo de papel.**

**Se aprueba si:** el sábado transcurre **sin ninguna intervención del equipo técnico**.
Si tienes que intervenir, no está listo, aunque todo haya funcionado.

---

## CRITERIO DE SALIDA
- [ ] `npm run verify` pasa.
- [ ] El profesor no puede ver feedback individual, comprobado contra la API.
- [ ] Las notificaciones llegan a un teléfono real.
- [ ] Las 8 casillas de accesibilidad marcadas.
- [ ] El ensayo del sábado 29 salió sin intervención técnica.
