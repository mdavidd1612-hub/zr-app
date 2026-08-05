# DECISIONES ARQUITECTÓNICAS (ADR) — ZR APP
> **Fecha de emisión:** 30 de julio de 2026
> **Propósito:** cerrar todos los huecos que impiden empezar a construir. Cada decisión tiene
> contexto, opciones evaluadas, decisión tomada y consecuencias.
>
> **Cómo usar este documento:** las decisiones marcadas `CERRADA` ya fueron aprobadas y son
> vinculantes para el código. Las marcadas `PROPUESTA` necesitan una aprobación formal antes
> del **3 de agosto de 2026**; si nadie las objeta para esa fecha, se dan por aprobadas y se
> construye sobre ellas (regla de silencio positivo, adoptada para no detener el proyecto).
>
> Una decisión revertida después de estar construida cuesta días, no minutos. Objetar ahora
> es gratis; objetar en tres semanas no lo es.

---

## Índice de decisiones

| ADR | Tema | Estado | Cierra |
|---|---|---|---|
| 001 | Identidad, roles y autenticación | CERRADA | B-1, B-2 |
| 002 | Control de acceso a datos (RLS) | CERRADA | B-3 |
| 003 | Stack técnico y distribución de la app | CERRADA | G-4 |
| 004 | Repositorio de contenido vs. Google Classroom | CERRADA | Gap #1 de `07_` |
| 005 | Mecánica y anti-fraude del QR de asistencia | PROPUESTA | B-7, R-4 |
| 006 | Comportamiento sin conexión | PROPUESTA | G-5 |
| 007 | Fórmula de calificación del módulo | **REQUIERE COORD. ACADÉMICA** | D-3, D-4 |
| 008 | Alcance de Fase 1 y línea de corte | CERRADA | R-1, R-2 |
| 009 | Cohortes y estructura académica | PROPUESTA | B-5 |
| 010 | Parametrización y auditoría | CERRADA | D-6, D-7, D-8 |

---

## ADR-001 — Identidad, roles y autenticación
**Estado:** CERRADA · **Cierra:** B-1, B-2

### Contexto
El esquema `04_` referencia `teachers.id` y `admins.id` sin definirlos, y guarda
`students.password_hash` aunque la autenticación la provee Supabase. El registro se define como
*nombre + cédula + contraseña* sin correo, pero se exige recuperación de contraseña — sin
ningún canal por el cual recuperarla.

### Decisión
1. **`auth.users` de Supabase es la única fuente de verdad de credenciales.** Se elimina
   `students.password_hash` del esquema. Ninguna tabla propia guarda contraseñas.
2. Se crea **`profiles`**, en relación 1 a 1 con `auth.users`, con el campo `role` de tipo
   `enum('estudiante','profesor','admin','super_admin')`. Es la tabla de identidad común.
3. **`students`, `teachers` y `admins`** son tablas de extensión cuya clave primaria es también
   clave foránea a `profiles.id`. Cada una guarda solo los atributos propios de ese rol.
4. **El rol se replica en el `app_metadata` del JWT** al crear o cambiar un usuario. Esto
   permite que las políticas de RLS lean el rol del token sin una consulta adicional por fila,
   que es lo que mata el rendimiento en Supabase. `app_metadata` no es editable por el cliente:
   ese es el punto.
5. **Identificador de acceso:** el estudiante inicia sesión con su **cédula**. Internamente se
   mapea a un correo sintético `{cedula}@estudiante.zrmecademy.com` para satisfacer a Supabase
   Auth. El estudiante nunca ve ese correo.
6. **Canal de recuperación:** el registro exige un **correo de contacto real** además de la
   cédula. Para estudiantes de 15-17 años, ese correo es el **del representante legal**.

### Consecuencias
- El punto 6 resuelve dos problemas con una sola decisión: da un canal de recuperación de
  contraseña y **crea el vínculo verificable con el representante legal** que LOPNNA exige.
  El correo del representante deja de ser un dato administrativo y pasa a ser parte del
  mecanismo de consentimiento.
- Un menor no puede recuperar su contraseña sin pasar por el correo de su representante. Es
  una fricción deliberada y correcta.
- Un usuario puede tener exactamente un rol. Si en el futuro alguien es profesor y admin, se
  resuelve con `super_admin` o con una tabla `profile_roles`; **no se construye ahora**.

---

## ADR-002 — Control de acceso a datos (RLS)
**Estado:** CERRADA · **Cierra:** B-3

### Contexto
Supabase expone Postgres directamente al cliente. Sin Row Level Security, cualquier estudiante
puede leer los datos de todos los demás. La base contiene cédulas, fechas de nacimiento,
notas y datos de representantes legales de menores de edad.

### Decisión
1. **`ENABLE ROW LEVEL SECURITY` en el 100% de las tablas del esquema `public`.** Sin
   excepciones y sin "esta es interna, después le pongo".
2. **Regla de construcción obligatoria:** ninguna migración que cree una tabla se da por
   terminada sin sus políticas en la misma migración. Una tabla sin política es una tabla que
   nadie puede leer — ese es el estado por defecto correcto.
3. **La clave `service_role` nunca se expone al cliente.** Vive únicamente en variables de
   entorno del servidor (Edge Functions y rutas de servidor de Next.js).
4. **Prueba automatizada de acceso cruzado** en el conjunto de pruebas: el estudiante A intenta
   leer las notas, los pagos y el consentimiento del estudiante B. Debe fallar. Esta prueba se
   ejecuta en cada integración continua y **es criterio de bloqueo de despliegue**.
5. Matriz completa de políticas por tabla en `10_ESQUEMA_BASE_DATOS_V2.md` §7.

### Consecuencias
- Se paga un costo de disciplina en cada migración a cambio de eliminar la clase de fallo más
  peligrosa del proyecto.
- Toda escritura sensible (calificar, aprobar un pago, emitir un certificado) pasa por Edge
  Functions con `service_role`, no por escritura directa del cliente.

---

## ADR-003 — Stack técnico y distribución de la app
**Estado:** CERRADA (aprobada el 30/07/2026) · **Cierra:** G-4

### Contexto
`01_STACK_TECNICO_LOWCODE.md` elige FlutterFlow + Retool + n8n asumiendo un equipo de 1-2
desarrolladores humanos y un diseñador. El equipo real son dos personas técnicas más un agente
de código, lo que invierte el cálculo: una interfaz gráfica SaaS que el agente no puede operar
se convierte en el cuello de botella. Análisis completo en `08_` §5.

### Decisión
| Capa | Herramienta |
|---|---|
| Frontend estudiante y paneles internos | **Next.js (App Router) + TypeScript**, PWA instalable, mobile-first |
| Backend, base de datos, autenticación, almacenamiento | **Supabase** (sin cambios) |
| Lógica sensible de servidor | **Edge Functions** de Supabase |
| Tareas programadas | **`pg_cron`** dentro de Postgres |
| Notificaciones | **Web Push (VAPID)**, correo transaccional como respaldo |
| Video (Fase 2) | Cloudflare Stream (sin cambios) |

**Distribución:** PWA instalable desde el navegador. **No se publica en App Store ni Play Store
en Fase 1.**

### Consecuencias
- Se elimina del camino crítico la revisión de tiendas (7-10 días hábiles la primera vez), que
  no cabía en el plazo del 5 de septiembre.
- Un solo repositorio, un solo despliegue, un solo modelo de permisos para los cuatro roles.
- Ahorro aproximado de $155-175 mensuales (ver `08_` §7).
- Se renuncia al acceso NFC nativo, que `00_` §3.3 ya clasificaba como opcional y sujeto a ROI.
- **Cámara en PWA:** funciona vía `getUserMedia` en Android/Chrome y en iOS/Safari. Requiere
  **HTTPS obligatorio** (que Vercel provee) y permiso explícito del usuario. Se verifica en el
  Sprint 0 con los modelos de teléfono reales del personal, no en teoría.
- `01_STACK_TECNICO_LOWCODE.md` queda **superado** por esta ADR. No se borra: se conserva como
  registro de la evaluación original.

---

## ADR-004 — Repositorio de contenido vs. Google Classroom
**Estado:** CERRADA (aprobada el 30/07/2026) · **Cierra:** gap #1 de `07_`

### Contexto
El hallazgo principal de `07_` §2: la academia ya usa Google Classroom, y la política de mora
confirmada asume que el bloqueo se ejecuta sobre esa plataforma. Esto abría la duda de si ZR
App debía integrarse con la API de Classroom o construir su propio repositorio.

### Decisión
**ZR App construye su propio repositorio de contenido sobre Supabase Storage.** Google Classroom
continúa operando en paralelo como sistema heredado y se retira gradualmente, por decisión
académica, no técnica. **No se integra la API de Google Classroom en Fase 1 ni en Fase 2.**

### Consecuencias
- Se elimina una dependencia dura de Google Workspace for Education, cuya administración de
  cuentas ni siquiera está confirmada (era una de las tres preguntas abiertas de `02_` §9).
- **Consecuencia importante sobre la política de mora:** cuando el financiamiento entre en
  Fase 2, el bloqueo digital por mora aplicará **al contenido dentro de ZR App**, no a
  Classroom. Mientras Classroom siga activo, un estudiante en mora podría seguir accediendo al
  contenido por esa vía. Esto debe informarse a la Coordinación Administrativa: **la política
  de mora solo será plenamente efectiva cuando Classroom se retire.** No es un defecto del
  sistema, es una consecuencia de la transición, y conviene que esté dicha por escrito antes
  de que alguien la descubra en producción.
- Durante la migración habrá contenido en dos lugares. Se necesita una fecha de corte
  académica: **propuesta, fin de Fase 1** — a partir del 5 de septiembre, el contenido nuevo se
  publica solo en ZR App.
- El bloqueo por mora **nunca** afecta el acceso físico a aulas o talleres (`02_` §7). Esta
  restricción se implementa como una imposibilidad del sistema, no como una configuración.

---

## ADR-005 — Mecánica y anti-fraude del QR de asistencia
**Estado:** PROPUESTA · **Cierra:** B-7, R-4 · **Aprobar antes del:** 3 de agosto

### Contexto
`00_` §3.3 especifica "QR dinámico generado por sesión/día, escaneado desde el móvil del
estudiante". Esa dirección de escaneo tiene dos problemas graves en el contexto real de la
academia:

1. **Fraude por reenvío:** un estudiante fotografía el código proyectado y lo envía por
   WhatsApp a un compañero ausente, que marca asistencia desde su casa. La asistencia afecta
   la nota de participación, así que hay incentivo. Este fraude va a ocurrir.
2. **Dependencia de conectividad masiva:** exige que ~100 teléfonos tengan señal simultánea en
   un taller cuya cobertura el propio roadmap pone en duda al programar un spike de red.

### Decisión propuesta: **invertir la dirección del escaneo**

- El **carnet digital del estudiante muestra un código QR rotatorio**, derivado de un secreto
  individual mediante un algoritmo de contraseña temporal (TOTP), con **ventana de 30 segundos**.
- El **profesor o el personal administrativo escanea** ese código con un dispositivo designado
  (un teléfono o tablet de la academia).
- El servidor valida: código dentro de ventana, sesión abierta, estudiante inscrito en la
  cohorte de esa sesión, y que no exista ya un registro para ese par estudiante-sesión.
- **Entrega de refrigerio:** el mismo escaneo, en un segundo momento del día, marca
  `snack_claimed_at`. Un solo mecanismo, dos usos, como ya decidía `00_` §3.8.
- **Respaldo manual:** el panel del profesor permite buscar por cédula y marcar asistencia a
  mano. Todo registro manual queda marcado como tal, con quién lo hizo y cuándo. Se audita.

### Por qué es mejor
| Criterio | Estudiante escanea (documentado) | Profesor escanea (propuesto) |
|---|---|---|
| Fraude por reenvío del código | **Posible** | **Imposible**: hay una persona verificando presencia física |
| Dispositivos que necesitan señal | ~100 | **1** |
| Modo sin conexión | Inviable | **Viable**: un solo dispositivo con cola local |
| Estudiante sin datos móviles ese día | Queda fuera | Sin problema |
| Estudiante sin teléfono | Queda fuera | Respaldo manual por cédula |
| Costo | $0 | $0 (se usa un teléfono existente) |

### Consecuencias
- Requiere designar **al menos un dispositivo escáner por aula/taller** y quién lo opera. Es
  una decisión operativa que la academia debe tomar antes del 15 de agosto.
- El carnet digital debe poder mostrar el QR **sin conexión** (el TOTP se genera localmente a
  partir del secreto guardado en el dispositivo tras el primer inicio de sesión).
- El secreto TOTP del estudiante nunca se envía al cliente en texto plano después del primer
  aprovisionamiento, y puede rotarse si se pierde el teléfono.

---

## ADR-006 — Comportamiento sin conexión
**Estado:** PROPUESTA · **Cierra:** G-5 · **Aprobar antes del:** 3 de agosto

### Contexto
El roadmap programa un spike de cobertura de red porque la señal en los talleres de San Antonio
de los Altos es dudosa, pero el producto está diseñado asumiendo conectividad permanente. Si el
sábado a las 8 de la mañana no hay señal, el pase de lista no ocurre y el sistema pierde
credibilidad en su primer uso real.

### Decisión propuesta
Se define soporte sin conexión **selectivo**, no general. Solo donde el fallo es inaceptable:

| Función | Comportamiento sin conexión |
|---|---|
| **Escaneo de asistencia** (dispositivo del profesor) | **Cola local obligatoria.** Los escaneos se guardan en el dispositivo y se sincronizan al recuperar señal. Indicador visible de "N registros sin sincronizar". Cada registro lleva su marca de tiempo original, no la de sincronización. |
| **Carnet digital y QR del estudiante** | **Funciona sin conexión.** El QR se genera localmente. |
| **Contenido de e-learning** | Lectura de lo ya descargado. Sin descarga masiva anticipada en Fase 1. |
| **Exámenes** | **Requieren conexión.** Se documenta como requisito operativo: los exámenes se aplican en un espacio con señal verificada. Permitir exámenes sin conexión abre problemas de integridad que no se resuelven en 5 semanas. |
| **Feedback micro** | Requiere conexión. Se puede responder después. |

### Consecuencias
- Se implementa una cola local con `IndexedDB` y un trabajador de servicio (service worker),
  únicamente en la vista de escaneo. No se convierte la aplicación entera en offline-first:
  ese esfuerzo no cabe en el plazo y no lo justifica el beneficio.
- La sincronización debe ser **idempotente**: reenviar el mismo escaneo dos veces no crea dos
  asistencias. Se resuelve con una clave única por `(estudiante, sesión)`.
- Se debe verificar la señal real en los talleres el **sábado 1 de agosto** y documentar qué
  espacios sirven para aplicar exámenes.

---

## ADR-007 — Fórmula de calificación del módulo
**Estado:** **REQUIERE DECISIÓN DE COORDINACIÓN ACADÉMICA** · **Cierra:** D-3, D-4
**Fecha límite:** 7 de agosto (antes de construir el módulo de evaluaciones, Sprint 3)

### Contexto — hay una inconsistencia aritmética en una regla marcada como confirmada
`00_` §3.4 establece, como reglas "no negociables":
- El módulo se compone de **50% teoría + 50% práctica**.
- El profesor debe asignar **mínimo 5%** de la nota final a participación.

**50% + 50% + 5% = 105%.** Las dos reglas no pueden cumplirse simultáneamente tal como están
escritas. Además `04_` describe `final_score` como `teoría×0.5 + práctica×0.5` "ajustado con
participación", y "ajustado" no es una fórmula implementable.

Esto no es una objeción formal: es un cálculo que el sistema tiene que ejecutar cien veces por
módulo y que determina si un estudiante aprueba o reprueba. **No se puede programar hasta que
alguien defina qué significa.**

### Opciones

**Opción A — La participación se descuenta proporcionalmente de ambos componentes** *(recomendada)*
```
peso_participación = p        (p ≥ 0,05, definido por el profesor)
peso_teoría = peso_práctica = (1 − p) / 2

nota_final = teoría × peso_teoría + práctica × peso_práctica + participación × p
```
Con p = 0,10 → teoría 45%, práctica 45%, participación 10%. Suma exactamente 100%, respeta el
equilibrio 50/50 entre teoría y práctica, y respeta el mínimo del 5%.

**Opción B — La participación vive dentro de la nota de teoría**
El 50/50 se mantiene intacto y el profesor incluye la participación como un componente de la
nota teórica. Es lo que probablemente hacen hoy en papel. Ventaja: cero cambio en la práctica
docente. Desventaja: la participación deja de ser visible como dato propio y no se puede
reportar ni auditar por separado.

**Opción C — La participación es un ajuste sobre la nota calculada**
`nota_final = (teoría×0,5 + práctica×0,5) × (1 + ajuste)`, acotado a 20. Es el más parecido a
la redacción literal, pero es el más difícil de explicar a un estudiante que reclama su nota, y
puede producir resultados contraintuitivos. **No recomendada.**

### Recomendación
**Opción A.** Es explícita, auditable, suma 100%, respeta las dos reglas y deja la
participación como un dato de primera clase que los reportes académicos pueden usar.

### Independientemente de la opción elegida — reglas que ya quedan fijas
- Escala sobre 20 en todo el sistema.
- Evaluación individual: aprueba con ≥ 10.
- Módulo: aprueba con ≥ 12, **excepto el primer módulo del programa**, que aprueba con ≥ 10.
- El umbral de aprobación se **copia al inscribir** al estudiante en el módulo, no se calcula
  al vuelo (ver defecto D-2). Así una nota histórica no cambia si mañana cambia la política.
- El peso de participación se guarda por cada inscripción, no global, porque cada profesor
  define el suyo.
- **No existe reprobación automática por inasistencia** (`00_` §3.4). El sistema no debe
  implementar jamás un contador de faltas que dé de baja a nadie.

---

## ADR-008 — Alcance de Fase 1 y línea de corte
**Estado:** CERRADA · **Cierra:** R-1, R-2

### Decisión
**Entra en Fase 1 (entrega: sábado 5 de septiembre de 2026, operando en producción):**
1. Autenticación, perfil y sesión persistente.
2. Consentimiento parental LOPNNA para 15-17 años, dentro del registro.
3. Carnet estudiantil digital con QR rotatorio.
4. Asistencia por escaneo, con sesiones de clase, respaldo manual y cola sin conexión.
5. Marcado de entrega de refrigerio sobre el mismo escaneo.
6. Evaluaciones digitales: banco de preguntas, opción múltiple y verdadero/falso
   autocalificadas, redacción abierta con cola de calificación.
7. Repositorio de e-learning: PDFs y material por programa → módulo → semana.
8. Feedback micro por clase (máximo 3 preguntas).
9. Panel de profesor: sesiones, asistencia, exámenes, calificación, feedback.
10. Panel de administración: estudiantes, cohortes, módulos, reportes operativos.
11. Configuración de sistema (`system_config`) editable por Super Admin.

**No entra en Fase 1:** todo el módulo de financiamiento, micro-learning en video, mapa de
dominio con puntos, contabilidad de refrigerios, insignias, y la totalidad de Fase 3.

### Línea de corte
Si al **lunes 31 de agosto** el avance no permite entregar todo, se recorta **en este orden
exacto**, de arriba hacia abajo:

| Orden | Qué se recorta | A qué se degrada |
|---|---|---|
| 1.º | Reportes avanzados del panel de administración | Exportación a CSV y consultas manuales |
| 2.º | Notificaciones Web Push | Aviso por correo, o el profesor avisa en clase |
| 3.º | Visor de PDF integrado | Descarga directa del archivo |
| 4.º | Preguntas de redacción abierta | Solo opción múltiple y verdadero/falso |
| 5.º | Repositorio de e-learning completo | Enlaces a Classroom mientras dure la transición |

**Nunca se recorta, bajo ninguna circunstancia:**
- Consentimiento parental LOPNNA (requisito legal).
- Row Level Security (requisito legal y de seguridad).
- Asistencia por escaneo (es el dolor operativo que justifica el proyecto).
- Respaldo de base de datos con restauración probada.

---

## ADR-009 — Cohortes y estructura académica
**Estado:** PROPUESTA · **Cierra:** B-5 · **Aprobar antes del:** 3 de agosto

### Contexto
El esquema asume que cada estudiante tiene un `current_module_id` y avanza en línea recta. Con
13 módulos, ~100 estudiantes activos y admisiones que no ocurren todas el mismo día, un sábado
cualquiera habrá varios grupos cursando módulos distintos, en espacios distintos, con
profesores distintos. **El esquema actual no puede representar eso**, y por tanto no puede
responder la pregunta operativa central: *¿quién debe estar hoy en el taller 2?*

### Decisión propuesta
Se introduce **`cohorts`** (grupos/secciones) como entidad de primera clase:
- Una cohorte pertenece a un programa, tiene nombre (ej. "Cohorte 2026-B"), fecha de inicio y
  estado.
- Una cohorte cursa **un módulo a la vez**, con un profesor asignado y un espacio físico.
- El estudiante se inscribe en **una cohorte**, y de ahí se deriva su módulo actual.
- Una **sesión de clase** (`class_sessions`) pertenece a una cohorte y a una fecha (un sábado).
- `students.current_module_id` se elimina: se deriva de la cohorte. Un dato derivado que se
  guarda a mano es un dato que se va a desincronizar.

### Consecuencias
- La academia debe declarar cuántas cohortes activas hay hoy y en qué módulo va cada una. Es un
  dato que ya existe en su operación, pero que ningún documento del proyecto había capturado.
  **Debe recogerse el sábado 1 de agosto.**
- Permite reprogramar una clase de una cohorte sin afectar a las demás, que `00_` §3.4 exige.
- Es la única forma de que el panel del profesor muestre "mi clase de hoy" en vez de una lista
  de 100 estudiantes.

---

## ADR-010 — Parametrización, inmutabilidad y auditoría
**Estado:** CERRADA · **Cierra:** D-6, D-7, D-8

### Contexto
`04_` §10 exige que ciertos valores nunca se codifiquen en duro y menciona una tabla
`system_config` "o equivalente" que nunca define. `00_` §4.3 exige una tabla de auditoría
inmutable para todo módulo con dinero, que el esquema no incluye. `02_` §5.2 declara los pagos
inmutables sin ningún mecanismo que lo garantice.

### Decisión
1. **`system_config`** se define formalmente (clave, valor JSON, descripción, quién y cuándo lo
   cambió) con una tabla de historial. Toda lectura de un parámetro pasa por ahí. Ningún
   porcentaje, umbral ni monto vive en el código del cliente.
2. **`audit_log`** se crea desde la primera migración, no cuando llegue el dinero en Fase 2.
   Registra actor, acción, entidad, estado anterior y posterior, y momento. Se llena por
   disparadores de base de datos, no por código de aplicación: lo que depende de que un
   programador se acuerde de escribirlo, se olvida.
3. **Inmutabilidad real:** las tablas append-only (`payments`, `audit_log`, `attendance_events`)
   se protegen con `REVOKE UPDATE, DELETE` y un disparador que rechaza la modificación. Una
   corrección crea un registro nuevo que referencia al anterior; nunca lo edita.
4. **Parámetros que viven en `system_config` desde el día 1:** umbrales de aprobación (10 y 12),
   peso mínimo de participación (5%), ventana de validez del QR (30 s), máximo de preguntas de
   feedback micro (3), SLA de calificación. Y, cuando llegue Fase 2: porcentajes Cash & Carry
   (60/50/40), umbral del incentivo académico (18/20), reserva del fondo de refrigerios (30%).

### Consecuencias
- Cambiar una política de negocio pasa a ser una edición en un panel, no un despliegue.
- La auditoría existe desde antes de que haya algo que auditar, que es la única forma en que
  sirve: una auditoría añadida después no tiene el histórico.

---

## Registro de aprobación

| ADR | Aprobado por | Fecha | Observaciones |
|---|---|---|---|
| 001 | | | |
| 002 | | | |
| 003 | Dirección de proyecto | 30/07/2026 | Aprobada en sesión de planificación |
| 004 | Dirección de proyecto | 30/07/2026 | Aprobada en sesión de planificación |
| 005 | | | *Pendiente — límite 03/08* |
| 006 | | | *Pendiente — límite 03/08* |
| 007 | | | **Requiere Coordinación Académica — límite 07/08** |
| 008 | Dirección de proyecto | 30/07/2026 | Aprobada en sesión de planificación |
| 009 | | | *Pendiente — límite 03/08* |
| 010 | | | |
