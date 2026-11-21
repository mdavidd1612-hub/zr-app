# Paso a producción — 21-nov-2026 (v2.00)

Pedido del coordinador: respaldar todo, repetir el ensayo, comparar con staging, revisar la app en
cada perfil y, si todo salía bien, pasar a producción de una vez, sin preguntar.

## Resultado

**Todo lo de `develop` ya está en producción** (`zr-prod` y `main`). No se perdió ni cambió ningún
dato: los conteos y la suma de notas son iguales antes y después. La estructura de producción quedó
idéntica a la del ensayo.

## 1. Respaldo

- Respaldo completo de producción (roles, estructura y todos los datos, incluidos usuarios), sacado
  por el coordinador a las 11:53 a. m. con `respaldar.ps1`.
- Guardado fuera de OneDrive: `C:\Users\mdavi\zr-respaldos\prod_2026-11-21_1153\`
  (`roles.sql`, `esquema.sql`, `datos.sql`, ~12 MB). **No borrar**: es el punto de vuelta atrás.
- Los archivos (PDF, videos, fotos) no se copiaron: ninguna migración los toca.

## 2. Ensayo repetido (copia local de ese mismo respaldo)

- 67 migraciones en el orden real de staging (las 64 del ensayo anterior + 240, 241 y la nueva
  242): **0 errores**.
- Conteos antes/después idénticos: 36 estudiantes, 46 perfiles, 48 usuarios, 247 asistencias,
  16 evaluaciones, 315 notas (suma 18 154,05), 75 inscripciones a módulo, 10 materiales,
  2 carpetas, 278 avisos, 20 teléfonos con avisos, 32 feedback, 15 clases, 21 archivos.
- Traslado del material: 4 unidades «Material del módulo» (Introducción en PTMA-II y en PTMA-III,
  Instrumentación y Fluidos en PTMA-II), 10 enlaces, 0 sueltos. Como estudiante de PTMA-II se ven
  3 unidades y 8 archivos; como estudiante de PTMA-III, 1 unidad y 2 archivos.
- PTMA-III ya puede registrar una evaluación del 20 % en Introducción (antes chocaba con el tope
  del 100 % compartido).

### Chequeo de la app sobre la copia (datos reales, cuentas reales con clave local de prueba)

La app corrió en local contra la copia (nunca contra producción). En la copia se puso una clave de
prueba a 6 cuentas reales; esa copia es local y se borra.

| Perfil | Pantallas | Resultado |
|---|---|---|
| Estudiante PTMA-II | 14 en teléfono, 12 en PC | ✅ Sin desbordes ni errores. Vio la pantalla de actualización obligatoria, la animación, y recorrió el tutorial completo (22 pasos) hasta «Terminar». En Unidades, su «Material del módulo» de Fluidos. |
| Estudiante PTMA-III | actualización + tutorial completo + Unidades | ✅ Ve solo su unidad de Introducción. |
| Profesor (Isaac Sánchez) | 13 × teléfono y PC | ✅ |
| Dirección Académica | 18 × teléfono y PC (incluye calendario general) | ✅ |
| Administración | 9 × teléfono y PC | ✅ |

Asistencia y refrigerio dicen «No se pudo» solo porque el navegador de pruebas no tiene cámara.

## 3. Comparación con staging

Se comparó la huella completa de la copia ya migrada contra staging (tablas, columnas, políticas,
restricciones, funciones, disparadores, índices, enums, buckets). Diferencias encontradas:

| Diferencia | Qué es | Qué se hizo |
|---|---|---|
| Política «profesor: escribir contenido…» | En staging se había cambiado a mano (sin migración): el profesor que dicta el módulo puede editar cualquier material del módulo y corte. Producción tenía la versión vieja (solo lo que él subió). | **Migración 242** que deja las dos bases como staging (lo probado). |
| `fn_eliminar_unidad`, `fn_metricas_app` | Solo código sobrante que no se usa (una variable). | Nada: hacen lo mismo. |
| `fn_notify_notas_registradas_*` | Existen en staging; producción las quitó a propósito (migración 135). | Nada. |
| Decimales y 2 checks en notas (`numeric` sin precisión en producción) | Historia propia de producción. | Nada: funciona igual. |
| Bucket `avatars` | Límite propio de producción. | Nada. |
| 9 políticas de archivos | El respaldo no las trae, pero producción sí las tiene (verificado). Ningún nombre choca con las del paquete. | Nada. |

Staging tuvo su chequeo total completo esta misma mañana (`chequeo_total_staging_2026-11-21.md`);
después solo cambió el carnet (v1.98) y la pantalla de actualización (v1.99), los dos verificados en
pantalla.

## 4. Producción

1. **67 migraciones** aplicadas una por una, en el orden del ensayo. Todas sin error.
2. **Traslado del material**: 4 unidades, 10 enlaces (igual que el ensayo).
3. **Comparación final**: la huella de producción (93 grupos: cada tabla con sus columnas,
   políticas y restricciones, más funciones, disparadores, índices, enums, buckets, crons y las
   unidades creadas) es **idéntica** a la del ensayo.
4. **Datos**: conteos y suma de notas idénticos a la foto de antes. 14 tareas programadas
   (10 + 5 nuevas − 1 que se actualizó). La clase de hoy de los dos cortes sigue creada.
5. **5 Edge Functions** redesplegadas (`validate-scan`, `claim-snack`, `respond-rehabilitation`,
   `approve-rehabilitation`, `grade-answer`), cada una con su misma configuración de `verify_jwt`
   de antes (no se cambió la seguridad, solo el código).
6. **Código**: `main` quedó con el mismo contenido que `develop` (commit de unión con los dos
   padres). Los 16 commits propios de `main` ya estaban en `develop` por contenido; los únicos que
   no, son los 2 que sacaban Unidades de producción, y esos ya no aplican.

## 5. Lo que no se pudo verificar

- Cámara (escanear QR de asistencia y refrigerio): el navegador de pruebas no tiene.
- Avisos push llegando a un teléfono real.
- Teléfonos físicos.
- Ver los archivos reales del material (la copia local no tiene los archivos, solo sus registros).

## 6. Pendiente

- Avisar a estudiantes y profesores (al entrar verán la actualización obligatoria y el tutorial).
- Dirección: crear «Inglés técnico» si va, y marcar su tramo virtual.
- **Cambiar la clave de la base de producción** (salió en fotos).
- `CLOUDCONVERT_API_KEY` en Vercel si se quiere ver PowerPoint dentro de la app.
- Vigilar 48 h `/monitoreo` y que el sábado 28 se cree la clase y funcione el QR.

## Vuelta atrás

- Código: `git revert` del commit de unión en `main`.
- Base: las tablas nuevas no estorban. Si algo grave falla, se restaura el respaldo del paso 1
  (se perdería lo hecho después de las 11:53 a. m. del 21-nov).
