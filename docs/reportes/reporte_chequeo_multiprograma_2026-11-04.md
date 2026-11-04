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

**Esto NO es un bug, es una tarea manual pendiente — y es lo más urgente de este reporte:** no existe una pantalla para crear un programa nuevo desde cero. Los programas (PTMA, PFTA) se crearon por mí, por migración directa a la base, con su currículo (nombre, siglas, los módulos en orden). **Antes de que Erika empiece a cargar estudiantes este fin de semana, alguien tiene que darme (o yo tengo que tener) el currículo del programa nuevo** — nombre, siglas para el carnet, y la lista de módulos en orden — para crear el `program`, sus `modules` y al menos una `cohort` activa. **Sin eso, Erika no va a tener nada que elegir**: el selector de programas en su pantalla de inscripción va a seguir mostrando solo PTMA y PFTA.

**Limitación menor, documentada, no bloqueante:** la malla curricular que ve un estudiante que TODAVÍA no tiene cohorte asignada asume que el contenido es igual entre programas (es cierto hoy, entre PTMA y PFTA). Si el programa nuevo tiene un currículo distinto, un estudiante en ese estado transitorio (antes de que admin lo valide) podría ver una malla rara por unos momentos. No afecta a nadie ya inscrito.

## 3. Lo que falta para el sábado — pendiente de tu parte

1. **Currículo del programa nuevo**: nombre completo, siglas (para el carnet), sede/turno, y los módulos en orden (nombre + competencias si las tienes). En cuanto lo tenga, creo el programa y la primera cohorte — es rápido, no es una tarea grande.
2. Decidir si el arreglo de Gestión de Cohortes (y el resto del módulo E-Learning, que todavía vive solo en `zr-staging`, no en producción) **se sube a producción antes del sábado** o se espera al cierre normal del módulo. No lo subí yo solo porque implica mandar a producción todo el Aula Virtual junto (todavía sin validar con datos reales) — prefiero que lo decidas tú o Marco, como dice el documento maestro. Si quieres, puedo hacer un arreglo quirúrgico: subir SOLO el fix de Gestión de Cohortes a producción, sin el resto del Aula Virtual, para que esté listo igual el fin de semana.

---

**Todo lo de arriba está commiteado y pusheado a `develop`** (rama `zr-staging`), probado en vivo con usuarios de prueba en los dos roles relevantes (Dirección Académica y, para los huecos de Aula Virtual, profesor y estudiante).
