# 21 · Revisión: profesores por programa y módulo (12 oct. 2026)

Estado: **probado en staging (`zr-staging`), pendiente de pasar a producción.**
Migraciones 150–159. Rama `develop`, último commit revisado: `70985f3`.

## 1. Qué hace la metodología

- Un **programa** es una cohorte (PTMA-2026-II, PTMA-2026-I…). Cada una puede tener un profesor
  distinto en el mismo módulo.
- Dirección Académica crea al profesor en Personal → Nuevo: elige el programa y luego los módulos;
  puede agregar más programas. Después puede cambiar las asignaciones desde el panel «Programas y
  módulos asignados» o desde Cobertura de módulos (que ahora trabaja por cohorte).
- El profesor solo ve y usa **su programa + su módulo**: estudiantes, asistencia, notas, material,
  feedback, dudas y temario. Si está en más de un programa o módulo, al entrar a cada sección sale una
  ventana flotante (fondo borroso) para elegir primero el programa y luego solo los módulos de ese
  programa. Con uno solo, entra directo.
- Módulo en curso **y módulo ya cursado**: el profesor (igual que Dirección Académica) puede registrar y
  calificar evaluaciones, cargar notas y subir material (aclarado el 12 oct., migraciones 161 y 162).
  Módulo que aún no empieza: bloqueado (no ve ni sube material, no carga notas); se habilita solo con
  el calendario.
- Material: cada archivo y carpeta lleva programa y módulo. El profesor ve lo que subió él y lo que
  subió Dirección/administración en su programa+módulo; nunca lo de otro profesor.
- El Temario («Qué debo impartir») sale de lo mismo que ve el estudiante en «Mi módulo» (tabla
  `modules`). No muestra la malla curricular.
- La sede del programa aparece junto al nombre donde se asigna o se elige.

## 2. Bugs encontrados y arreglados

| # | Bug | Causa | Arreglo |
|---|---|---|---|
| 1 | Profesor de un módulo veía las 4 cohortes PTMA | Acceso atado al programa, no a la cohorte | Mig. 151, 153, 154: acceso por (cohorte + módulo) |
| 2 | Cobertura mostraba/guardaba un solo profesor por módulo para todas las cohortes | Asignación sin cohorte | Cobertura lee y escribe por cohorte (`cohort_id`) |
| 3 | Feedback del profesor mostraba un solo módulo | Solo miraba el módulo «actual» de una cohorte | Mig. 152/153: lista sus módulos ya empezados |
| 4 | Profesor nuevo en PTMA-2025-II veía el material de PTMA-2026-II | El material no tenía programa y el sin-programa valía para todos | Mig. 155/157: material con `cohort_id`; el existente pasa a PTMA-2026-II; el profesor ya no ve material «general» |
| 5 | Un profesor del modelo anterior veía material ajeno | El respaldo por `cohorts.teacher_id`/sesiones se sumaba siempre | Mig. 156: el respaldo solo vale si la cohorte aún no tiene asignaciones |
| 6 | Todo profesor veía las **dudas de todos los programas** | Política `doubts_select_staff` usaba `is_staff()` | Mig. 159: el profesor solo ve las de sus programas; el resumen con IA (`resumir-dudas`) usa el cliente del usuario, no el de servicio |
| 7 | Personal decía «Sin programa asignado» aunque sí tenía | La lista ocultaba los programas sin calendario | Muestra todos los programas con asignación |
| 8 | El toggle de módulos parecía no asignar | Errores de la base se ignoraban | Se muestran los errores; el panel abre en el programa asignado |
| 9 | Botón borrar profesor y crear cuenta fallaban en staging | Faltaban `delete-account` y `create-staff-user` desplegadas en staging | Desplegadas en staging (producción ya las tiene) |
| 10 | El profesor podía subir material a módulos futuros o terminados | Sin control por estado | Mig. 158: no ve ni sube en módulos que no empiezan; no sube en terminados |
| 11 | `claim-snack` y otras 9 funciones desplegadas en staging por error | Malentendido | Borradas de staging; staging quedó con las funciones que tenía + `resumir-dudas` |

## 3. Verificación hecha (staging)

- `tsc --noEmit` sin errores. `next build` por Vercel de `develop`: exitoso.
- Simulaciones en SQL (con rollback) como estudiante, profesores (Pablo, Pedro, Marco), admin,
  super_admin, Dirección Académica, vendedor y zr_coffee: 25 tablas consultadas por rol, **sin
  errores de RLS**.
- Material: Marco (PTMA-2025-II) ve 0 archivos; Pablo ve lo suyo y lo de Dirección en PTMA-2026-II;
  Pedro (módulos 2 y 3) no ve nada del módulo 1.
- Dudas: política validada sin errores (staging no tiene dudas para probar el caso positivo).
- Asesor de seguridad de Supabase: solo avisos que ya existían (no hay nada en las tablas o
  funciones nuevas).
- Estado por módulo (`estado_modulo_cohorte`, `profesor_dicta`): módulos terminados y futuros
  devuelven «no puede subir».
- Compatibilidad con producción: las 14 políticas y la función `fn_bloquear_notas_enviadas` que la
  migración 150 reemplaza **existen en producción**; la versión de producción es igual a la nueva
  salvo la regla de estado del módulo que se agrega.

## 4. Límites de esta revisión (lo que NO se probó)

- Las pantallas no se recorrieron en el navegador con un usuario real (staging exige contraseñas).
  Hay que hacer el recorrido de la sección 6.
- `npm run test` / `test:rls` necesitan variables de entorno de una base real y crean usuarios; no se
  corrieron para no escribir en producción. Las 21 pruebas que fallaron al correrlas sin variables
  son de integración (no hay falla de lógica).
- `npm run lint` tiene 21 errores que ya existían (reglas nuevas de React en archivos viejos como
  `asistencias`, `layout`, `zr-coffee`); ninguno está en archivos de esta metodología.
- `resumir-dudas` y `generar-casos` necesitan `NVIDIA_API_KEY` (y `CRON_SECRET`) en staging; son
  secretos del proyecto y no se pueden copiar. Producción ya los tiene.

## 5. Plan de paso a producción

Orden (cada paso se verifica antes del siguiente):

1. Migraciones **150 → 159**, en orden, con `apply_migration` en `zr-prod`.
   - 157 usa el nombre `PTMA-2026-II` (existe en producción, 20 estudiantes).
   - 154 convierte las asignaciones sin cohorte (Isaac: módulo 1; Carlos: módulo 2) en explícitas
     de la cohorte que las usa.
2. Simular en producción, con rollback, a Isaac, Carlos y a un estudiante: que sigan viendo lo
   mismo (estudiantes, sesiones, material).
3. Edge Functions: `validate-scan` (traer primero la versión actual de producción y aplicarle solo el
   cambio de módulo) y `resumir-dudas`.
4. Código a `main`: solo los archivos de profesores (no `configuracion`, `moodle-test` ni
   `.env.example`). Regenerar `lib/database.types.ts` desde producción, `npm run build`.
5. Revisar el despliegue de Vercel y repetir el recorrido de la sección 6 con Isaac y Carlos.

Reversa: el código se revierte con `git revert`. Las migraciones son aditivas (columnas nuevas y
políticas reemplazadas); si algo falla, se restauran las políticas y funciones con las definiciones
que ya tiene producción (guardadas en la sección 3 y en las migraciones 090–149).

## 6. Recorrido de prueba (quien tenga acceso)

1. Dirección Académica → Personal → Nuevo: crear un profesor eligiendo programa y módulo. Debe
   aparecer con su programa en la lista.
2. El profesor entra: ve solo su programa y módulos. Con dos módulos, la ventana flotante le deja
   elegir; entra a Temario, Material, Notas, Dudas y Feedback.
3. Subir un material desde el profesor → Dirección lo aprueba → el estudiante del mismo programa lo ve.
4. Un profesor de otro programa **no** ve ese material ni esas dudas.
5. Un módulo ya cursado o que no empieza sale con candado.
6. Cobertura de módulos: cambiar el profesor de un módulo en una cohorte no cambia las demás.

---

## 7. Paso a producción (12 oct. 2026) — hecho

- Migraciones **150–159 y 160** aplicadas en `zr-prod` (160 cierra a `anon` las funciones nuevas; se
  encontró con el asesor de seguridad después de subir). `validate-scan` (con el cambio de módulo
  sobre la versión de producción, que ya traía la regla de solvencia) y `resumir-dudas` desplegadas.
- Código en `main` (`f7ecfc2`): solo los archivos de profesores, tipos regenerados desde producción,
  `npm run build` correcto, despliegue de Vercel correcto. No se subió nada de lo que sigue solo en
  staging (`configuracion`, `moodle-test`).

### Chequeo en producción (solo lectura, con rollback; no se pudo entrar a la app con una cuenta real)

| Prueba | Resultado |
|---|---|
| Isaac (módulo 1) y Carlos (módulo 2) siguen asignados a PTMA-2026-II tras la migración 154 | Sí |
| Isaac: ve 20 estudiantes, 3 sesiones, 2 notas, 2 materiales, 2 dudas, 1 feedback | Correcto |
| Carlos: ve 20 estudiantes, 3 sesiones, 20 notas, 3 materiales, 2 dudas, 1 feedback | Correcto |
| Carlos puede subir material al módulo 2 (en curso) | Sí |
| Isaac sube material y edita notas del módulo 1 (terminado) | Permitido tras la 162 (antes de ella estaba bloqueado por error) |
| Estudiante ve 5 materiales, 2 carpetas, 6 sesiones, 1 notificación | Igual que antes |
| Admin, super_admin, Dirección: 24 tablas sin errores de permisos | Correcto |
| Calendario nocturno (`fn_aplicar_calendario_cohorte`) | Sin error; no cambia al profesor de la cohorte |
| Dirección asigna y quita un módulo (con disparador y bitácora) | Correcto, queda en `audit_log` |
| Página de ingreso de producción carga | Sí (un 404 de un recurso estático, ya existente) |
| `anon` ejecutando las funciones nuevas | Bloqueado tras la 160 |

### Pendiente o para vigilar

- El recorrido completo en pantalla (sección 6) con una cuenta real de profesor sigue pendiente: Marco
  o Dirección Académica deben hacerlo con Isaac o Carlos.
- Vendedor y ZR Coffee no usan nada de lo que cambió; no se probaron con cuenta real.

### Corrección posterior (12 oct.): módulo terminado

La migración 150 dejaba en solo lectura al profesor de un módulo terminado; Isaac (módulo 1, terminó el
19-sep, notas sin enviar) quedaba sin poder cargarlas. La 161 lo abrió hasta la validación y la 162 lo
aclaró del todo: **tras terminar un módulo, el profesor y Dirección siguen registrando evaluaciones,
calificando, cargando notas y subiendo material**. Solo se cierra un módulo que aún no empieza.
Aplicadas en producción y staging; probado con rollback como Isaac.

---

## 8. Ajustes del 13 oct. (directo a producción y staging)

- **Compresión de material (migración 163):** el límite `content.aviso_pesado_mb` baja de 20 a **10 MB**.
  Hasta 10 MB el archivo se sube directo. Antes, aunque el archivo fuera chico, el botón decía
  «Comprimiendo y subiendo…» y esperaba una consulta del límite en cada archivo. Ahora: (1) el límite se
  lee una vez por sesión, (2) el botón dice «Subiendo…» y solo dice «Comprimiendo y subiendo…» si el
  archivo pasa del límite.
- **Selectores (`components/ui/Select.tsx`):** en pantallas anchas (≥ 640 px) la lista se abre pegada al
  campo (debajo, o encima si abajo no cabe) en vez de salir en el fondo o en el centro de la pantalla.
  En teléfono se mantiene la hoja desde abajo. Bug reportado al abrir «Programas y módulos asignados»
  en Personal.
- Verificado: el límite vale 10 en ambas bases y lo leen profesor y Dirección; `tsc` limpio; Vercel
  desplegó `main` (`3f804d8`) y `develop`. **No se probó el selector ni la subida en pantalla** (hace falta
  una cuenta real): comprobar subiendo un archivo de menos y de más de 10 MB y abriendo el selector del
  panel de Personal en el computador.

---

## 9. Bug en producción: dudas de otro módulo (13 oct.) y auditoría de lectura del personal

- **Bug:** Isaac (módulo 1) veía las dudas de Carlos (módulo 2). La migración 159 separaba las dudas por
  programa (cohorte) pero no por módulo, y las dudas no guardaban el módulo.
- **Arreglo (migración 164):** `doubts.module_id`; las existentes se etiquetan con el módulo del
  calendario de ese día; las nuevas se marcan solas (disparador) con el módulo vigente de la cohorte;
  el profesor ve solo las de su programa **y módulo**. La pantalla de Dudas y `resumir-dudas` filtran por
  módulo. Aplicado en producción y staging. Comprobado en producción: Isaac ve 0 dudas, Carlos 2,
  Dirección 2; una duda nueva de un estudiante queda en el módulo 2.
- **Auditoría (migración 165):** otras políticas dejaban leer a cualquier profesor de cualquier programa
  (con `is_staff()`): evaluaciones (`manual_exam_definitions`), exámenes con sus preguntas, intentos y
  respuestas, vistas de material (`content_views`) y la lista de asignaciones. Ahora el profesor ve solo lo de
  su programa+módulo (o lo suyo). En producción esas tablas están vacías, así que no se filtró nada real.
  Pendiente por decidir: `ai_cases`/`case_completions` (casos con IA, función apagada).
- **Selector (`Select.tsx`):** la versión «anclada al campo» salió larga, descuadrada y se movía al bajar. Se
  vuelve a una ventana flotante **fija, centrada** y con el fondo oscurecido, encima de todo.
- **Nota de pruebas:** al probar con rollback hay que usar el id real del usuario; una prueba con un id
  inexistente devuelve todo en 0 y parece un bloqueo (le pasó a la primera prueba de Isaac tras la 165; con
  su id real ve sus 20 estudiantes, 3 sesiones, 2 notas y 2 materiales).

---

## 10. Reunión del coordinador con Dirección Académica (13 oct.) — pendiente de pasar a producción

Migraciones 166–168, commit `b05de79`. Probado en staging con los 8 roles (sin errores de
permisos) y una simulación completa del flujo de publicar notas (con rollback, sin guardar nada).

1. **Programas sin estudiantes, suspendidos.** Solo PTMA-2026-II queda `activa` en las dos bases;
   los demás pasan a `suspendida` (reversible). Ya no aparecen en ningún selector.
2. **Notas con 2 decimales, sin redondear a entero.** La base ya calculaba con 2 decimales exactos
   (`round(x,2)`); el error estaba en la pantalla, que mostraba "20" o "15,4". Corregido en las 4
   pantallas donde se ve una nota.
3. **Orden al registrar evaluación:** Programa → Módulo → Nombre → Tipo → resto. Cada evaluación
   registrada muestra también el programa, no solo el módulo.
4. **El profesor publica directo (migración 167).** Nueva función `publicar_notas_profesor`: hace lo
   mismo que antes hacía `validar_notas` de Dirección Académica, pero la llama el profesor del
   módulo. "Revisar y publicar" reemplaza a "Confirmar y enviar a Dirección Académica". El
   estudiante ve la nota en cuanto se publica. La pantalla de Dirección Académica no se tocó: sigue
   pudiendo corregir cualquier nota cuando quiera.
5. **Una semana de gracia tras terminar el módulo.** Nueva función `profesor_puede_editar_notas`:
   en curso, sin límite; terminado, hasta 7 días después de la fecha de fin del calendario; pasada
   esa semana, solo Dirección Académica corrige esa nota. Reemplaza el "sin límite" de la
   migración 162 (decisión explícita del coordinador, confirmada en este chat).
6. **Recordatorio los sábados.** Cron a las 12:00 (hora Caracas) a los profesores con un módulo en
   curso.
7. **Encabezado fijo en la tabla de notas.** La fila con los nombres de evaluación queda fija al
   bajar por los estudiantes (como ya pasaba con la columna de estudiante al moverse de lado a
   lado).

### Verificado en staging
- Publiqué una nota de prueba como profesor (con rollback): quedó visible para el estudiante de
  inmediato vía `grade_validated_evals`, con 2 decimales exactos (12.59).
- Edité esa nota después de publicada: se reabrió sola, exigiendo volver a publicar — igual que el
  comportamiento anterior.
- Un profesor con el módulo terminado hace tiempo (fuera de la semana de gracia): `publicar_notas_profesor`
  lo rechaza con el mensaje correcto.
- 8 roles (estudiante, 2 profesores, admin, super_admin, Dirección, vendedor, ZR Coffee): sin
  errores de permisos en 9 tablas, y todos ven solo 1 programa activo.
- `tsc` y `next build` (Vercel) de `develop` sin errores.

### No probado
- Las pantallas no se abrieron en el navegador con una cuenta real (el encabezado fijo, el resumen
  de "Revisar y publicar", el orden del formulario).
- El cron del sábado no se esperó a que corriera (próximo sábado).
- `npm run test`/`test:rls` no se corrieron (necesitan una base real).

### Para producción
Mismo plan de siempre: migraciones 166–168 en `zr-prod`, simular con Isaac/Carlos y un estudiante
(con rollback), y solo los archivos de este cambio a `main`.

---

## 11. Paso a producción (14 oct.) y chequeo total — hecho

Migraciones 166–170 aplicadas en `zr-prod`. Código (commit `722f9fe`) en `main`, desplegado por Vercel.

### Bugs encontrados y corregidos en este paso

1. **Programas suspendidos seguían apareciendo en Asistencias, Notas (Dirección Académica) y
   Material.** Esas tres pantallas no filtraban por `status = 'activa'` (las otras 25 consultas a
   `cohorts` de la app sí lo hacían). Reportado por el usuario con una captura de la pantalla de
   Notas. Corregido antes de pasar a producción; las 28 consultas a `cohorts` de toda la app quedan
   revisadas una por una.
2. **Las 3 funciones nuevas de las migraciones 167–168 quedaban ejecutables por `anon`** (el permiso
   por defecto de Postgres). No exponían datos reales (dependen de `auth.uid()`), pero se cerraron
   igual, mismo criterio que las migraciones 133 y 160 (migración 169).
3. **El recordatorio del sábado fallaba al insertar** (`column "channel" is of type
   notification_channel but expression is of type text`): el `select distinct` con el literal
   `'push'` no se convertía solo al tipo de la columna, a diferencia de `publicar_notas_profesor`
   (que no usa `distinct`). Se encontró probando la función a mano en producción, justo después de
   subirla — nunca llegó a correr en el cron real (corre los sábados a las 12:00, y se subió un
   martes). Arreglado con un cast explícito (migración 170).

### Verificación

- **6 perfiles de producción** (estudiante, Carlos, Isaac, admin, super_admin, Dirección) × 26
  tablas + 5 funciones: sin errores.
- **8 perfiles de staging** (los 6 anteriores + vendedor + ZR Coffee) × lo mismo: sin errores.
- Isaac (módulo 1, terminado hace más de una semana): `profesor_puede_editar_notas` da `false`.
  Carlos (módulo 2, en curso): da `true`. Los dos conservan sus 20 estudiantes.
- `fn_recordar_cargar_notas()` ejecutada a mano (con rollback) en las dos bases: genera la
  notificación correcta sin error. Ningún rol de la app puede llamarla directo (permiso denegado),
  solo el cron.
- Asesor de seguridad de Supabase en las dos bases: mismos avisos de siempre, ya conocidos y
  aceptados (una vista con `security_definer` que no es de este trabajo); nada nuevo.
- `tsc`, `next build` y el despliegue de Vercel de `main`, sin errores.

### Pendiente / no verificable desde aquí

- El cron del sábado no se ha visto correr de verdad (el próximo sábado, 12:00 hora Caracas).
- Las pantallas no se recorrieron con una cuenta real de producción (sí se probaron a fondo en
  staging, con un profesor y un estudiante de prueba, en el navegador).
