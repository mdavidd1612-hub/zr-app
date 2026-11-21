# Evaluación LMS, pedagogía, UX y visual — 20 de noviembre de 2026 (v1.82, staging)

Tres revisores independientes (ingeniero de LMS y pedagogía, experto en UX móvil, diseñador de sistemas visuales) leyeron el código y el documento maestro. Cada hallazgo se verificó contra la base o el código antes de tocarlo; lo que es decisión de producto quedó como pregunta. **Producción no se tocó.**

## 1. Corregido (con prueba)

| # | Qué pasaba | Por qué pasaba | Arreglo |
|---|---|---|---|
| 1 | Una certificación copiada a otro corte ("Usar en otro corte") **trababa para siempre** la unidad siguiente | La compuerta no miraba el corte: exigía aprobar también la copia de PTMA-III, que el estudiante de PTMA-II no puede ni ver | Migr. 230: solo cuentan certificaciones de su corte |
| 2 | La certificación de una unidad **no trababa nada** si había huecos en el orden (Inglés: 1, 2, 10, 11) | Buscaba la unidad con `orden - 1` exacto | Migr. 230b: la anterior real (mayor orden menor). Verificado: la unidad 10 ahora espera la certificación de la 2 |
| 3 | El aviso "examen por corregir" le llegaba solo a quien creó el examen | Si cambia el profesor en Cobertura, el nuevo no se enteraba | Migr. 230: también al profesor asignado al módulo en ese corte |
| 4 | **"Apelar nota" no le llegaba a nadie** | `/rehabilitaciones` no tenía enlace ni estaba permitida en el proxy; además cualquier profesor veía apelaciones de módulos ajenos y Dirección no las veía | "Apelaciones pendientes" en *Lo que te espera* de Hoy, ruta permitida, migr. 231 (cada uno ve las de sus exámenes) |
| 5 | Hoy contaba "exámenes por corregir" solo de los creados por el profesor | Mismo origen que el 3 | Ahora por sus módulos (la base lo acota) |
| 6 | El tutorial prometía "lo que antes veías en Material ahora vive aquí" | Solo será cierto cuando se traslade el Material de producción | Texto neutro: "todo tu módulo ordenado por unidad" |
| 7 | El tutorial del profesor hablaba de "Unidades" y su menú dice "Mi módulo"; el de Dirección decía que Material ya no existe | Textos escritos antes de la unificación | Textos actualizados, más cortos (ids intactos) |
| 8 | "Aula Virtual" como título en 6 pantallas, sin ningún menú con ese nombre | Nombre viejo | "Unidades" / "Mi módulo" |
| 9 | Asistencia y refrigerio decían "Revisa tu conexión" ante cualquier fallo | Mensaje por defecto | "No se registró. Vuelve a escanear; si falla otra vez, pide que te registren a mano." |
| 10 | Sin red, las pantallas fallaban sin avisar | No había detector | Cinta "Sin conexión" (con enlace a Descargas para el estudiante) |
| 11 | Texto rojo, ámbar, verde y azul pequeño por debajo de contraste AA; foco casi invisible | Colores de estado pensados para fondo, usados como texto | Tonos de texto más claros y foco azul claro |
| 12 | Tirones en gama baja | Desenfoque de 40 px apilado y mezcla de capas en la tarjeta destacada | Desenfoque a 12 px, grano sin mezcla |
| 13 | Botones de cerrar de 28–36 px; rótulos de la barra en 10 px | — | 44 px y 11 px |
| 14 | Fechas del calendario de módulos y tipo de evaluación apretados a 320 px | Cuadrículas de 3 columnas fijas | 1 columna en teléfono (2 en tipos), 3 desde 640 px |
| 15 | Semáforo de Monitoreo con un ámbar distinto al de la app | Color fuera de los tokens | Token de la app |

## 2. Decisiones (respondidas el 20-nov-2026: todas aprobadas menos la 6 — construidas en v1.83, migración 232)

1. **Tope del 80 % en el remedial vs. "repetir no castiga" (§5.1 regla 3).** Es una decisión documentada, pero tiene un efecto lateral: si la nota mínima de una certificación es mayor que el 80 % del máximo (p. ej. 17/20), el remedial **nunca** puede aprobar. Opciones: (a) que el constructor no deje guardar eso; (b) que el tope no cuente para decidir si aprobó y desbloquea.
2. **Estudiante que agota intento y remedial queda bloqueado en la unidad siguiente.** La única salida es dar un intento extra, y no hay botón visible para eso. Propuesta: "Dar intento extra" en la lista de quienes presentaron el examen (como el "user override" de Moodle).
3. **Estudiante que se cambia de corte.** Sus notas y certificaciones quedan en el corte viejo (exámenes y columnas son por corte). ¿Se copian al nuevo, se repiten, o lo ajusta Dirección a mano?
4. **Notas digitales visibles al instante** (antes de que Dirección valide). Si luego se corrige una redacción, la nota "cambia" ante el estudiante. ¿Rotularlas "provisional hasta el cierre del módulo"?
5. **Material subido dentro de una unidad sigue esperando aprobación de Dirección.** Es la causa número uno de "Todavía no disponible". ¿Se aprueba solo cuando lo sube el profesor asignado?
6. **Un solo nombre para PTMA-2026-II:** hoy se le dice "programa", "corte" y "cohorte". Recomendación: **Corte** para PTMA-2026-II y **Programa** solo para PTMA/PFTA.
7. **"Mi módulo" significa dos cosas:** para el estudiante es su avance (malla, progreso); para el profesor es su aula. ¿Renombrar la del estudiante a "Mi avance"?
8. **Barra del teléfono de Dirección:** pediste Programas en lugar de Asistencia. El sábado Asistencia queda a 2 toques. ¿Se queda así?
9. **Estudiante que entra tarde** a un examen ya cerrado no puede presentarlo. ¿Prórroga por estudiante?
10. **`/reportes` y `/sesiones`** no tienen ningún acceso. ¿Se retiran o se les da entrada?

## 3. Propuesto, no aplicado todavía

- **Primitivas visuales** (`zr-btn`, `zr-btn-sec`, `zr-chip`, `zr-input`, `zr-label`, `zr-tile-icon`, `zr-aviso`): hay 4–5 versiones a mano de cada una. Unificarlas toca muchas pantallas y conviene hacerlo en una pasada dedicada, revisando a ojo cada una; no se mezcló con los arreglos de hoy para no introducir sorpresas antes del paso a producción.
- Mover un examen de corte mientras no tenga intentos; mostrar "Este examen es para: PTMA-2026-X" al crearlo.
- Avisar antes de reenviar una tarea ya calificada (la nota se reemplaza por la de la nueva entrega).
- Copiar el archivo al importar una plantilla (hoy comparte el del original).

## 4. Para el paso a producción

Se suma a `docs/reportes/plan_paso_a_produccion_2026-11-19.md`:
- Aplicar las migraciones **en el orden real de staging** (no por número); las de hoy son 227–231 más 230b.
- En `zr-prod` el módulo de Inglés fue borrado (migr. 138): crearlo antes de abrir el tramo virtual.
- Asignar profesor al módulo actual de cada corte (en staging, PTMA-2026-III no tiene).
- El tutorial ya no promete el Material viejo; si se hace el traslado, se puede volver a decir.
