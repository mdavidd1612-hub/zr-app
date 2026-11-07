# SÁBADO 7 DE NOVIEMBRE — qué probar y qué sigue

> Basado en `docs/26_PAQUETE_COMPLETO_TECNICO_OCT2026.md` (documento maestro) y en los dos chequeos masivos de hoy (`chequeo_masivo_produccion_2026-11-07.md`, `chequeo_masivo_staging_2026-11-07.md`).
> **Nada de esto se sube a producción todavía.** La lista 1 es justo para decidir cuándo sí.

---

## LISTA 1 — PRUEBAS DE LO NUEVO (entorno de prueba, no producción)

Esto es lo nuevo que está en `zr-staging`/`develop` y que **los estudiantes reales todavía no ven**: el módulo completo de Aula Virtual ("Unidades") — materiales, exámenes, tareas, dudas por unidad, compuerta de certificación — más la ronda de rediseño "recorrido orgánico" de esta semana.

**Dónde probar:** `https://zr-app-git-develop-mt-projects12.vercel.app` (la app va a mostrar un banner amarillo "ENTORNO DE PRUEBA" — si no lo ves, no es este entorno, no sigas probando ahí).

**Con qué cuenta:** ya existen cuentas hechas para esto — `QA Estudiante Prueba` (V-90000001), `QA Profesor Prueba` (V-90000002), `QA Dirección Académica Prueba` (V-90000003). Hoy, al cerrar el chequeo de staging, les puse una clave aleatoria que nadie conoce (por seguridad, no se queda ninguna clave de prueba activa) — pídanle a Marco que les genere una clave temporal nueva para cada una antes de probar (es la misma pantalla de "activar" que ya usan con alumnos reales).

### A. Como estudiante (`QA Estudiante Prueba`)

- [ ] Entrar a **Unidades** y ver el recorrido: una unidad marcada "Vas aquí", al menos una con candado ("Se abre al aprobar la unidad anterior") y confirmar que el candado es real — que no se puede entrar a esa unidad todavía.
- [ ] Abrir un material (PDF, imagen, o el que haya) y confirmar que se ve dentro de la app. Si es PPTX/DOCX, va a abrir en el visor de Office en pestaña aparte — **eso es normal por ahora**, todavía no está la conversión a PDF (ver Lista 2).
- [ ] Confirmar que al ver el material completo, la barra de "materiales obligatorios" avanza sola (sin recargar la página a mano).
- [ ] Si hay un bloque de texto ("Lectura"), confirmar que se lee directo en la pantalla, sin abrir nada aparte.
- [ ] Mandar una duda desde "Dudas de esta unidad" y confirmar que dice a qué unidad quedó ligada.
- [ ] Si hay una tarea pendiente, confirmar que se puede elegir un PDF y subirlo.
- [ ] Si hay un examen (certificación o formativo) habilitado, presentarlo completo: confirmar que el tiempo corre, que las preguntas de opción múltiple/V-F/redacción se pueden responder, y que al entregar pide confirmación ("¿Entregar el examen?").
- [ ] Intentar presentar el mismo examen una segunda vez después de agotar los intentos — debe decir claramente que ya no se puede.
- [ ] Revisar "Mi carnet" en Perfil — que se vea bien y el QR cargue.
- [ ] Probarlo una vez en el teléfono (o achicando la ventana del navegador a ancho de teléfono) — que nada se corte ni haya que hacer scroll de lado a lado.

### B. Como profesor (`QA Profesor Prueba`)

- [ ] Entrar a **Unidades** (menú del profesor) y abrir una unidad: confirmar que se ve el contenido y que se puede "Editar unidad".
- [ ] Crear o editar un bloque de texto directo en la unidad (sin subir archivo) — y confirmar que **si ya existe uno, se puede editar**, no solo borrar y crear de nuevo.
- [ ] Desde dentro de una unidad, probar crear un examen nuevo con `+ examen` (debe quedar enganchado solo a esa unidad) y subir un material nuevo igual, desde dentro de la unidad.
- [ ] En el constructor del examen: confirmar que se puede elegir tipo (formativo/certificación), nota mínima, número de intentos y horas de enfriamiento — todo desde la pantalla, sin pedirle nada a Marco por fuera.
- [ ] Abrir "Ver dudas"/"Ver y responder dudas" desde una unidad y confirmar que llega filtrado solo a las dudas de esa unidad (con opción de "Ver todas").
- [ ] Si algún estudiante de prueba entregó una tarea, calificarla desde "Calificar tarea" y probar el botón "Descargar todas (ZIP)".
- [ ] **Importante — pídanle a Marco que les muestre la pantalla `/calificar`** (no está en el menú todavía, es un enlace directo): ahí se califican las preguntas de redacción abierta de los exámenes. Prueben calificar una. Esto se conecta con una decisión pendiente en la Lista 2.
- [ ] Revisar el panel "Hoy" del profesor y confirmar que la clase de hoy, el contador de asistencia y los accesos rápidos se ven bien.

### C. Como Dirección Académica (`QA Dirección Académica Prueba`) — más rápido, solo confirmar acceso

- [ ] Confirmar que "Unidades" aparece como primer botón del menú (no "Material").
- [ ] Entrar a "Unidades" y confirmar que se ve lo mismo que ve el profesor, para cualquier cohorte/módulo.
- [ ] Confirmar que "Programas" (crear un corte nuevo de PTMA/PFTA) sigue apareciendo en el menú.

### D. Cosas de contenido para decidir, no para probar funcionalidad

- [ ] **Hay una pregunta de examen de prueba con contenido inapropiado/ofensivo** cargada por alguien en una sesión de QA anterior (examen "sixeven 1"). Hay que borrarla antes de seguir probando con más gente — no es un bug de código, es un dato que hay que limpiar. Pedro, ¿la borramos nosotros o prefieres verla primero?

### ✅ Criterio para decir "esto ya se puede desplegar a producción"

No lo desplieguen hasta que:
1. Todas las casillas de A, B y C de arriba queden marcadas por al menos una persona que no sea Marco (para probar como lo haría alguien que no escribió el código).
2. Se resuelva el punto D (la pregunta inapropiada, borrada).
3. Pedro confirme que sí — porque aunque las tablas estén vacías en producción hoy, esta va a ser la primera vez que los 20 estudiantes reales ven el Aula Virtual.

---

## LISTA 2 — SIGUIENTE PASO / TAREAS PARA ESTA SEMANA

Según el documento maestro estamos en **Sprint 0** (3-16 nov, línea base + staging) — pero el módulo de Aula Virtual que estaba planificado para los Sprints 2-4 (diciembre) **ya está construido y probado en staging**, adelantado. Eso cambia qué tiene sentido hacer esta semana: no hay que "empezar" Aula Virtual, hay que **cerrar Sprint 0 y decidir cuándo pasa Aula Virtual a producción**.

### Para hoy sábado

- [ ] Aplicar la **prueba práctica común** a los 20 estudiantes si todavía no se hizo (U.1, línea base — estaba planificada para hoy/este fin de semana en el Sprint 0). Sin esto no hay con qué comparar después.
- [ ] Si hay tiempo en la clase de hoy: que alguien del equipo (no Marco) recorra la Lista 1 completa como estudiante real, aprovechando que hay estudiantes y profesor en el mismo lugar.

### Para esta semana (antes del 16 de noviembre, cierre de Sprint 0)

- [ ] **Encuesta de motivación semana 0** (U.3, 6 ítems) — enviarla a los 20 estudiantes. Falta configurarla como formulario en la app o mandarla por otro medio mientras tanto.
- [ ] **Export histórico de Odoo** de las 3 cohortes anteriores (U.4) — pendiente, para tener con qué comparar.
- [ ] Confirmar que el **CI corre en al menos un PR** (A.5) — si ya se movió `.github/workflows/`, falta solo verificarlo con un PR real.
- [ ] **Decisión de Pedro: ¿se sube ya Aula Virtual completo a producción?** Las tablas en `zr-prod` están vacías, así que subirlo no rompe nada existente — pero es la primera vez que lo ven los 20 estudiantes reales. Si la Lista 1 se completa esta semana, podría subirse antes de que empiece el próximo módulo.
- [ ] **Decisión de Pedro/Marco sobre `/calificar`:** ¿se agrega ya al menú del profesor (y se le pone una notificación cuando hay una redacción pendiente), o se espera a la fase que lo tenía planificado? Hoy, sin eso, una pregunta de redacción abierta puede quedar sin calificar indefinidamente sin que nadie se entere.
- [ ] **N.11 Comunicados/anuncios** sigue sin construir (no hay pantalla ni tabla) — confirmar si se adelanta por ser rápido o se espera al Sprint 8 como estaba planeado.

### Mirando un poco más adelante (para no perder el orden del roadmap)

- Con Aula Virtual ya listo, lo que sigue del documento maestro una vez cerrado Sprint 0 es **Sprint 1** (17-30 nov): flujo completo de inscripción por vendedor (lead → impresión → firma → admin activa → clave) y gestión de salones/horarios — hoy Dirección Académica ya gestiona cohortes y profesores, pero salones y horarios todavía no tienen pantalla.
- Quedan pendientes del catálogo de 24 épicos, sin tocar ni verificar en esta ronda: **S** (egresados), **T** (simulación), **W** (tutor IA) — todos están en backlog P3, ninguno urgente.

---

**Para dudas:** §13 del documento maestro. **Para proponer cambios al roadmap:** §12.3 (decir en una línea qué contradice, preguntar, si dicen "procede" se actualiza el doc en el mismo PR).
