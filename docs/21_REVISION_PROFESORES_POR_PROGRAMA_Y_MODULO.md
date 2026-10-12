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
- Módulo en curso: edita. Módulo ya cursado: solo lectura, con candado. Módulo que aún no empieza:
  bloqueado (no ve ni sube material, no carga notas). Se habilita solo con el calendario.
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
