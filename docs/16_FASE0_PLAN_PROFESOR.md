# 16 — Plan de sprints · Fase 0 (perfil profesor)

> Mismo espíritu que estudiante y admin: no se toca paleta, tema oscuro ni
> liquid glass. Guía visual: `ZR_APP_FASE0_PROTOTIPO.html`.

## Sprint A — Recortes de menú
- Quitar Sesiones, Exámenes, Calificar del menú (código intacto).
- Menú fijo: Hoy · Dudas · Casos · Material · Perfil — sin menú ☰, las 5
  caben directas.

## Sprint B — Hoy: clase de hoy + asistencia en vivo
- Tarjeta "Tu clase de hoy": módulo, taller/sede, hora, inscritos (como el
  HTML: "Módulo 1 · Taller 2 · 8am · 24 inscritos").
- "Asistencia en vivo": llegaron / faltan — se lee de `attendance_events`,
  el profesor no maneja ningún QR (eso es de administración).
- Se quita la sección "Pendiente" (dependía de exámenes).

## Sprint C — Dudas + resumen por IA
- Lista de las dudas de los estudiantes, tal cual las escribieron (de la
  tabla `doubts` ya creada en Fase 0 estudiante), sin poder responderlas
  desde aquí.
- "Dudas de la semana": 3 preguntas que agrupan el grueso de las dudas,
  generadas por una Edge Function (`resumir-dudas`) que llama a NVIDIA NIM
  — solo recibe los textos, nunca nombres ni cédulas.

## Sprint D — Casos: quién los trabajó (sin nombres)
- Vista de módulo/semana con el % de estudiantes que trabajaron el caso
  cada día, barra animada — igual que el HTML. Sin nombres, solo el número.
- Los casos en sí pasan a generarse por IA (5 preguntas + una respuesta
  libre) en vez del banco fijo de Fase 0 estudiante — Edge Function nueva
  que genera casos ligados al módulo actual.

## Sprint E — Material: descargar + subir con aprobación de admin
- El profesor ve y descarga el material que sube administración.
- El profesor puede subir material propio, pero queda "Pendiente de
  aprobación" hasta que admin lo revise, apruebe o lo publique — con aviso
  al profesor cuando cambie de estado.

## Sprint F — Perfil
- Mini carnet: nombre, cédula, módulo actual, botón de cerrar sesión.

---

**Orden:** A → B → C → D → E → F. C y D son las que dependen de IA — se
avisa aparte cuando estén conectadas y probadas contra la API real.
