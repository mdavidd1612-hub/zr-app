# Paso de `develop`/`zr-staging` a `main`/`zr-prod` — investigación v2 (20-nov-2026)

> **Solo investigación.** En producción solo se hicieron consultas de lectura. En staging, las dos
> pruebas del traslado de Material corrieron dentro de una transacción que se deshizo sola
> (no quedó nada guardado). Reemplaza a `plan_paso_a_produccion_2026-11-19.md`, que quedó
> desactualizado: desde ayer `develop` pasó de v1.65 a **v1.91** y de la migración 222 a la **239**.

## Respuestas del coordinador (audio del 20-nov, noche) y lo que cambia

| # | Pregunta | Respuesta | Qué cambia |
|---|---|---|---|
| 1 | ¿Cada corte ve el material de todo el módulo? | **No.** Cada corte ve solo el material que se le montó a su corte ("son entornos diferentes"). | **Hay que construir algo antes del paso** (ver abajo). El traslado de §4 tal como está no sirve. |
| 2 | ¿Hay clase el 26-dic o el 2-ene en PTMA-II? | No la entendió. | Sigue pendiente (ver pregunta reformulada abajo). |
| 3 | ¿CloudConvert? | Dejarlo aparte por ahora, salvo que sea gratis. | **Es gratis con límite diario** (entre 10 y 25 conversiones/día según la fuente; confirmar en su página). Alcanza: la app convierte cada presentación **una sola vez** y guarda el PDF. Para activarlo: crear cuenta gratis, sacar la clave y ponerla en Vercel (`CLOUDCONVERT_API_KEY`). |
| 4 | Fecha | Entre semana en la tarde, sin clase ni examen abierto. | Sin cambio. |
| 5 | ¿Ensayo en la computadora? | **Sí, hacerlo.** | Se hace el ensayo local (Docker + copia de producción) cuando se dé la orden. |
| 6 | Profesor de PTMA-III en Introducción | Sí lo tiene. | **Corrección:** en producción PTMA-III sí tiene a Isaac Sánchez en Introducción (y profesores asignados en Instrumentación y Fluidos). El "0 asignaciones" era de staging. |
| 7 | Inglés técnico | Crear el módulo; ellos ajustan las fechas. | Crear "Inglés técnico" en producción después del paso; Dirección pone el tramo virtual y el profesor. |
| 8 | Administración ya no cambia notas | Nunca lo usaban. | Sin problema. |
| 9 | Respaldo antes de empezar y congelar `develop` (incluida la sesión de Pedro) | De acuerdo. | Sin cambio. |
| 10 | — | "Asegúrate de lo de las notificaciones." | Chequeo agregado: después del paso, generar un aviso de prueba y confirmar que llega al teléfono (producción tiene 20 dispositivos con avisos activados y sus claves ya funcionan). |
| 11 | "Faltan muchísimas más migraciones" | Duda. | **Aclaración:** el paquete ya son **todas**: 64 archivos (las 66 aplicadas en staging, con 3 que vienen dentro de otro archivo), más 3 que estaban aplicadas sin registro (027, 204 y 206). No faltan otras: se verificó comparando la base completa de los dos lados, no por nombre. |
| 12 | Pasar solo la estructura y las funciones nuevas, no lo que se hizo de prueba | Pedido explícito. | **Confirmado:** el paquete no lleva datos de staging (ningún identificador fijo de staging; lo que toca datos está dentro de funciones). Las unidades, exámenes y estudiantes de prueba se quedan en staging. |

### Nuevo trabajo antes del paso: material solo del propio corte

> **Hecho en staging (21-nov-2026, v1.96):** migración 241 (`units.cohort_id`, políticas del estudiante, compuerta, avisos y plantillas por corte), pantallas del profesor y del estudiante, y el traslado nuevo de §4. Probado como estudiante de cada corte: cada uno ve solo sus unidades y su material, más las generales.

Hoy una **unidad es del módulo, no del corte**, y la regla de la migración 208 deja ver el material
enlazado en una unidad a todos los cortes del módulo. Para cumplir la respuesta 1 hay que, en
staging primero:
1. Agregar el corte a la unidad (`units.cohort_id`, vacío = todos los cortes, para no romper lo
   que ya existe) y que el estudiante solo vea las unidades de su corte (o las generales).
2. Ajustar la regla del material: el enlace en una unidad abre el material solo si la unidad es de
   su corte (o general).
3. En la pantalla del profesor/Dirección, al crear una unidad, guardarla para el corte elegido.
4. Cambiar el traslado de §4: **una unidad "Material del módulo" por cada corte y módulo**, marcada
   con su corte. Con los datos de hoy: Introducción ×2 (PTMA-II y PTMA-III), Instrumentación y
   Fluidos de PTMA-II → 4 unidades, 10 enlaces.
5. Probar como estudiante de cada corte que ve solo lo suyo.

### Problema que ya está pasando en producción (no espera al paso)

En producción el tope de 100 % de las evaluaciones (`fn_validar_suma_pesos`) y el envío de notas
(`enviar_notas`) suman los % de **todos los cortes del módulo**. PTMA-II ya ocupa el 100 % de
Introducción, así que **hoy el profesor de PTMA-III no puede registrar ninguna evaluación con %
en Introducción** ("Los porcentajes pasan de 100 %"), y le pasará igual en Instrumentación y
Fluidos. Staging ya lo tiene corregido (migraciones 224 y 229). Opciones: esperar al paso, o un
arreglo puntual en producción solo de esas 2 funciones (decisión del coordinador).

### Pregunta 2, reformulada

> **Respondida (20-nov, 11:05 p. m.):** es correcto, esos dos sábados no hay clase. No hace falta tocar el calendario. El coordinador pidió hacer el ensayo.

En el calendario de módulos de PTMA-2026-II **no hay clase el sábado 26 de diciembre ni el sábado
2 de enero** (vacaciones). Con lo nuevo, esos días la app no crea la clase y el QR dice "hoy no hay
clase". **¿Es correcto que esos dos sábados no haya clase?** Si sí hay, hay que agregarlos al
calendario antes.

## 0. Resumen en 6 líneas

1. Se puede pasar sin perder nada: todo lo nuevo es **aditivo** (tablas nuevas) y las tablas
   que ya existen solo ganan columnas. Ninguna migración borra datos reales de producción.
2. El paquete son **66 migraciones** en el orden real de staging, **más 3 que no tienen registro**
   (027, 204 y 206). Hay 1 inversión de orden que importa (210 antes que 207_remedial).
3. Los 10 materiales de producción **no se pierden**: hay que correr un traslado (§4) que los mete
   en Unidades. Probado como estudiante en staging: funciona.
4. Hay **5 Edge Functions** que redesplegar (cambios de una línea, solo de roles).
5. **No desplegar en sábado** (mañana, 21-nov, hay clase de los dos cortes) ni con examen abierto.
6. Faltan **5 decisiones** (§8) antes de fijar fecha.

## 1. Cómo se verificó (más profundo que ayer)

- **Comparación objeto por objeto** de las dos bases (no por nombre de migración): tablas y
  columnas, 133 funciones, 166 políticas RLS, 72 disparadores, restricciones, vistas, enums,
  crons y buckets. Se compararon huellas (hash) del contenido real.
- Funciones con contenido distinto: se normalizaron (sin espacios ni `search_path`) para separar
  diferencias reales de diferencias de formato, y se leyó el código de las dudosas.
- Orden de migraciones: lista real de staging contra los archivos del repo (script, no a ojo).
- Datos reales de producción: conteos, cortes, calendario, evaluaciones, material, archivos del
  almacenamiento, pasos del tutorial ya vistos y secretos de Vault (solo nombres).
- Traslado de Material: corrido en staging dentro de una transacción que se deshace, primero como
  administrador y después **entrando como un estudiante de cada corte** (con sus permisos reales).
- Conversión de horario de la migración 233 probada con los textos reales de producción.

## 2. Estado de cada lado

| | `zr-prod` (`main`) | `zr-staging` (`develop`) |
|---|---|---|
| Código | 16 commits propios (todos ya incorporados en develop por contenido) | 197 commits más, v1.91 |
| Migraciones | hasta la 170 + 191 + 192 + 198 | hasta la 239 |
| Tablas | 64 | 85 (21 nuevas: unidades, tareas, calendario, salones, excepciones de clase, plantillas, errores…) |
| Edge Functions | 18 | 16 |
| Crons | 10 | 14 |
| Buckets | `avatars`, `consentimientos`, `contenido` | + `tareas`, `banners-unidad`; `contenido` con tope de 500 MB |

**Datos reales que no se pueden perder** (producción hoy): 46 perfiles, 36 estudiantes en 2 cortes
(PTMA-2026-II: 20, en Fluidos #3; PTMA-2026-III: 16, en Introducción #1), 13 clases con 231
asistencias, 16 evaluaciones con 315 notas, 16 evaluaciones validadas, 75 matrículas de módulo,
10 materiales con 2 carpetas, 32 respuestas de feedback, 35 casos IA, 252 notificaciones,
**20 teléfonos con avisos activados**, 2 dudas, 21 archivos en almacenamiento (~110 MB).

## 3. Hallazgos

### 3.1 Bloquean o pueden romper algo (resolver antes)

1. **El orden de las migraciones no es el número de archivo.** Hay que aplicar en el orden real
   de staging (Anexo A). Inversión que importa: `210_remedial_certificacion…` se aplicó **antes**
   que `207_remedial_politica_y_tope` (las dos redefinen `fn_exam_attempt_prepare`). Por número,
   la 210 pisaría a la 207 y se perdería el remedial por examen sin dar error.
2. **Tres migraciones no tienen registro en staging** y hay que meterlas a mano en su lugar:
   - **027** (`profesor borra sus examenes`): **producción nunca la aplicó** (sigue con la política
     vieja de la 024, que solo deja borrar borradores). Sin ella, el profesor no puede borrar un
     examen publicado en producción. Va al principio del paquete.
   - **204** (límite de 500 MB del bucket `contenido`): aplicada a mano en staging el 8-nov.
     Sin ella, subir un video grande falla.
   - **206** (profesor prepara módulos futuros): aplicada a mano en el editor SQL el 13-nov. Va
     **antes de la 227** (la 227 cambia políticas que se apoyan en lo que dejó la 206).
3. **Tres migraciones parchean funciones buscando un texto exacto** (229, 218, 232). Si el texto no
   está, el `replace` no hace nada **y no avisa**. Verificado: el texto que busca la 229 en
   `enviar_notas` existe tal cual en producción. Aun así, hay que comprobar el resultado después
   de aplicarlas (Anexo B, punto 4).
4. **La 221 reescribe ~69 políticas con un bloque dinámico.** La comparación muestra que las
   políticas que comparten los dos lados tienen el mismo nombre (solo 2 difieren, y las 2 se
   borran o reemplazan en el propio paquete: la 024 por la 027 y `personal_lee_todas_rehab` en
   la 231). Riesgo bajo, pero sigue siendo el cambio más delicado: por eso el ensayo (§5).

### 3.2 Cambian lo que ve la gente (avisar)

5. **Material**: el menú del estudiante ya no tiene "Material"; la pantalla vieja `/contenido`
   no tiene ningún enlace en `develop`. Sin el traslado (§4), el estudiante vería Unidades vacío.
6. **Cada corte verá el material de todo el módulo**, no solo el suyo (las unidades son del
   módulo). Probado: después del traslado, PTMA-III ve en Introducción los 2 archivos que subió
   PTMA-II, y PTMA-II ve los 2 de PTMA-III. Con estos datos es el mismo contenido, pero es una
   decisión (§8).
7. **Módulos visibles**: PTMA-II verá los módulos 1 a 3; PTMA-III solo el 1 (regla de la 209).
8. **Asistencia**: desde la 235 la clase del día se crea **todos los días según el calendario**
   (antes, solo los sábados). Revisado con los datos reales:
   - PTMA-III no tiene calendario → sigue como hoy (días de clase + módulo actual). Sin cambio.
   - PTMA-II sí tiene: cubre todos los sábados hasta septiembre 2027, con hueco el 26-dic y el
     2-ene (vacaciones, intencional). Esos dos días no se crearía clase. Si hay clase esos días,
     hay que extender el calendario antes.
   - El horario en texto se convierte bien: "9:00 a.m. - 12:00 p.m." → 09:00–12:00,
     "2:00 p.m. - 6:00 p.m." → 14:00–18:00, "Sábados" → sábado.
9. **Administración deja de poder cambiar notas** (229) y de responder apelaciones (Edge
   Functions). Decisión ya tomada el 20-nov, pero conviene avisarle a la persona de admin.
10. **Tutorial**: los pasos nuevos usan ids nuevos (`nov-est-*`, `nov-prof-*`, `nov-dir-*`,
    `estudiante-lo-proximo`, `estudiante-calendario-flotante`…), que nadie en producción ha visto
    → **sí se les mostrará** la portada "Actualizaciones de la app". Los ids viejos que ya vieron
    (`estudiante-aula` 35 personas, `estudiante-material` 22) ya no están en el tutorial.

### 3.3 Ya resuelto o sin riesgo

- **Producción no tiene nada que staging no tenga**, salvo 1 función de prueba (`seed_user`) y las
  2 políticas viejas del punto 4. Ninguna tabla, disparador ni cron propio de producción se pierde.
- 42 funciones "distintas" a primera vista: 29 eran solo formato/`search_path`; de las 13 reales,
  8 las cambia el propio paquete a propósito y 5 son tildes y comentarios (sin efecto).
- **Error real que hoy tiene producción** y el paquete corrige: `enviar_notas` suma los % de
  **todos los cortes** del módulo. Hoy no molesta (solo PTMA-II tiene evaluaciones, 100 % en cada
  módulo), pero **cuando el profesor de PTMA-III cargue las evaluaciones de Introducción, el
  envío fallará** ("suman más de 100 %"). La 229 lo arregla. Es una razón para no tardar mucho.
- Notas reales: las migraciones de Notas solo tocan evaluaciones ligadas a un examen o tarea
  digital, y producción tiene 0 exámenes y 0 tareas.
- Notificaciones: los 6 tipos que hay en producción caben en la nueva lista permitida.
- Enums: solo se agregan valores (`texto` y 3 tipos nuevos); nada se quita.
- Lo desplegado en producción de `grade-answer` coincide con `main` (revisado el código).
- Variables de entorno: lo único nuevo es `CLOUDCONVERT_API_KEY` (opcional). Push ya funciona en
  producción (20 suscripciones), así que sus claves VAPID ya existen.
- Vault de producción tiene `project_url`, `service_role_key` y `cron_secret_generar_casos`,
  que es lo que usan los crons.

### 3.4 Hallazgos aparte (no bloquean, conviene arreglar)

- **Staging llama a producción**: `fn_generar_caso_del_dia` en staging tiene quemada la dirección
  de producción. Cada sábado, staging intenta pedirle casos a la función de producción (lo frena el
  secreto si es distinto, pero no debería pasar). Corregir en staging.
- **Archivos huérfanos en producción** (~31 MB en `contenido`): 2 copias repetidas de una
  presentación de 15 MB, un informe, un PDF de prueba y **la planilla de consentimiento de un
  estudiante guardada en el bucket de material** (no la ve nadie, pero no debería estar ahí).
- **Configuración de Edge Functions distinta**: en producción `grade-answer`, `submit-attempt`,
  `claim-snack`, `create-staff-user` y `delete-account` corren sin `verify_jwt` (validan la sesión
  dentro del código); en staging, con. Al redesplegar, usar la misma opción que staging y probar.

## 4. Traslado del Material a Unidades (probado)

Qué hace: crea **una unidad "Material del módulo" por cada módulo** que tenga material suelto,
abierta y sin bloqueo, y enlaza ahí cada archivo (en el orden de sus carpetas y fecha). **No mueve,
copia ni borra** archivos, carpetas ni registros: solo los enlaza. La pantalla `/material` de
Dirección sigue igual.

Resultado esperado en producción (con los datos de hoy): **4 unidades** (Introducción de PTMA-II,
Introducción de PTMA-III, Instrumentación y Fluidos de PTMA-II) y 10 enlaces. Cada corte ve solo la suya. Material subido hasta el día del paso también entra (la consulta busca lo
que esté suelto en ese momento).

Prueba en staging (se deshizo al final):
- 6 materiales sueltos → 2 unidades, 6 enlaces, 0 sueltos después.
- **Como estudiante de PTMA-II**: ve 2 unidades, 6 enlaces y los 6 archivos.
- **Como estudiante de PTMA-III**: ve 1 unidad (Introducción), 4 enlaces y 4 archivos.

```sql
-- Correr UNA vez en producción, después de todas las migraciones (incluida la 241).
-- Una unidad "Material del módulo" por cada (módulo, corte), marcada con su corte.
with grupos as (
  select ci.module_id, ci.cohort_id from content_items ci
   where ci.is_published and ci.approval_status = 'aprobado' and ci.type <> 'texto'
     and not exists (select 1 from unit_items ui where ui.content_item_id = ci.id)
   group by ci.module_id, ci.cohort_id
), nuevas as (
  insert into units (module_id, cohort_id, title, order_index, manual_status, gate_mode)
  select g.module_id, g.cohort_id, 'Material del módulo',
         coalesce((select max(u.order_index) from units u where u.module_id = g.module_id), 0)
           + row_number() over (partition by g.module_id order by g.cohort_id nulls first),
         'abierta', 'none'
  from grupos g
  returning id, module_id, cohort_id
)
insert into unit_items (unit_id, type, order_index, content_item_id, required, visible)
select n.id, 'material',
       row_number() over (partition by n.id order by f.name nulls last, ci.created_at),
       ci.id, false, true
from nuevas n
join content_items ci on ci.module_id = n.module_id
 and ci.cohort_id is not distinct from n.cohort_id
 and ci.is_published and ci.approval_status = 'aprobado' and ci.type <> 'texto'
 and not exists (select 1 from unit_items ui where ui.content_item_id = ci.id)
left join content_folders f on f.id = ci.folder_id;
```

Alternativa si se quiere conservar las carpetas: una unidad por carpeta (Introducción quedaría con
"Módulo I.- Introducción…" y "Material del módulo"). Se ve más desordenado; no lo recomiendo.

## 5. Plan por fases

**Fase 0 — Preparar (sin tocar producción)**
1. Congelar `develop` en un commit acordado con la otra sesión.
2. Armar el paquete: un solo archivo con el orden del Anexo A (027 al inicio, 204 y 206 en su
   lugar), sin 188/189 (efecto neto cero), con 199b/230b/234b ya dentro de 199/230/234.
3. Corregir en staging la llamada a producción de `fn_generar_caso_del_dia`.

**Fase 1 — Ensayo sobre una copia de producción**
4. Copia de producción (rama de Supabase o restaurar un respaldo en un proyecto temporal; tiene
   costo, confirmar antes). Aplicar el paquete, correr el traslado y repetir los chequeos del
   Anexo B. Recorrer la app como estudiante de cada corte, profesor, Dirección y admin.

**Fase 2 — Ventana (entre semana por la tarde, sin clase ni examen abierto)**
5. Respaldo de producción y anotar la hora (punto de vuelta atrás).
6. Foto "antes" (Anexo B, punto 1).
7. Aplicar el paquete de migraciones.
8. Correr el traslado de Material (§4).
9. Redesplegar 5 Edge Functions: `grade-answer`, `validate-scan`, `claim-snack`,
   `respond-rehabilitation`, `approve-rehabilitation`.
10. Si se usa: `CLOUDCONVERT_API_KEY` en Vercel (producción).
11. Merge `develop` → `main` (despliega la app).
12. Foto "después" y comparación (Anexo B).

**Fase 3 — Después**
13. Dirección: crear "Inglés técnico" en producción si va (se borró en la 138), asignar profesor a
    PTMA-III en Introducción si todavía falta, y revisar "Datos del corte" de los 2 cortes.
14. Aviso a estudiantes y profesores (push/grupo) el mismo día.
15. Vigilar 48 h: `/monitoreo`, errores de la app, que el sábado se cree la clase y el QR funcione.

**Vuelta atrás**: el código se revierte con `git revert` del merge. La base queda con tablas nuevas
sin usar (no estorban). Si algo grave falla en la base, se restaura el respaldo del paso 5
(perdiendo lo que se haya hecho después, por eso ventana corta).

## 6. Qué tiene que hacer cada rol después

- **Estudiantes**: nada. Verán la portada de novedades al entrar.
- **Profesores**: subir material nuevo dentro de una unidad (ya no hay "Material" aparte).
- **Dirección**: aprobar material como siempre; crear Inglés técnico si toca.
- **Administración**: ya no cambia notas ni responde apelaciones.

## 7. Riesgos que quedan

- La 221 (políticas) y la 233 (horarios) no se pueden probar con los datos reales sin el ensayo.
- La 235 deja sin clase cualquier día fuera del calendario de PTMA-II: confirmar las vacaciones.
- No se verificó en un teléfono real ni con cámara (escaneo QR) en esta pasada.

## 8. Decisiones pendientes (coordinador / Pedro)

> Actualizado con el audio del coordinador (ver tabla al inicio): 1 = **no**, cada corte solo lo suyo; 2 = pendiente (reformulada); 3 = CloudConvert gratis con límite diario, se puede activar; 4 = entre semana en la tarde; 5 = **sí**, ensayo local. Queda nueva: ¿arreglo puntual en producción del tope de 100 % por corte, o esperar al paso?

1. ¿Está bien que cada corte vea el material de todo el módulo (§3.2, punto 6)?
2. ¿Ensayo con rama de Supabase (con costo) o restaurando un respaldo?
3. ¿Fecha y hora de la ventana? (sugerido: martes 24 o miércoles 25 de noviembre por la tarde).
4. ¿Hay clase el 26-dic o el 2-ene en PTMA-II? (si sí, extender el calendario antes).
5. ¿Se contrata CloudConvert (PowerPoint dentro de la app) o sigue abriéndose aparte?

## Anexo A — Orden del paquete

0. **027** `profesor_borra_cualquier_examen` (falta en producción).
1–14. 174 → 187 (Aula Virtual base).
15. 190 `fix_compuerta_content_items` · 16. 193 · 17. 194 · 18. 195 · 19. 196 · 20. 197 ·
21. 199 (incluye 199b) · 22. 200 · 23. 201 · 24. 202 · 25. 203 · **26. 204 (a mano)** · 27. 205.
28. **206 (a mano)** · 29. 207_plantillas · 30. 208_estudiante · 31. 209 · 32. **210** ·
33. **207_remedial** · 34. 208_bloqueo · 35. 211 · 36. 212 · 37. 213 · 38. 214 · 39. 215 ·
40. 216 · 41. 217 · 42. 218 · 43. 219 · 44. 220 · 45. 221 · 46. 222 · 47. 223 · 48. 224 ·
49. 225 · 50. 226 · 51. 227 · 52. 228 · 53. 229 · 54. 230 (incluye 230b) · 55. 231 · 56. 232 ·
57. 233 · 58. 234 (incluye 234b) · 59. 235 · 60. 236 · 61. 237 · 62. 238 · 63. 239.
64. **240** `fix_canal_push_refrigerio_y_devolver_notas` · 65. **241** `unidades_por_corte` (incluye 241b, la vista `v_units_status` con el corte). Agregadas el 21-nov-2026: **66 archivos en total**.

No van: 188/189 (se anulan entre sí), 191/192/198 (ya están en producción), 171–173 (ya están).

## Anexo B — Chequeos antes/después

1. Conteos: `students`, `profiles`, `attendance_events`, `manual_exam_definitions`,
   `manual_exam_scores`, `module_enrollments`, `content_items`, `content_folders`,
   `notifications`, `push_subscriptions`, `feedback_macro`. **Deben quedar iguales.**
2. Suma de notas por corte y módulo (`manual_exam_scores` × definición): igual antes y después.
3. Cada `storage_path` de `content_items` sigue abriéndose.
4. `enviar_notas` ya no contiene `'admin'` y suma por corte; `fn_exam_attempt_prepare` contiene la
   lógica de remedial de la 207 y la prórroga de la 232; políticas `profesor borra sus examenes`
   existe y `personal_lee_todas_rehab` no.
5. Crons: 14, con `generar-sesion-del-sabado` diario (`0 8 * * *`).
6. Traslado: 0 materiales publicados sueltos; un estudiante de cada corte ve su unidad.
7. `cohorts.class_start/class_end/class_weekdays` llenos en los 2 cortes.
8. Advisors de seguridad: sin hallazgos nuevos.
