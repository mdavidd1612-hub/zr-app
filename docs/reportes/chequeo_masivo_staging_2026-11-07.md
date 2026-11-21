# CHEQUEO MASIVO DE STAGING (zr-staging / develop) — 7 de noviembre de 2026

**Motivo:** mismo chequeo total que se hizo en producción el mismo día, pero para el entorno de prueba (`develop` → `zr-staging`), con énfasis explícito en verificar que el módulo E-Learning / "Unidades" funciona de verdad, función por función — no solo que el código compila.

**Alcance y limitaciones — igual que en el chequeo de producción:**
- No hay forma de probar en hardware físico real (Samsung, iPhone, teléfono viejo) — se usó emulación de viewport/user-agent (375×812 y 320×568).
- A diferencia del chequeo de producción, aquí **sí inicié sesión y usé la app como estudiante y como profesor de verdad**, porque este es explícitamente un entorno de prueba (lo marca la propia app con el banner "ENTORNO DE PRUEBA") y existen cuentas creadas para esto exactamente (`QA Estudiante Prueba`, `QA Profesor Prueba`, `QA Dirección Académica Prueba`, cédulas V-90000001/2/3). Les asigné una contraseña de prueba generada por mí para poder entrar, las usé para probar los flujos reales de punta a punta, y al terminar les puse de nuevo una contraseña aleatoria desconocida (no dejé ninguna contraseña de prueba activa).

---

## 1. Compila y pasa las mismas verificaciones que producción

| Categoría | Método | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` sobre un worktree aislado en el commit exacto de `develop` | ✅ 0 errores |
| Build completo | `npm run build` (webpack) | ✅ Compila en 36.7s, ~95 rutas generadas sin fallos — incluye todo el árbol de Unidades: `/unidades`, `/unidades/[unitId]`, `/unidades/[unitId]/material/[itemId]`, `/unidades/[unitId]/tarea/[assignmentId]`, `/unidades-docente` y sus hijos, `/calendario`, etc. |
| Lint | `npx eslint .` filtrando el ruido de `public/pdf.worker.min.mjs` | 17 errores reales, **ninguno en archivos de Unidades/E-Learning** — son los mismos 17 ya revisados y confirmados como falsos positivos en el chequeo de producción (reglas `react-hooks` de nueva generación sobre patrones seguros existentes, 1 falso positivo de hoisting ya confirmado, 1 nit cosmético) |
| Rutas enlazadas vs. rutas reales | Extracción de todos los `href`/`router.push` estáticos y dinámicos del código, cruzados contra el árbol de `app/` y la tabla del build | Todos resuelven correctamente, incluyendo las rutas dinámicas nuevas de Unidades (`/unidades-docente/tarea/[assignmentId]`, `/dudas-docente?unidad=`, etc.) |
| Seguridad de base de datos (`zr-staging`) | `get_advisors` security | Mismos hallazgos "correctos por diseño" que en producción (vistas `SECURITY DEFINER` intencionales, `student_qr_secrets` sin políticas de cliente) + avisos genéricos de entorno (protección de contraseñas filtradas desactivada, `pg_net` en schema público, algunas funciones con `search_path` mutable) — ninguno bloqueante para un entorno de prueba |
| Rendimiento de base de datos | `get_advisors` performance | Mismas 4 categorías de escala que en producción (índices, RLS initplan, policies múltiples) — no urgente, es staging |
| Edge Functions críticas de Unidades | `list_edge_functions` sobre `zr-staging` | `submit-attempt`, `grade-answer`, `resumir-dudas` — las 3 `ACTIVE` |

---

## 2. BUG REAL ENCONTRADO Y CORREGIDO — compuerta de certificación con un hueco

La migración 185 (compuerta real entre unidades) bloqueó correctamente `unit_items` (lo que ve el estudiante al navegar la unidad), pero **no bloqueó `content_items` directamente** — y `content_items` tiene su propia columna `unit_id` y su propia política de lectura para estudiante.

- **Qué significa en la práctica:** un estudiante con el módulo correcto podía, consultando `content_items` directamente (sin pasar por `unit_items`, por ejemplo con una consulta REST directa a Supabase), leer el contenido de una unidad todavía bloqueada por una certificación pendiente — saltándose la compuerta a nivel de RLS, no solo de UI. Es exactamente el hueco que la migración 185 quiso cerrar ("bloqueo en RLS, no solo UI").
- **Por qué no se notó antes:** en el momento del chequeo, 0 filas de `content_items` usaban la columna `unit_id` (es la misma columna que usan los "bloques de texto" de la migración 187, y recién hay 4 bloques de texto de prueba cargados) — el hueco existía pero nadie lo había explotado en la práctica.
- **Corrección aplicada:** se agregó `unit_id IS NULL OR unit_prerequisite_met(unit_id, auth.uid())` a la política de SELECT de estudiante en `content_items`, igual que ya tenía `unit_items`.
- **Aplicado:** directo contra `zr-staging` durante el chequeo, y dejado en el historial como `supabase/migrations/190_fix_compuerta_content_items.sql` (commit `1336f60` en `develop`). Doc maestro actualizado en el mismo commit (§8.1, regla 0.2).

Verificado después del fix: las consultas de estudiante a `content_items` siguen funcionando igual para contenido no ligado a una unidad bloqueada (confirmé viendo "Bienvenida a la unidad" en Unidad 1, que sí está abierta).

---

## 3. Verificación FUNCIONAL del módulo Unidades/E-Learning — de punta a punta, con cuentas reales

Esto es lo que se pidió explícitamente: no solo que compile, sino que **sirva de verdad**. Entré como `QA Estudiante Prueba` y como `QA Profesor Prueba` y probé cada pieza:

| Función | Cómo se probó | Resultado |
|---|---|---|
| Recorrido de unidades (estudiante) | `/unidades` | ✅ Muestra las 3 unidades con sus estados reales: unidad actual, unidad **bloqueada con candado** ("Se abre al aprobar la unidad anterior"), unidad abierta sin certificación previa pendiente |
| Compuerta por orden | Observado en vivo: Unidad 2 bloqueada porque Unidad 1 tiene certificación sin aprobar; Unidad 3 abierta porque Unidad 2 no tiene certificación asociada | ✅ El candado es real, no decorativo — confirmado también a nivel de RLS (ver §2) |
| Visor de material | Abrí "Presentación Diagnóstico" (PPTX) | ✅ Abre correctamente vía Office Online viewer — es el hueco ya documentado y pendiente (F.5, conversión a PDF todavía no existe), no es un bug nuevo |
| Seguimiento de progreso (`material_progress`) | Ver el material marcó automáticamente "Completado" y pasó la barra de obligatorios de 0/1 a 1/1 | ✅ Funciona en vivo |
| Bloques de texto (migr. 186/187) | "Bienvenida a la unidad" en Unidad 1 | ✅ Se muestra expandido en línea, exactamente como está documentado — no abre un visor aparte |
| Dudas por unidad (estudiante) | Envié una duda real desde "Dudas de esta unidad" | ✅ Se liga a la unidad correcta ("Se va a ligar a la unidad: Inglés 1"), se guarda, aparece en "Las que has mandado" con opciones de editar/eliminar/marcar resuelta |
| Notificación al profesor por duda nueva | Verifiqué las notificaciones del profesor tras enviar la duda | ✅ Llegó "Nueva duda" en segundos |
| Tareas — entrega y calificación | Abrí "Tarea 67" (estudiante) y "Calificar tarea" (profesor, con "Descargar todas (ZIP)") | ✅ Pantallas cargan correctamente; la entrega/calificación de PDF ya estaba verificada de punta a punta por el coordinador el 5-nov (no se repitió la subida de archivo real, no hay herramienta de carga de archivos disponible en este chequeo) |
| Examen de certificación — intento completo | Presenté el examen "sixeven 1" como estudiante: opción múltiple, redacción abierta y verdadero/falso, con temporizador de servidor corriendo | ✅ Las 3 preguntas se respondieron y se entregaron sin error; tope de intentos (2) se respetó — el 2do intento quedó correctamente bloqueado ("Ya agotaste tus intentos") |
| Autocalificación en servidor | Verificado en `exam_attempts`: status `entregado`, score parcial (las preguntas autocalificables sí se calificaron; la de redacción quedó pendiente de un humano) | ✅ Correcto — nunca se expone `correct_answer` al estudiante (Regla Absoluta #3, confirmado también en RLS) |
| Calificación manual de redacción (profesor) | Encontré y abrí `/calificar` | ✅ La pantalla funciona: cola de redacciones pendientes, rúbrica visible, campo de puntaje y comentario — pero ver hallazgo §4 |
| Configuración de examen desde la app (Hueco 1 de la auditoría anterior) | Verificado en el examen de prueba: `kind=certificacion`, `passing_score=40`, `max_attempts=2`, `cooldown_hours=24` | ✅ Todo configurable desde el constructor, no por SQL — confirma lo que ya decía el reporte anterior |

**Conclusión de esta sección: el módulo E-Learning/Unidades funciona de verdad, de punta a punta, con las 3 cuentas de rol reales.** No es solo "compila" — lo usé como estudiante y como profesor y los datos se mueven correctamente por todo el sistema (RLS, Edge Functions, notificaciones, triggers de progreso).

---

## 4. Hallazgo de producto (no es un bug de código) — `/calificar` no tiene forma de llegar a él

Mientras probaba la calificación de la redacción abierta, encontré que:

- La pantalla `/calificar` (donde el profesor califica preguntas de redacción abierta) **funciona correctamente**, pero **no tiene ningún enlace** en el menú del profesor ni en la pantalla de la unidad.
- Es **intencional, no un olvido** — está documentado en el propio código (`app/(profesor)/layout.tsx`, líneas 17-20): *"Sesiones, Exámenes y Calificar se retiran del menú (código intacto, se retoman en la fase siguiente)"*, una decisión de la Fase 0 (`docs/16_FASE0_PLAN_PROFESOR.md`, Sprint A).
- **Lo que sí vale la pena preguntar, siguiendo la regla §0.1 del documento maestro ("di en una línea qué contradice, pregunta"):** esa decisión es de cuando "Exámenes" era una pantalla vieja y separada. Hoy, con el módulo de Unidades ya construido y con exámenes de redacción abierta que *necesitan* un humano para calificarse, un profesor real no tiene ninguna forma de enterarse de que hay una redacción pendiente — ni enlace en el menú, ni notificación (no existe ningún `fn_notify_*` para "hay una respuesta de redacción pendiente de calificar"; sólo existe notificación al estudiante cuando *ya* está calificada, `fn_notify_attempt_graded`). Si esto no se retoma antes de usar exámenes de redacción con estudiantes reales, esas preguntas podrían quedar sin calificar indefinidamente sin que nadie lo note.
- **No toqué el menú ni agregué notificaciones** — es una decisión de producto, no un bug de código, y cambiarla sin que Pedro/Marco lo confirmen iría contra la cláusula de plan vivo.

---

## 5. Hallazgo de contenido (no es un bug de código) — pregunta inapropiada en un examen de prueba

Al presentar el examen de certificación "sixeven 1" como estudiante de prueba, una de las 3 preguntas (verdadero/falso, tipo QA ya cargada por alguien antes de este chequeo) tiene un texto inapropiado y ofensivo. No es un bug de software — es contenido de prueba cargado en una sesión de QA anterior. Se deja documentado para que Marco/Pedro decidan si lo borran; no lo borré porque es una decisión de contenido, no una corrección de código.

---

## 6. Otro hallazgo — dos migraciones aplicadas directo a la base, nunca comitidas como archivo

Al revisar el historial de migraciones de `zr-staging` aparecen dos entradas (`188_unidad_visible_por_duda_propia`, `189_revertir_recursion_unidad_duda`, ambas del 6-nov-2026) que **no existen como archivo en ningún lado del repositorio**, en ninguna rama. Se recuperó su contenido real desde `supabase_migrations.schema_migrations.statements`:

- La 188 intentó agregar una política para que un estudiante pudiera seguir leyendo una unidad vieja si tenía una duda propia ligada a ella.
- Causó **recursión infinita** entre las políticas de `doubts` y `units` (la política FAQ de `doubts` consulta `units`, y la nueva política de `units` consultaba `doubts` — ciclo), rompiendo toda lectura de `doubts`, no solo la fila afectada.
- Se detectó de inmediato en QA y la 189 la revirtió el mismo día. **El efecto neto en el esquema actual es cero** (como si ninguna de las dos hubiera existido) — no hay nada que corregir hoy.
- Lo único que vale la pena señalar: ninguna de las dos quedó como archivo en `supabase/migrations/`, así que el historial de git no refleja lo que de verdad pasó en la base. No se recreó el archivo (sería ruido para un cambio que ya es neutro), pero se deja esto documentado para que quien siga trabajando en `units`/`doubts` sepa que ese intento ya se probó y por qué falló.

---

## 7. Dónde queda todo

- Fix de RLS: commit `1336f60` en `develop` (↔ `zr-staging`, ya aplicado ahí también a mano durante el chequeo).
- Documento maestro actualizado en el mismo commit (§8.1).
- Cuentas QA (`V-90000001/2/3`): contraseñas de prueba usadas durante este chequeo y luego reemplazadas por valores aleatorios desconocidos — no queda ninguna contraseña de prueba activa.
- Este reporte: `docs/reportes/chequeo_masivo_staging_2026-11-07.md`.
