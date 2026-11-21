# REPORTE PARA EL COORDINADOR — Estado vs. documento maestro

**Fecha:** 7 de noviembre de 2026
**Técnico:** Marco (vía IA)
**Motivo:** cómo vamos con respecto al documento maestro (`docs/26_...`) — qué se terminó y está en `zr-staging`, qué falta pasar a producción, y la validación contra el documento maestro.

---

## 1. Resumen en una línea

El módulo completo de Aula Virtual (ahora llamado **"Unidades"** en toda la app) está **terminado y probado en `zr-staging`**, no en producción. De producción, solo salió un paquete chico y puntual de arreglos de multi-programa. Todo lo demás — Aula Virtual entero, la ronda de UX, y el rediseño "recorrido orgánico" que se extendió a casi toda la app esta semana — sigue esperando luz verde para subir.

---

## 2. Lo que YA está en producción (`zr-prod`)

Solo esto, subido como hotfixes puntuales, sin arrastrar el resto:

- Filtro de módulos por programa en Gestión de Cohortes (antes mezclaba PTMA y PFTA en un solo selector).
- Acceso de Dirección Académica y super_admin a "Programas" (`/cohortes`) — antes solo el vendedor podía abrir un corte nuevo.
- El preview del nombre al crear un corte, que mostraba un nombre ya usado aunque el servidor fuera a poner el correcto.
- Limpieza de datos: en `zr-prod` solo queda la cohorte real (`PTMA-2026-II`, 20 estudiantes) — se borraron 3 cohortes vacías que no eran reales.

**Todo lo demás de este reporte está solo en `zr-staging`.**

---

## 3. Lo que está TERMINADO en `zr-staging`, listo para pasar a producción

### 3.1 Módulo E-Learning / Aula Virtual ("Unidades") — completo

Los 5 huecos del análisis original están cerrados:

| Hueco | Qué era | Estado |
|---|---|---|
| 1 | Exámenes configurables desde la app (tipo, nota mínima, intentos, enfriamiento) | ✅ |
| 2 | Compuerta real entre unidades (bloqueo por certificación anterior, no un mapa manual) | ✅ |
| 3 | Mini-chequeo al terminar un video/audio | ✅ |
| 4 | UI de prerrequisitos manuales | ✅ Superada por el Hueco 2, ya no hacía falta |
| 5 | Bloques de texto dentro de la unidad (pedido nuevo) | ✅ |

Además, esta semana se cerró una ronda completa de UX pedida por ti después de ver el entorno de prueba, en paralelo con otra sesión que trabajaba lo mismo (se fusionó todo sin perder nada):

- **"Unidades" reemplaza a "Material" en todos lados** — menú de estudiante, menú de profesor, panel y menú de Dirección Académica/super_admin. Antes Dirección solo llegaba por un atajo escondido; ahora es el primer botón.
- **Recorrido orgánico** (camino conectado, sin cuadros apilados) en: unidad del estudiante, malla curricular, exámenes del estudiante, repositorio de material, panel del profesor (`/hoy`).
- **"Dudas de esta unidad" ya conecta con algo real** — antes era una tarjeta sin ningún enlace; ahora abre el panel de dudas del profesor filtrado a esa unidad.
- **El bloque de texto ya se puede editar**, no solo quitar.
- **Tareas probadas de punta a punta por primera vez** — estudiante sube PDF real, profesor lo descarga y califica, estudiante ve su nota. Funcionaba desde antes, solo faltaba probarlo.
- Mejoras más chicas: foto de perfil para profesor/admin, mejor flujo de subir material y de entregar tareas, aviso de resultado del módulo solo en Inicio (no repetido en cada pantalla).

### 3.2 Validación contra el documento maestro (parcial, honesto sobre lo que falta)

Se revisó contra el código real:

- **Épico F (E-Learning) y H (Evaluaciones):** confirmados, con todo lo de arriba.
- **Épico N (Dirección Académica):** lo que el mapa marca 🟡 ya existe y funciona — Personal, Cobertura, Notas, Exámenes académicos, Módulos, Feedback, y ahora Programas. **Falta N.11 Comunicados/anuncios** — no hay pantalla ni tabla, sigue siendo lo que indica el Sprint 8.
- **Épico X (Dudas mejoradas):** FAQ, dudas por unidad y resumen con IA ya existen. Faltan X.6-X.9 (imagen adjunta en una duda, alertas de tiempo de respuesta) — Sprint 9.
- Los épicos que ya estaban en ✅ producción (C, D, K, M, P, Q) no se tocaron esta sesión y no se re-verificaron línea por línea.

**No se llegó a auditar los 24 épicos completos** (son ~180 funciones) — quedó anotado en el documento maestro como pendiente para una sesión dedicada solo a eso.

---

## 4. Lo que falta — decisiones tuyas, no técnicas

1. **¿Se sube ya el módulo de Aula Virtual/Unidades completo a producción?** Las tablas en `zr-prod` están vacías (estructura lista, sin contenido cargado) — subirlo no rompe nada existente, pero es la primera vez que los 20 estudiantes reales lo verían. Si quieres, lo subo en cuanto digas.
2. **Auditoría completa de los 24 épicos** — si la quieres antes de seguir con el roadmap, es una sesión aparte dedicada solo a eso.
3. **N.11 Comunicados** sigue sin construir — confirmar si se adelanta o se espera al Sprint 8 como estaba planeado.

---

## 5. Dónde queda todo

- Código: rama `develop` (↔ `zr-staging`), al día.
- Documento maestro: `CLAUDE.md`, `AGENTS.md` y `docs/26_...` actualizados en los mismos commits (regla 0.2), secciones §8.1 a §8.5.
- Producción (`main` ↔ `zr-prod`): solo los 3 hotfixes de multi-programa del punto 2.
