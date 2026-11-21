> **Reemplazado por `plan_paso_a_produccion_2026-11-20.md`** (más profundo y al día con v1.91 / migración 239).

# Cómo pasar lo de `develop`/`zr-staging` a `main`/`zr-prod` — investigación (19-nov-2026)

> Solo investigación. **No se aplicó ni se cambió nada** en producción ni en staging
> (solo consultas de lectura). Pedido del coordinador: ver cómo llevar a producción
> todo el módulo de E-Learning y lo demás, sin perder lo que ya hay en producción
> (estudiantes, notas, materiales) y sin chocar a los estudiantes.

## 1. Dónde estamos hoy

| | `zr-prod` (main) | `zr-staging` (develop) |
|---|---|---|
| Commits de diferencia | 16 que develop no tiene (hotfixes/cherry-picks) | 169 que main no tiene · 202 archivos, +15.2k / -4.7k líneas |
| Migraciones (BD) | hasta la 170 + 191 + push_feedback + 198 | hasta la 222 |
| Tablas del Aula Virtual | **no existen** (`units`, `unit_items`, `assignments`, `submissions`, `calendar_events`, `material_progress`, plantillas…) | existen |
| Edge Functions | 18 desplegadas | 15 desplegadas |
| Crons (`pg_cron`) | 10 | 14 (los 4 de más son del Aula/resumen semanal) |
| Buckets | `avatars`, `consentimientos`, `contenido` | + `tareas`, `banners-unidad`; `contenido` con límite 500 MB |
| Datos | 36 estudiantes (2 cohortes: PTMA-II 20, PTMA-III 16), 16 evaluaciones de Notas con 315 notas, 10 materiales, 2 carpetas, 35 casos IA, 252 notificaciones | datos de prueba |

Datos reales que **no se pueden perder** (verificados con consultas de solo lectura en `zr-prod`):
- **Notas:** 16 `manual_exam_definitions` y 315 `manual_exam_scores`.
- **Material:** 10 `content_items` y 2 `content_folders` (ver §3).
- Estudiantes, cohortes, asistencia, finanzas, notificaciones, casos IA, dudas (2).

## 2. Hallazgos — cosas que pueden salir mal

### 2.1 Alto riesgo
1. **Las migraciones NO se pueden aplicar "por número de archivo".** `fn_exam_attempt_prepare` se redefine 6 veces (176, 177, 200, 203, 207_remedial, 210). En staging el orden real de aplicación fue 210 (15-nov) y luego 207_remedial (16-nov), pero en el repo 210 va *después* de 207 por número. Si en producción se corre por número, la 210 pisa a la 207 y **se pierde la política de remedial por examen** (`retake_policy`/`retake_cap_pct`) sin ningún error. Además hay **prefijos duplicados** (dos `207_…` y dos `208_…`), y las migraciones 188/189 se aplicaron a mano en staging sin quedar en git (efecto neto cero). Mi migración `211_obligatorios_…` quedó en el repo como `215_…`, pero en la base de staging se llama `211_…`.
   → Hay que armar el paquete para producción en **el orden real de staging** (por fecha de aplicación), no por nombre de archivo.
2. **Material "movido" a Unidades: hoy no hay puente.** En `develop` el menú del estudiante ya no tiene "Material" (apunta a Unidades) y la pantalla vieja `/contenido` quedó sin enlace. Los 10 materiales de producción **siguen existiendo** pero no están dentro de ninguna unidad (en producción ni existe la tabla `units`). Al subir el cambio, el estudiante entraría a "Unidades" y vería vacío. Hace falta un *backfill* (ver §3).
3. **Los estudiantes de producción ya "vieron" el tutorial de Aula.** 17 de 18 estudiantes (según `profile_roles`) ya tienen `estudiante-aula` y `estudiante-material` guardados en `tour_pasos_vistos` (de cuando el módulo estuvo mergeado a producción el 7-nov y se revirtió). El tutorial solo muestra pasos *no vistos*, así que **nadie vería la explicación de Unidades** y el cambio los chocaría. Hay que usar ids nuevos (ver §5).
4. **`221_rendimiento_rls_e_indices` reescribe ~69 políticas RLS con un bloque dinámico (`DO`).** En staging funcionó, pero producción tiene otro juego de políticas. Debe probarse sobre una copia de producción antes (es un cambio "que no altera quién ve qué", pero un error aquí rompe permisos de toda la app).

### 2.2 Riesgo medio
5. **Cambia lo que ve el estudiante:** la 209 reemplaza `mis_modulos_cursados()` (en producción solo usa el calendario si la cohorte lo tiene; en staging se suma "todos los módulos hasta el actual"). Y la 208 hace visible el material enlazado a una unidad aunque lo haya subido otra cohorte. Con los datos reales: PTMA-II (actual Fluidos #3) vería los módulos 1-3; PTMA-III (Intro #1) solo el 1.
6. **Variables de entorno / claves:** `CLOUDCONVERT_API_KEY` (conversión de PPTX, opcional: sin ella se cae a la vista externa), claves **VAPID** (push; hoy en staging faltan, producción necesita su propio par) (no hay otras variables nuevas en el código). Los crons de las migraciones 176/213/219 llaman funciones SQL (no URLs), sin llaves quemadas: seguros de replicar. Ojo: hay `lib/entorno.ts` con el id del proyecto de prueba (solo para la cinta amarilla "Entorno de prueba").
7. **Edge Functions:** hay que redesplegar en producción `grade-answer`, `claim-snack` y `validate-scan` (ahora aceptan `direccion_academica`). `submit-attempt` en producción (v7) es idéntico al del repo (revisado). En staging existen `asistente-examenes` y `claim-snack-cantina` (retiradas/no usadas) y en producción existen `approve-rehabilitation`, `request-rehabilitation`, `provision-qr`, `generar-casos`, `approve-professor` que staging no tiene: **no tocar**.
8. **Dependencias nuevas** (`@dnd-kit`, `mammoth`, `xlsx` desde el CDN de SheetJS): se instalan con el despliegue; la de `xlsx` no debe volver a la versión de npm.
9. **Dos sesiones paralelas trabajando en `develop`** (migraciones 216-222, Monitoreo, Salones, Agenda). Hay que definir cuál es el "corte" (commit) que se promueve y congelar.

### 2.3 Bajo riesgo / ya cubierto
- **Notas reales (16 evaluaciones / 315 notas):** las migraciones que tocan Notas (191, 198 ya están en producción; 193, 199, 212) solo crean/ajustan evaluaciones *ligadas a un examen o tarea digital*; producción tiene 0 exámenes y 0 tareas, así que no las tocan. Aun así, se deben comparar conteos y sumas antes y después (§4, paso 6).
- **Notificaciones:** los 6 tipos que hay en producción están dentro de la lista permitida del nuevo `CHECK` (no falla).
- **Prod ya tiene** el filtro de material por módulo y cohorte (políticas 123/155) y `mis_modulos_cursados` versión 138.
- La migración 195 hace `drop column banner_aspecto` y la 199/197 borran filas, pero solo sobre tablas del Aula que en producción aún no existen.

## 3. Qué pasa con el Material que ya está en producción

Inventario real (producción): 10 archivos, todos `aprobado` y publicados.

| Módulo | Cohorte | Carpeta | Archivos |
|---|---|---|---|
| 1 Introducción a la Mecánica | PTMA-2026-II | "Módulo I.- Introducción a la mecánica automotriz" | 2 (Presentación, Práctica 2) |
| 1 Introducción a la Mecánica | PTMA-2026-III | (sin carpeta) | 2 (Presentación Módulo I, Guía de práctica #1) |
| 2 Instrumentación automotriz | PTMA-2026-II | "Modulo II. Instrumentación" | 5 (presentación + 4 guías) |
| 3 Fluidos automotrices | PTMA-2026-II | (sin carpeta) | 1 (Práctica #1) |

Cómo está construido el Aula: una **unidad** pertenece a un *módulo* (no a una cohorte) y su contenido son filas de `unit_items` que apuntan al `content_items`. **El archivo en Storage y la fila de `content_items` no se mueven ni se borran**; solo hay que crear la unidad y "enlazar".

**Propuesta de backfill (a correr una vez, en producción, después de las migraciones):**
- Una unidad por módulo que tenga material (3 unidades), con el nombre de la carpeta si existe (o "Material del módulo"), `manual_status` abierta, `gate_mode='none'` (que no la bloquee ninguna certificación), `order_index=1`.
- Un `unit_items` (`type='material'`, `required=false`, orden por `created_at`) por cada archivo.
- Las carpetas se conservan intactas (la pantalla `/material` de Dirección las sigue mostrando, es otra vista del mismo dato).
- Borrar nada: ni archivos, ni carpetas, ni `content_items`.

```sql
-- BORRADOR, NO EJECUTADO. Probar primero en una copia de prod / en staging con rollback.
with mods as (
  select ci.module_id,
         coalesce(max(f.name), 'Material del módulo') as titulo
  from content_items ci
  left join content_folders f on f.id = ci.folder_id
  where ci.is_published and ci.approval_status = 'aprobado'
    and not exists (select 1 from unit_items ui where ui.content_item_id = ci.id)
  group by ci.module_id
), nuevas as (
  insert into units (module_id, title, order_index, manual_status, gate_mode)
  select module_id, titulo, 1, 'abierta', 'none' from mods
  returning id, module_id
)
insert into unit_items (unit_id, type, order_index, content_item_id, required, visible)
select n.id, 'material',
       row_number() over (partition by n.id order by ci.created_at),
       ci.id, false, true
from nuevas n
join content_items ci on ci.module_id = n.module_id
 and ci.is_published and ci.approval_status = 'aprobado'
 and not exists (select 1 from unit_items ui where ui.content_item_id = ci.id);
```
(Verificar los nombres/valores exactos de `manual_status` y de los enums en el esquema final antes de correrlo; `content_items.unit_id` no se usa hoy: en staging los 25 ítems enlazados lo tienen vacío.)

**Decisión pendiente (producto):** como una unidad es del módulo, **todas las cohortes que cursaron ese módulo verán todos sus materiales** (p. ej. PTMA-II verá la "Presentación Módulo I" que subió PTMA-III y viceversa). Es inofensivo con estos datos (mismo módulo, mismo contenido), pero hay que confirmarlo. Alternativa: dejar la ruta vieja `/contenido` visible unos días como respaldo.

## 4. Plan propuesto por fases

0. **Congelar y elegir el corte.** Acordar con la otra sesión un commit de `develop` a promover; el resto espera. Hacer una **copia de seguridad** de producción (backup/PITR de Supabase) y anotar la hora.
1. **Ensayo general sobre una copia de producción** (rama de Supabase o proyecto temporal restaurado desde backup — crear una rama tiene costo y requiere confirmación): aplicar el paquete de migraciones en el orden real de staging, correr el backfill (§3) y recorrer los 4 perfiles (estudiante, profesor, dirección, super_admin) con datos reales. Nada de esto toca producción.
2. **Armar el paquete de migraciones de producción**: un solo archivo/bloques en el **orden de aplicación de staging**, resolviendo duplicados (207/208) y confirmando que la versión final de `fn_exam_attempt_prepare` es la de 207_remedial + mensajes de 203/210. Preferible: generar la diferencia real de esquema (staging → prod) y revisarla, en vez de repetir la historia.
3. **Ventana de despliegue** (no en sábado de clase ni con examen abierto; mejor martes-jueves por la tarde): 
   1. Aplicar migraciones en producción (primero las del esquema, al final `221` y los crons).
   2. Correr el backfill de Material (§3).
   3. Desplegar Edge Functions (`grade-answer`, `claim-snack`, `validate-scan`).
   4. Poner variables de entorno en Vercel (VAPID pública, `CLOUDCONVERT_API_KEY` si se usa) y secretos VAPID en Supabase.
   5. Merge `develop` → `main` (despliegue de la app), con `lib/version.ts` subido.
4. **Datos de arranque del Aula** (Dirección Académica): crear módulo/unidades que falten (p. ej. Inglés Técnico, ver §6), asignar profesores (`/personal`), y dar el perfil al profesor Arjona.
5. **Verificación inmediata** con cuentas reales (no QA): un estudiante de PTMA-II y uno de PTMA-III ven su Material dentro de Unidades; Notas sin cambios; asistencia/QR/refrigerio funcionando (no se tocó pero se prueba); campanita; push.
6. **Comprobación de que no se perdió nada** (antes y después, comparar): `count(*)` de `manual_exam_definitions`/`manual_exam_scores`, suma de notas por cohorte, `count` de `content_items`, `students`, `notifications`; y que el archivo de cada `storage_path` sigue abriéndose.
7. **Plan de vuelta atrás:** el backup del paso 0; las migraciones son aditivas (tablas nuevas) salvo las funciones redefinidas (guardar su definición anterior) — el código se puede revertir con un `git revert` del merge, y las tablas del Aula pueden quedar sin usar sin afectar lo anterior.

## 5. Tutoriales (que no choque el cambio)

- **Problema:** los ids `estudiante-aula`, `estudiante-material`, `estudiante-accesos`… ya figuran como vistos para casi todos los estudiantes, así que el tutorial no volvería a explicar nada. Además `estudiante-accesos` cambió de texto pero conserva el id.
- **Propuesta:** pasos **nuevos con ids nuevos** (nunca reusar) en `lib/tour-pasos.ts`, por ejemplo `estudiante-unidades-v2` ("El Material ahora vive dentro de Unidades: ahí está lo mismo de siempre, ordenado por unidad, más exámenes y tareas"), `estudiante-material-movido` (apunta a la ruta `/unidades` y dice dónde quedó cada cosa), y lo equivalente para profesor (`profesor-unidades-v2`: dónde subir ahora el material, ya no hay "Material") y para Dirección/admin. El hook ya sabe mostrar solo "lo nuevo" a quien ya vio el tutorial.
- Comunicación complementaria: un aviso en el grupo/push el día del cambio, y una tarjeta fija en el Inicio del estudiante durante 1-2 semanas ("El Material ahora está en Unidades").
- Quitar o ajustar en el tutorial toda mención a "Material" como sección propia.

## 6. Inglés Técnico como módulo paralelo (lo que mencionó el coordinador)

- En staging "Inglés Técnico" es el módulo #14 de PTMA (4 semanas, creado desde `/modulos`). **En producción no existe** (y en PFTA tampoco): hay que crearlo en cada programa que lo lleve.
- Un estudiante ve los módulos que ya cursó + el actual. El actual de cada cohorte es **uno solo** (`current_module_id`). Para que PTMA-II vea *a la vez* Fluidos (#3) e Inglés Técnico (#14) hay que dar de alta Inglés Técnico en el **calendario de módulos** de la cohorte (`cohort_module_calendar`, con fecha de inicio ya llegada): la regla de "módulos cursados" suma lo del calendario, así que se vería sin cambiar código.
- **Sin probar y con riesgo:** (a) el cron `avanzar-modulos-por-calendario` (diario 4:30) recalcula el módulo actual a partir del calendario; un módulo paralelo con fechas solapadas podría **cambiar el "módulo actual"** de la cohorte (afecta asistencia, QR, Notas, feedback). (b) El profesor de Inglés debe quedar asignado a ese módulo y cohorte (`/personal`). (c) Notas/Feedback/Temario del profesor están bloqueados para módulos "no vigentes". Hay que probarlo en staging con una cohorte de prueba antes del paso 4.

## 7. Decisiones que necesito del coordinador / Pedro

1. ¿Confirmas que está bien que cada cohorte vea todo el material de un módulo compartido (§3), o prefieres separar por cohorte (requeriría cambiar el diseño)?
2. ¿Hacemos el **ensayo sobre una copia de producción** (Supabase branch, con costo) o prefieres restaurar un backup en un proyecto temporal?
3. ¿Qué día/hora de la ventana de despliegue? (sugerido: entre semana, sin clase ni examen abierto).
4. ¿Qué corte de `develop` se promueve, y se pausa a la otra sesión hasta entonces?
5. ¿Se mantiene `/contenido` (Material viejo) accesible unos días como respaldo?
6. ¿Se contrata CloudConvert (PPTX→PDF) o se sigue con la vista externa?
7. Inglés Técnico: ¿en PTMA y PFTA? ¿arranca en paralelo con Fluidos?


## Actualización 20-nov-2026 (v1.78 → v1.82)

- Migraciones nuevas aplicadas en staging, en este orden: 227, 228, 229, 230, 230b (registrada como `230b_compuerta_unidad_anterior_real`, el archivo 230 contiene ambas), 231. Ninguna redefine `fn_exam_attempt_prepare`.
- Edge Functions redesplegadas en staging: `grade-answer` (v4), `respond-rehabilitation`, `approve-rehabilitation` (sin admin, con Dirección).
- En `zr-prod` el módulo "Inglés técnico automotriz" no existe (migración 138 lo borró): crearlo antes del tramo virtual.
- Detalle: `docs/reportes/informe_nocturno_2026-11-20.md` y `docs/reportes/evaluacion_lms_ux_visual_2026-11-20.md`.

- v1.83: migración 232 (después de 231). Redefine `fn_exam_attempt_prepare` con un `replace` sobre la versión vigente (agrega la prórroga por `intervention_grants`): en producción debe correr **después** de la versión final de esa función, nunca antes.
- v1.84–1.85: migraciones 233, 234, 234b (`234b_agenda_clases_con_excepciones`), 235. La 235 cambia el cron `generar-sesion-del-sabado` a diario (`0 8 * * *`); en producción revisar que el job exista con ese nombre antes de aplicarla. Antes de usar el calendario general en producción, revisar el horario convertido de cada corte en "Datos del corte" (la conversión del texto libre puede fallar con formatos raros: queda vacío y se completa a mano).
