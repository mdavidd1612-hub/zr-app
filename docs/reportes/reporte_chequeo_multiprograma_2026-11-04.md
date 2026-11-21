# REPORTE PARA EL COORDINADOR — Chequeo multi-programa + cierre Aula Virtual

**Fecha:** 4 de noviembre de 2026
**Técnico:** Marco (vía IA)
**Motivo:** pedido directo del coordinador — verificar que el sistema soporta varios programas activos antes de que Erika cargue el nuevo programa este fin de semana, y cerrar lo que quedaba pendiente del módulo E-Learning.

---

## 1. Qué se cerró del módulo E-Learning (Aula Virtual)

Quedaban 2 de los 5 huecos del análisis original. Los dos están hechos, migrados, verificados en vivo (profesor y estudiante, en `zr-staging`) y documentados en `CLAUDE.md`/`AGENTS.md`/`docs/26_...`:

- **Hueco 5 — Bloques de texto dentro de la unidad.** El profesor escribe título + párrafo directo en la unidad, sin subir archivo. (Migraciones 186/187.)
- **Hueco 3 — Mini-chequeo al terminar un video/audio.** La base ya existía desde octubre (migración 177); faltaba la pantalla. El profesor asocia un examen cortico a un material de video/audio; al estudiante terminarlo, se le invita a presentarlo, y si lo aprueba el material queda validado para la barra de obligatorios de la certificación.

Con esto, **los 5 huecos del análisis original del módulo E-Learning quedan cerrados.**

Quedan en el radar, sin tocar en esta pasada (bajo impacto, no bloquean nada de esta semana): Hueco 4 (UI de prerrequisitos/ventanas de visibilidad por ítem — en parte superado por la compuerta por orden) y las faltantes ya conocidas del épico F (marca de agua, conversión PPTX/DOCX→PDF, YouTube embed).

## 2. Chequeo multi-programa — qué se encontró

**Buenas noticias primero:** el sistema ya es multi-programa de fondo, no hubo que rediseñar nada. En producción ya conviven **PTMA y PFTA** (2 programas, 13 módulos y 2 cohortes cada uno). Sumar un tercero es agregar datos, no cambiar código. Revisé en particular:

- El formulario de inscripción (el que usa Erika) ya lista TODAS las cohortes activas sin importar el programa, con el programa como etiqueta visible — en cuanto exista la cohorte del programa nuevo, va a aparecer ahí solo, sin tocar código.
- Las reglas de acceso (qué módulo/cohorte ve cada quien) se resuelven siempre desde la fila propia del estudiante o del profesor, nunca de una lista fija de programas — escalan solas.
- El constructor de exámenes y la gestión de profesores ya filtran correctamente por programa.

**Bug real que encontré y corregí (ya en `develop`/`zr-staging`, verificado en vivo):** en "Gestión de Cohortes" (Dirección Académica), el selector de "Módulo inicial" al crear una cohorte y el de "Avanzar de módulo" de una existente **mezclaban los módulos de TODOS los programas en una sola lista**, sin filtrar ni decir de qué programa era cada uno. Con PTMA+PFTA ya eran 26 módulos revueltos — fácil asignarle a una cohorte el módulo del programa equivocado por error, lo que le rompe el Aula Virtual y los exámenes a esa cohorte entera. Ya corregido: cada selector solo muestra los módulos del programa correcto. De paso corregí una etiqueta que decía "Sede" cuando en realidad elegía el Programa (confundía, no rompía nada).

**Corrección sobre mi primer reporte:** dije que no había pantalla para crear un programa nuevo — el coordinador me corrigió y tenía razón. En el lenguaje de la academia, "programa nuevo" (lo que va a cargar Erika) es un **corte/cohorte nuevo de un programa que ya existe** (PTMA o PFTA), no un currículo distinto desde cero. Eso **sí está 100% self-service**, ya en producción, sin tocar código: `/programas` (perfil de vendedor) tiene "+ Nuevo programa de PTMA" / "+ Nuevo programa de PFTA" para crear el corte (sede, turno, fecha de inicio — el nombre y el correlativo del carnet los pone el sistema solo); `/cohortes` (Dirección Académica) hace lo mismo y además asigna módulo inicial y profesor. **Erika no necesita nada de mí para este fin de semana.**

**Segunda corrección, también del coordinador:** tampoco es cierto que un programa realmente nuevo (currículo distinto) requiera migración directa — también es self-service, pero exclusivo de super_admin: `/catalogo` tiene "+ Nueva sede", que crea la sede Y su programa/currículo juntos (`crear_sede_con_programa`), copiando los 14 módulos. En el modelo real de la academia, cada sede tiene su propio programa 1 a 1 (PTMA = La Morita, PFTA = UCV) — por eso "crear sede" y "crear programa" son la misma acción. Esto solo aplica si el sábado arranca un currículo realmente distinto, no un corte más de PTMA/PFTA.

**Pedido adicional del coordinador, ya hecho:** Dirección Académica y super_admin tienen que poder abrir un programa sin depender de que haya un vendedor disponible. `/cohortes` ya tenía el mismo CRUD, pero estaba fuera del menú desde una fase anterior — se reexpuso como "Programas" en el menú de ambos roles. Probado en vivo en staging: Dirección Académica creó un corte de prueba de punta a punta (quedó bien nombrado, con su correlativo automático) y se confirmó que super_admin también lo ve.

**Limitación menor, documentada, no bloqueante:** la malla curricular que ve un estudiante que TODAVÍA no tiene cohorte asignada asume que el contenido es igual entre programas (es cierto hoy, entre PTMA y PFTA). Si algún día hay un programa con currículo distinto, un estudiante en ese estado transitorio (antes de que admin lo valide) podría ver una malla rara por unos momentos. No afecta a nadie ya inscrito, y no aplica a un corte nuevo de PTMA/PFTA.

## 3. Limpieza en producción (pedida por el coordinador, ya hecha)

Verifiqué cuántas cohortes había realmente en `zr-prod`: 4 en total, pero **solo una con datos reales** — `PTMA-2026-II` (La Morita, mañana), con los 20 estudiantes, su profesor asignado y estado `activa`. Las otras 3 (`PTMA-2025-II`, `PFTA-2026-I`, `PFTA-2026-II`) estaban vacías: 0 estudiantes, sin profesor, sin exámenes, sin notas, sin material — solo 18 filas de "sesión de clase" molde (6 cada una, sin asistencia) que ya se verificó que no tenían nada más enganchado.

**Las eliminé** (exactamente lo que el botón "Eliminar" de `/programas` ya ofrecía para una cohorte sin estudiantes). Confirmado en `zr-prod`: ahora existe **una sola cohorte**, `PTMA-2026-II`, con los 20 estudiantes. Los dos `programs` (PTMA y PFTA) se dejaron intactos — son el catálogo de currículos, no cohortes, y PFTA sigue disponible para cuando se abra su primer corte real.

---

## 4. Ya está todo en producción

Subí a `zr-prod` solo lo de este chequeo (el fix de los selectores de módulo + el nuevo acceso de Dirección Académica/super_admin a "Programas"), como un cambio aislado — sin arrastrar el resto del módulo E-Learning, que sigue solo en `zr-staging`, probado pero sin validar todavía con datos reales de estudiantes.

**Chequeo total, para mañana:**
- ✅ Erika puede abrir un corte nuevo de PTMA o PFTA desde `/programas` (perfil de vendedor) — sin cambios, siempre funcionó.
- ✅ Dirección Académica y super_admin también pueden, desde "Programas" en su menú, por si no hay vendedor — nuevo, ya en producción.
- ✅ El bug de módulos mezclados entre programas está corregido — ya en producción.
- ✅ Producción solo tiene la cohorte real (`PTMA-2026-II`, 20 estudiantes) — las 3 vacías se eliminaron.
- ⚠️ Si lo de mañana es un currículo realmente nuevo (no un corte más de PTMA/PFTA), eso lo crea super_admin desde `/catalogo` ("+ Nueva sede") — avísame si es el caso para acompañar la primera vez.

**Todo esto está commiteado y pusheado**: a `develop` (todo el trabajo) y a `main` (el fix puntual, ya en producción).
