# 23 · Cómo se hizo esta auditoría (24 de octubre de 2026)

Documento corto, para que quede dicho exactamente qué se hizo y cómo — pedido
explícito de la reunión con Marco.

## Qué se pidió

Actualizar el documento maestro (`CLAUDE.md`/`AGENTS.md`), que llevaba meses sin
reflejar la realidad, basándose en **producción** (no en `develop`, que tiene
trabajo en curso sin terminar), comparar contra el documento anterior, conservar
lo que seguía pendiente a propósito, y entender en qué fase está el proyecto de
verdad antes de agregar nada.

## Por qué "basarse en producción" y no en el código o los documentos

Jerarquía usada (la misma que ya establece `CLAUDE.md` §5, aplicada aquí a todo el
proyecto, no solo a migraciones): **lo que de verdad corre le gana a lo que el
código dice que debería correr, que le gana a lo que un documento dice que se
construyó.** Un archivo de migración puede existir en el repo y no haber llegado
nunca a producción (le pasó a `develop` con el trabajo de Aula Virtual de esta
misma sesión); un documento puede describir una función que después se abandonó
(le pasó al motor de exámenes digitales). Solo la base de datos y las funciones
desplegadas de verdad en `zr-prod` dicen la verdad sin intermediarios.

## Qué se leyó, en orden

1. **Producción, directo** (`zr-prod`, `hagbqhnittynxebdssua`): lista completa de
   tablas con conteo de filas reales (no solo si existen — si tienen datos, para
   distinguir "existe pero no se usa" de "existe y es el corazón del sistema"),
   roles reales agrupados y contados, migraciones aplicadas (131, con nombre y
   fecha de la última), funciones Edge desplegadas, claves de `system_config` con
   su descripción.
2. **El documento maestro actual completo**, ya en contexto de esta sesión.
3. **`docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md`**, el traspaso de auditoría más
   reciente que existía (1 de septiembre de 2026) — para no reinventar lo que ya
   estaba identificado como pendiente ni reclasificar como "nuevo" algo que ya se
   había decidido posponer a propósito.
4. **La lista de rutas reales de la rama `main`** (`git ls-tree`), para comparar
   qué pantallas existen de verdad contra lo que el documento maestro listaba como
   Fase 1.
5. **Una migración puntual** (`147_notas_en_produccion.sql`) para confirmar, con
   el propio comentario del autor original dentro del archivo, por qué existe el
   sistema de Notas y cómo se relaciona (o no) con el motor de exámenes.

## Qué NO se hizo

- No se tocó la base de datos de producción — ninguna escritura, solo lecturas.
- No se desplegó nada, no se aplicó ninguna migración.
- No se modificó `CLAUDE.md`/`AGENTS.md` directamente — se escribió un documento
  nuevo aparte, para que la validación de Pedro sea sobre un borrador, no sobre un
  reemplazo ya hecho.
- No se auditó cada una de las 131 migraciones línea por línea — se priorizaron
  las que describían cambios estructurales grandes y se confirmó su efecto final
  contra las tablas y columnas reales, no contra el historial completo de cómo se
  llegó ahí.

## Entregables de esta sesión

1. `docs/21_DOCUMENTO_MAESTRO_NUEVO_OCT2026.md` — el documento maestro
   reconstruido.
2. `docs/22_COMPARATIVO_MAESTRO_VIEJO_VS_NUEVO.md` — qué cambió, qué se confirma,
   qué se deja igual a propósito, y qué preguntas de producto quedan sin
   responder.
3. Este documento.

Ningún archivo de código ni de base de datos se modificó durante esta auditoría.
