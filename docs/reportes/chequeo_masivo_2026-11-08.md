# CHEQUEO MASIVO — ZR App, entorno de prueba (`zr-staging`)

**Fecha:** 8 de noviembre de 2026
**Alcance:** todo lo construido en Aula Virtual/E-Learning desde el viernes 6 de noviembre, antes de la reunión de demostración del lunes 9 de noviembre, 9 p.m. (profesor de inglés, Dirección Académica, Pedro, Marco).
**Para:** Pedro (coordinador) — pasar a Marco.

---

## 1. Qué se probó y cómo

Se usaron las 4 cuentas de prueba que ya existían en `zr-staging` (`QA Estudiante Prueba`/"Marco Montoro" V-90000001, `QA Profesor Prueba` V-90000002, `QA Dirección Académica Prueba` V-90000003, y la cuenta `super_admin` de prueba V-10000002). Se les puso una contraseña temporal para poder entrar, se probó de punta a punta, y **al terminar se les volvió a poner una contraseña aleatoria desconocida — no queda ninguna contraseña de prueba activa.**

Se probó en tres anchos de pantalla distintos para cubrir "todo tipo de pantalla" como se pidió:
- **320px** — el ancho de un iPhone viejo (SE 1ª generación), el teléfono más angosto que razonablemente sigue en uso.
- **768px** — tablet.
- **1440px** — monitor de escritorio normal.

Además del recorrido visual pantalla por pantalla, se corrió un chequeo automatizado de **desborde horizontal** (comparar el ancho real de la página contra el ancho de la pantalla) en cada pantalla visitada, en los tres anchos — esto encuentra desbordes que a simple vista a veces no se notan pero sí se sienten como "la pantalla se corre" en un teléfono real.

## 2. Bugs encontrados y corregidos en esta pasada

| # | Bug | Causa | Corrección |
|---|---|---|---|
| 1 | El pellizco con dos dedos para acercar imagen/documento **no funcionaba** (los botones +/- sí) | Se había reinventado el gesto a mano con JavaScript; un primer intento (`touch-action`) tampoco bastó | Se reactivó el **zoom nativo del navegador**, pero solo en las 3 pantallas que muestran material (imagen/PDF/Word) — el resto de la app lo sigue teniendo apagado, como se pidió en octubre. Verificado con el `<meta viewport>` real de cada pantalla, no solo a simple vista. |
| 2 | La etiqueta "Obligatorio" se superponía con el botón "Quitar" en rojo | El componente de etiquetas no dejaba partir el texto en dos líneas | Corregido; y en una segunda vuelta, rediseñada la tarjeta completa de cada ítem de la unidad (ícono arriba, título a todo el ancho, botones al final) — pedido explícito sobre el primer arreglo porque "se veía feo". |
| 3 | Dos selectores (`<select>`) en "Agregar material ya subido" y "Mini-chequeo al terminar" se salían de la pantalla en un teléfono de 320px | Un `<select>` nativo no se encoge por debajo del ancho de su opción más larga, a diferencia de una caja normal | Corregido en los dos; se revisaron los otros 13 selectores de la app y ninguno más tiene este riesgo. |

Los tres se corrigieron, se verificaron en vivo (incluida la subida/calificación real de datos, no solo mirar la pantalla) y ya están en `zr-staging`.

## 3. Verificado funcionando, sin bugs encontrados

- **Certificación vs. práctica**: al crear/editar un examen de certificación, ya no aparecen "Intentos"/"Espera entre intentos" (siempre es 1 intento); si es práctica, siguen apareciendo.
- **Calificar una redacción como `super_admin`**: se calificó una de verdad (puntaje 8/10, nota final 13/20) sin el error de "no se pudo guardar" que había antes — el arreglo de la base de hace unos días (`graded_by` referenciando `profiles`, no `teachers`) sigue funcionando.
- **La nota llegó sola a Notas** (fusión Aula Virtual → Notas, H.33): se confirmó en la base que la calificación de la redacción generó la fila en `manual_exam_scores` sin que nadie la registrara a mano.
- **Dirección Académica/`super_admin` entran a Unidades como ellos mismos** (sin el banner de "vista de profesor"), con "Unidades" como primer botón de su menú.
- **Ningún desborde horizontal** en `/unidades`, `/unidades-docente/[unitId]`, `/crear-examen`, `/crear-examen/nuevo`, `/crear-examen/[examId]`, `/calificar/[examId]`, `/calificar/[examId]/[attemptId]`, `/notas-academicas/[cohortId]`, `/cohortes`, `/material`, `/personal`, `/configuracion`, `/panel`, `/hoy`, `/dudas-docente`, `/notas-docente`, `/temario-docente`, `/perfil-docente`, `/contenido-docente`, `/feedback-modulo-docente` — en ninguno de los tres anchos probados.
- **Advisors de seguridad de la base** (`zr-staging`): sin hallazgos nuevos. Los 7 avisos que salen son el mismo patrón ya documentado en sesiones anteriores (funciones `SECURITY DEFINER` expuestas como RPC — no explotable, es así en TODA la base, no algo de esta semana) — nada que corregir hoy.

## 4. Lo que NO se alcanzó a cubrir en esta pasada (para que quede claro, no para ocultarlo)

- No se recorrieron literalmente las ~180 funciones del documento maestro en los 4 perfiles — eso es un chequeo de varios días. Esta pasada se concentró en **Aula Virtual y lo tocado desde el viernes**, que es justo lo que se muestra en la reunión del lunes.
- No se probó en un teléfono físico real (Samsung/iPhone de verdad) — todo lo de arriba se verificó con el emulador de pantallas del navegador de pruebas, que simula el ancho real pero no reemplaza completamente un teléfono en la mano. **Recomendación:** que alguien lo abra rápido en su propio teléfono antes de la reunión, sobre todo el pellizco de imagen (gesto nativo, depende un poco del navegador de cada teléfono).
- No se tocaron los roles `vendedor` ni `zr_coffee` en esta pasada (no son parte de la demo del lunes).
- No se re-probaron a fondo los módulos ya estables de antes (Asistencia, ZR Coffee, Finanzas) — se asume que siguen como estaban, no se tocó código ahí esta semana.

## 5. Estado para la reunión del lunes

Todo lo de Aula Virtual (incluyendo los 3 ajustes de esta noche) está en `zr-staging`, construido y probado. **Nada de esto está en `zr-prod`** — sigue la regla del proyecto de no mezclar hasta que Pedro/el coordinador lo aprueben después de sus propias pruebas.

---

Ver la lista completa y detallada de todos los cambios desde el viernes 6 de noviembre en
[`cambios_2026-11-06_a_2026-11-08.md`](./cambios_2026-11-06_a_2026-11-08.md), en esta misma carpeta.
