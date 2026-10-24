# 22 · Comparativo — documento maestro viejo vs. reconstruido (24 oct. 2026)

> Compara `CLAUDE.md`/`AGENTS.md` (el documento maestro actual) contra
> `docs/21_DOCUMENTO_MAESTRO_NUEVO_OCT2026.md` (reconstruido desde producción real
> en esta sesión). Para que Pedro vea exactamente qué cambia y por qué, sin tener
> que leer los dos documentos completos y adivinar la diferencia.

---

## 1. Qué está MAL en el documento viejo (reemplazar)

| Lo que dice el documento viejo | Lo que hay de verdad en producción | Por qué importa |
|---|---|---|
| §6: "Los cuatro roles" — un usuario tiene exactamente uno | Hay **siete** roles reales, y una persona puede tener más de uno a la vez (`profile_roles`, tabla muchos-a-muchos) | Alguien que lea el documento viejo y construya asumiendo "un rol por persona" va a romper el selector `/elegir-rol` o la lógica de permisos |
| §1, punto 6: "Exámenes digitales con autocalificación" se lee como SI fuera el mecanismo de evaluación de la academia | El motor de exámenes digitales existe pero tiene **cero uso real**. El mecanismo real es "Notas" (`manual_exam_definitions`/`manual_exam_scores`), construido después y nunca documentado | Si alguien lee "ya hay exámenes" y asume "ya hay notas", va a duplicar trabajo o romper el flujo real que la academia usa cada sábado |
| No menciona Notas en ningún lado | Notas es, hoy, el sistema de evaluación real de toda la academia | Es la pieza más usada del sistema académico y el documento maestro no la nombra ni una vez |

## 2. Qué estaba BIEN y se confirma tal cual (no tocar)

- Las diez reglas absolutas (§2) — todas verificadas contra el código y la base
  real, ninguna violada.
- El stack técnico (§3) — sin cambios.
- Las excepciones de Finanzas y ZR Coffee (§7) — confirmadas en producción,
  documentadas correctamente desde que se agregaron.
- La regla del tour guiado (§12) — confirmada, sigue aplicándose.
- Las prohibiciones de Fase 2/Fase 3 — confirmado que nada de eso existe en
  producción más allá de las dos excepciones ya documentadas.
- El flujo de ramas `main`/`develop` (§11) — confirmado, sin cambios.

## 3. Qué faltaba y se agrega (nuevo en el documento reconstruido)

- El modelo real de roles múltiples (`profile_roles`) y la pantalla `/elegir-rol`.
- El sistema de Notas completo, como pieza aparte del motor de exámenes digitales.
- Las pantallas de reportes/métricas de administración que existen pero no
  estaban en la lista original de 11 puntos de Fase 1 (`/reportes`,
  `/estudiantes/estadisticas`, `/metricas-material`, `/cobertura-modulos`,
  `/feedback-modulos`, `/examenes-academicos`, `/catalogo`).
- Los Casos con IA (`/caso`, `/casos-docente`) como funcionalidad real en
  producción, pese a no estar en la lista original de Fase 1.
- La rehabilitación de exámenes abandonados.
- Una evaluación honesta de en qué fase estamos de verdad: "Fase 1 extendida",
  no Fase 1 pura ni Fase 2 abierta.

## 4. Qué se mantiene del documento viejo tal cual, SIN agregarlo como "nuevo pendiente"

Siguiendo la instrucción explícita de la reunión ("si ya pasamos la fase, no vas
a añadir esas otras... porque si no las añadimos fue por algo"): lo que el
documento de brechas (`docs/18`) ya tenía identificado como pendiente, bloqueado
por una pregunta de producto sin responder, **se deja exactamente igual, no se
reclasifica como "nuevo"**:

- 2FA para administradores.
- Marca de agua en PDFs del Classroom.
- Límite de descargas por cuenta.
- Integración con Odoo (bloqueada por credenciales, no por código).
- Generación de casos de IA desde material subido, con aprobación — sigue
  pendiente de que alguien responda quién aprueba y quién paga el presupuesto de
  IA.

Ninguna de estas se "implementó" en esta sesión ni se marca como lista — siguen
exactamente donde estaban.

## 5. Lo que este comparativo NO resuelve (para que Pedro decida)

- **¿El motor de exámenes digitales se abandona, se retoma como parte de un
  módulo nuevo (aula virtual), o se fusiona con Notas?** Esta sesión encontró la
  divergencia pero no es una decisión técnica — es de producto.
- **¿Los Casos con IA y el mapa de dominio merecen su propia sección de "Fase 1
  real" en el documento maestro, o se quedan como están?** Están en producción
  hace meses sin haber sido nunca formalizados en el documento.
- **¿Hace falta revisar `docs/18` también**, o con esta actualización del
  documento maestro alcanza? `docs/18` tiene fecha de 1 de septiembre y varios de
  sus puntos "pendientes" (B-1, B-3, C-1) ya se resolvieron sin que el documento
  se haya actualizado — mismo problema que tenía el maestro, a menor escala.
