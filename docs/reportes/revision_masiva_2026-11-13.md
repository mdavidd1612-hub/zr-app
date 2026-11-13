# Revisión masiva de staging — 13-nov-2026

Alcance: Unidades, Notas, Exámenes, Material y lo que tocan, en los perfiles super_admin, dirección académica, profesor y estudiante, contra `zr-staging` (`develop`). Después de la reunión del 9-nov (Pedro, Dirección Académica, profesor de inglés).

## Cómo se probó
- Cuentas de prueba reales en staging (super_admin, dirección QA, profesor QA, estudiantes QA), app local contra `zr-staging`.
- **Matriz de permisos reales (RLS)**: 4 personas × 2 cohortes activas × 13 módulos, insertando material, examen y unidad con el rol de cada una (con rollback). 208 combinaciones.
- Recorrido de rutas por rol con detección de errores en pantalla y de desborde horizontal; estudiante además a 320 px.
- Flujos completos en UI: subir material desde una unidad (con y sin hueco de orden), crear examen desde una unidad, enlace de Google Drive, perfil de estudiante nuevo.
- Logs de la API de Supabase (últimas 24 h), advisors de seguridad, estado de GitHub Actions.

## Qué pasaba con "solo funciona en PTMA-2026-II / módulo 2"
Hay **dos causas distintas**, no una:

1. **Bug real (corregido): subir material, examen, tarea o bloque de texto desde una unidad fallaba en silencio.**
   - El orden del ítem se calculaba como `cantidad + 1`. Al quitar un ítem queda un hueco y el insert choca con `UNIQUE (unit_id, order_index)`; el error se ignoraba y la pantalla volvía a la unidad sin nada.
   - Además, desde la unidad se usaba el programa/módulo guardado en el selector (no el de la unidad), y el examen tomaba la *primera* cohorte activa de la lista. Con más de una cohorte o módulo, el contenido caía en otro módulo o la base lo rechazaba.
   - Arreglo: `lib/unidad-orden.ts` (máximo real + 1), `lib/cohorte-unidad.ts` (cohorte según el módulo de la unidad y las asignaciones reales de quien sube) y error visible si algo falla. Verificado en vivo, incluido el caso del hueco.
2. **Regla de producto, no bug (migración 158): el profesor solo escribe en módulos vigentes de su cohorte.** Un módulo que aún no empieza según el calendario sale como "Aún no empieza" y la base rechaza la subida; un módulo que no tiene asignado tampoco. Dirección y super_admin **no** tienen esa restricción (la matriz da OK en los 26 módulos de las dos cohortes). Ahora el profesor ve un mensaje claro en vez de "violates row-level security". **Decisión pendiente de Pedro/Marco:** si se quiere que el profesor pueda preparar módulos futuros, hay que cambiar `profesor_dicta` y `profesor_ve_material`.

## Bugs encontrados y corregidos
| # | Dónde | Problema | Arreglo |
|---|---|---|---|
| 1 | Subida desde unidad (4 sitios + tarea + texto) | `order_index` por conteo, error ignorado | helper `siguienteOrdenUnidad` + error visible |
| 2 | Subida/examen desde unidad | cohorte/módulo tomados del selector o de la primera cohorte | `cohorteParaModulo` |
| 3 | `/examenes-academicos` | mostraba 0 exámenes: el embed usaba la FK vieja a `teachers` (cambiada a `profiles` por la migración 196) | embed a `profiles` |
| 4 | `/crear-examen` | dirección/super_admin veían 0 exámenes (filtro por dueño) | ven todos; el profesor solo los suyos |
| 5 | `/api/delete-exams` | dirección/super_admin no podían borrar exámenes de otros | rol leído en servidor, permitido a esos dos roles |
| 6 | `/crear-examen/nuevo` | decía "Módulo:" y mostraba el nombre de la unidad | dice "Unidad:" |
| 7 | Calificar tarea | aceptaba cualquier número, ignoraba errores | validación 0–20 y mensaje de error |
| 8 | `/cohortes` | cohorte activa sin módulo no avisaba (pendiente desde §8.8) | aviso visible |
| 9 | `develop` no compilaba | `/electude` (otro colaborador) con comentarios JSX mal cerrados y su inserción a medias en el Inicio | reparada la pantalla; se quitó la inserción en el Inicio de todos los estudiantes (ver abajo) |
| 10 | GitHub Actions | el CI fallaba en 6 s en cada push (`upload-artifact@v3` bloqueado) | ver sección CI |

## Cambios de la reunión (todo lo que no era de Arjona)
- **Videos y audios por enlace de Google Drive** (además de YouTube): `lib/material.ts` (`idDeDrive`, `embedDeEnlace`), `VisorMaterial`, formulario de material ("Video por enlace") y tour del profesor. Se reproduce con el visor `/preview` de Drive; el archivo debe estar compartido como "cualquier persona con el enlace" (el formulario lo explica). Probado en vivo: se guarda, se enlaza a la unidad y el iframe apunta al visor correcto. No se pudo probar la reproducción de un video real (no hay un archivo de Drive público de prueba).
- **Perfil de estudiante adicional para pruebas**: cédula `V-90000004`, "QA Estudiante Prueba 2", cohorte PTMA-2026-II, con los módulos 2 y actual, perfil INCES y términos ya completos para entrar directo. Verificado: entra, ve Unidades, Exámenes, Calendario, Notas, Dudas, Malla y Perfil.
- **Despliegue a producción jueves/viernes (compromiso de Pedro)**: no se hizo; sigue pendiente y requiere decisión explícita (ver riesgos).
- Tarea de Arjona (cargar material de prueba): no se tocó, como se pidió.

## Revisiones
- **Revisión 1 (antes de los cambios)**: matriz RLS, recorrido de rutas, flujo de subida. Encontró #1, #2, #3, #4, #9.
- **Revisión 2 (después de los cambios)**: typecheck y build limpios; repetido el flujo de subida desde unidad (con hueco), examen desde unidad (cohorte PTMA-III correcta, enlazado), enlace de Drive, `/examenes-academicos` y `/crear-examen` como super_admin, rutas del estudiante a 1024 y 320 px (sin desborde), `/crear-examen` como profesor.
- Logs de API de staging en 24 h: un único 400 (el de `/examenes-academicos`, ya corregido). Advisors de seguridad: solo los hallazgos conocidos de siempre (funciones `SECURITY DEFINER` ejecutables por `anon`/`authenticated`, vista `SECURITY DEFINER`, protección de contraseñas filtradas, extensiones en `public`); nada nuevo.

## Riesgos y pendientes (no se resolvieron, necesitan decisión)
1. **Las unidades son por módulo y se comparten entre cohortes** (`units` no tiene `cohort_id`), mientras el material y los exámenes sí son por cohorte. Hoy PTMA-II y PTMA-III ven las mismas unidades del mismo módulo, con contenido de cada cohorte mezclado para el personal. Los estudiantes solo ven lo de su cohorte (RLS), pero ven los huecos. No molesta mientras las cohortes estén en módulos distintos; sí cuando coincidan. Arreglo real: `units.cohort_id` + RLS de estudiante; es un cambio grande, no se hizo antes del sábado.
2. **CI**: el workflow estaba roto. Ahora `typecheck` + `build` son la puerta bloqueante. Las pruebas con BD (`db-tests`) siguen fallando porque las migraciones no se reproducen desde cero (`ALTER TYPE ... ADD VALUE` de la 021 en la misma transacción) — marcado como no bloqueante, pendiente de Marco.
3. **`/electude`**: lo creó otro colaborador (guayamuripm-boop) a medias. Está como ruta propia compilando, pero **no enlazada** desde el Inicio; quien la siga debe volver a integrarla bien (la versión anterior usaba un import y props que no existen).
4. **Edge Functions `validate-scan` y `claim-snack`** no incluyen `direccion_academica` en los roles permitidos (mismo patrón que tuvo `grade-answer`). No se tocó: no es Aula Virtual y se despliega por separado.
5. **Vercel**: este conector devuelve 403 al listar despliegues, así que no se pudo confirmar el estado de los deploys de `develop`. Conviene mirarlo a mano.
6. `lib/database.types.ts` sigue con las FK viejas (`teachers`) tras la 196; no rompe en ejecución pero hay que regenerarlo.
7. **Producción (`zr-prod`)**: no se tocó nada. Para el despliegue de jueves/viernes faltan decidir qué migraciones de staging (174–205) suben y probarlas con datos reales.

## Credenciales de prueba (solo staging)
- Estudiante nuevo: cédula `V-90000004`, clave `ZrPrueba2026!`.
- Las claves temporales de las otras cuentas QA se dejaron aleatorias de nuevo al terminar.
