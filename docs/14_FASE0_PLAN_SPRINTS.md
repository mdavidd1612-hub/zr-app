# 14 — Plan de sprints · Fase 0 (perfil estudiante)

> Contexto: entrega de demo el sábado 5 de septiembre de 2026. El equipo decidió
> recortar temporalmente Exámenes, Notas y Progreso del perfil estudiante para
> presentar una Fase 0 pulida y sin errores. Estos cambios aplican **solo** al
> perfil `estudiante`; profesor y admin no se tocan en este plan.
>
> Referencia visual: `ZR_APP_FASE0_PROTOTIPO.html` (prototipo estático que el
> equipo compartió). Se sigue su estructura de pantallas y funciones, manteniendo
> la identidad visual actual de la app (paleta, tema oscuro, liquid glass,
> símbolos ya existentes en `components/ui/Iconos`).
>
> Rama de trabajo: `fase0-estudiante` (no se toca `main` directo).
> Respaldo previo: rama `backup/pre-fase0-2026-08-25`.

## Sprint 1 — Recorte de superficie
- Quitar Exámenes, Notas y Progreso de la navegación y del layout del estudiante
  (`app/(app)/layout.tsx`, barra flotante y menú "todas las secciones").
- Las rutas `examenes/`, `notas/`, `progreso/` se dejan en el código (no se
  borran archivos ni tablas) pero dejan de ser alcanzables desde el perfil
  estudiante, para poder retomarlas en la siguiente fase sin rehacer nada.
- Verificación: navegar como estudiante y confirmar que solo aparecen
  Inicio / Material / Mi módulo / Dudas / Perfil, y que las URLs viejas ya no
  están enlazadas desde ningún botón visible.

## Sprint 2 — Inicio: calendario + caso/asistencia del día
- Rediseñar `app/(app)/page.tsx`: tira semanal (lun–sáb) con el día actual
  resaltado y los días pasados marcados.
- Tarjeta "hoy": de lunes a viernes muestra el caso conceptual del día
  (banco de casos, sin cifras — igual que el prototipo); el sábado muestra el
  acceso a marcar asistencia.
- Conecta con "Mi módulo" (tarjeta que resume módulo/semana actual y lleva a
  la sección nueva).
- Verificación: cambiar la fecha del sistema o usar un flag de prueba para ver
  el estado "día de semana" y "sábado"; confirmar que el caso/asistencia
  correspondiente aparece y que el enlace a Mi módulo funciona.

## Sprint 3 — Mi módulo (reemplaza "Mis clases")
- Nueva pantalla con: módulo actual, semana, descripción corta, y la lista de
  competencias del módulo (título + descripción, **sin estado de dominio** —
  eso queda pospuesto junto con Progreso).
- Se alimenta de `modules` + `learning_guides` (agrupando por
  `sub_competency_name`), reutilizando lo que ya expone `cohorts.current_module_id`.
- Verificación: entrar como un estudiante de prueba con cohorte y módulo
  asignado, y confirmar que el nombre, semana y competencias mostradas
  coinciden con lo cargado en la base para ese módulo.

## Sprint 4 — Accesos de Inicio + Material
- Sección "03 — Accesos" del inicio: dejar solo Mi carnet (sin descripción),
  Material y Dudas. Quitar Exámenes, Notas y Clases de esa rejilla.
- Material se mantiene igual (sin cambios funcionales).
- Verificación: confirmar visualmente que la rejilla de accesos solo tiene
  esas tres tarjetas y que cada una navega a la pantalla correcta.

## Sprint 5 — Dudas (sección nueva)
- Migración SQL nueva (`supabase/migrations/034_dudas.sql`): tabla `doubts`
  con RLS — el estudiante solo lee/edita/borra las suyas; profesor/admin
  pueden leer todas (agregado, sin ver quién dijo qué se resuelve en fase
  siguiente si aplica, pero el dato queda igual).
- Pantalla: formulario para enviar una duda, lista de "las que he mandado"
  con opción de editar y eliminar (borrado real de su propia fila).
- Verificación: enviar una duda, editarla, eliminarla, y confirmar en la base
  (`select` como service role) que otro estudiante de prueba no puede leer ni
  modificar la duda del primero (RLS).

## Sprint 6 — Carnet digital en Perfil
- Rediseño de la tarjeta de carnet en `app/(app)/perfil/page.tsx` siguiendo el
  layout del HTML de referencia (nombre, cédula, código, sede, turno, módulo),
  manteniendo gradiente/liquid glass y paleta actuales.
- Migración SQL: columna `students.student_code` (texto, único), generada de
  forma consecutiva al crear un estudiante, formato `ZR-2026-XXX`
  (correlativo por año, con función/trigger en servidor — nunca calculado en
  el cliente, regla 2 y 5 de AGENTS.md).
- Sede y turno quedan como texto fijo (constante de configuración, no
  hardcode disperso) — se conecta a datos reales en una fase posterior.
- Módulo del carnet se conecta a la misma fuente que "Mi módulo" (Sprint 3).
- Se quita el bloque de Competencias del perfil; se mantiene Cuenta y Cerrar
  sesión.
- Verificación: crear dos estudiantes de prueba y confirmar que los códigos
  salen consecutivos (`ZR-2026-001`, `ZR-2026-002`, …); confirmar que el
  carnet se ve y funciona sin conexión (ya guardado en el teléfono, como hoy).

## Sprint 7 — Paso final
- `npm run verify` (typecheck + RLS + tests) y revisión visual a 360px de
  ancho.
- Documentar en este mismo archivo lo que quedó pendiente para la próxima
  fase (reactivar Exámenes/Notas/Progreso desde donde se dejaron).

---

**Cómo voy a reportar cada sprint:** al terminar cada uno, aviso qué se hizo,
cómo se hizo (archivos y decisiones clave) y cómo probarlo, antes de pasar al
siguiente.
