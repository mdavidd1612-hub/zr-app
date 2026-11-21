# Ensayo del paso a producción — 21-nov-2026

Pedido por el coordinador ("Haz el ensayo a ver"). Se hizo en una copia local de `zr-prod`
(Docker en la computadora de trabajo). **Producción no se tocó**: solo se leyó para sacar la copia.
La copia se borró al terminar.

## Resultado en una línea

**El paquete entra completo y sin errores sobre los datos reales de producción, y no cambia ni
pierde ningún dato.** Aparecieron 2 fallas que ya existen hoy en producción y no vienen del paquete.

## Cómo se hizo

1. Copia de producción con `supabase db dump`: roles, esquema y datos, incluidos los usuarios y
   el índice de archivos. Los archivos de Storage no se copiaron; solo el índice.
2. Base local Supabase 17 (`ensayo/local`) con la copia restaurada.
3. Chequeos "antes".
4. Las 64 migraciones en el orden real de staging (Anexo A del plan), cada una en su propia
   transacción, deteniéndose al primer error.
5. Traslado del Material a Unidades (§4 del plan).
6. Chequeos "después", revisión de permisos como estudiante de cada corte y revisor automático
   (`supabase db lint`).

## Resultados

| Chequeo | Resultado |
|---|---|
| 64 migraciones | ✅ Las 64 entraron, 0 errores. Solo avisos normales de "no existía, se salta". |
| Conteos (estudiantes 36, perfiles 46, usuarios 48, asistencias 231, evaluaciones 16, notas 315, inscripciones a módulo 75, material 10, carpetas 2, avisos 252, suscripciones push 20, feedback 32, sesiones 13, archivos 21) | ✅ Idénticos antes y después |
| Suma de notas por corte y módulo (Instrumentación 220 notas / 16 621,00; Introducción 95 / 1 533,05) | ✅ Idéntica |
| Material con archivo existente | ✅ 10 de 10 |
| `enviar_notas` sin admin, remedial/prórroga en `fn_exam_attempt_prepare`, políticas de exámenes y apelaciones | ✅ |
| Horario estructurado de los 2 cortes | ✅ PTMA-II sáb 9:00–12:00, PTMA-III sáb 14:00–18:00 |
| Tablas sin RLS | ✅ Ninguna |
| Crons nuevos | ✅ 5 creados (`generar-sesion-del-sabado` diario a las 8). Con los 9 que ya tiene producción quedan 14. |
| Traslado del material | ✅ 3 unidades "Material del módulo" (Introducción 4, Instrumentación 5, Fluidos 1), 10 enlaces, 0 sueltos |
| Como estudiante de PTMA-II | ✅ 3 unidades, 10 enlaces, 10 archivos |
| Como estudiante de PTMA-III | ✅ 1 unidad (Introducción), 4 enlaces, 4 archivos |
| PTMA-III registra una evaluación del 20 % en Introducción (hoy en producción falla por el tope de 100 % compartido) | ✅ Funciona (probado y deshecho) |

## Lo que encontró el ensayo (ya está roto hoy en producción)

1. **El aviso "Ya puedes pasar por tu refrigerio" nunca llega.** La función
   `fn_notify_hora_refrigerio` (cron cada 5 min) falla con
   `column "channel" is of type notification_channel but expression is of type text`. En
   producción lleva **41 corridas fallidas**, la última el 20-nov. El `'push'` dentro de un
   `select distinct` necesita `'push'::notification_channel`.
2. **"Devolver notas" de Dirección Académica falla** (`devolver_notas`, botón en Notas
   académicas): mismo error, misma causa.

Arreglo: una migración nueva de 2 líneas que corrige el tipo en las dos funciones. No está en el
paquete. Se propone agregarla al paso; por estar roto hoy, también podría ir sola antes.

## Lo que el ensayo no cubre

- **Material solo del propio corte** (decisión del coordinador). Todavía no está construido: hoy
  el traslado crea una unidad por módulo, y PTMA-III vería en Introducción el material de PTMA-II.
  Hay que construirlo en staging y repetir este ensayo antes del paso.
- Edge Functions y variables de Vercel: no se pueden ensayar en local; quedan en la lista del plan.
- Los archivos de Storage en sí; solo se verificó que cada registro tenga su archivo en el índice.
- La versión local de Storage es más vieja que la de producción: se agregaron 6 columnas de
  versionado a `storage.buckets/objects` solo para poder cargar la copia. No afecta al paquete.

## Para repetirlo (antes del paso real)

- Conexión: `aws-0-us-east-1.pooler.supabase.com`, **puerto 6543**. La red de la oficina bloquea
  el 5432, y `aws-1` no es el clúster del proyecto.
- Quitar del `roles.sql` la línea `GRANT SET ON PARAMETER "log_min_messages"`, que local no permite.
- Restaurar con `--single-transaction`, `ON_ERROR_STOP=1` y `SET session_replication_role = replica`
  antes de los datos.
- Después del ensayo, **cambiar la clave de la base de producción**: se compartió en fotos.
