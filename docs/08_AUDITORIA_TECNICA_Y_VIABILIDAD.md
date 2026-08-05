# AUDITORÍA TÉCNICA Y DICTAMEN DE VIABILIDAD — ZR APP
> **Fecha:** 30 de julio de 2026
> **Alcance auditado:** documentos `00_` a `07_` de esta carpeta.
> **Objeto:** determinar si el proyecto es construible tal como está documentado, identificar
> los huecos que impiden empezar, y dictaminar si la Fase 1 puede entregarse operando el
> **sábado 5 de septiembre de 2026**.
>
> Este documento **no reemplaza** los documentos `00_` a `07_`. Los audita. Las correcciones
> concretas viven en `09_DECISIONES_ARQUITECTONICAS.md` y `10_ESQUEMA_BASE_DATOS_V2.md`.

---

## 0. DICTAMEN EJECUTIVO

**El proyecto es viable. La documentación de negocio está por encima del promedio de la
industria. La documentación técnica no está lista para construir.**

Esa distinción es la conclusión central de esta auditoría y conviene entenderla bien antes de
leer la lista de hallazgos:

- Lo que la academia tenía que responder, **lo respondió**: precios, reglas de calificación,
  política de mora, marco legal de menores, estructura del programa, origen de las
  sub-competencias. El documento `07_` (registro de gaps abiertos) es una práctica de
  ingeniería que la mayoría de proyectos de este tamaño no tiene. Eso es capital real.
- Lo que faltaba era la traducción de esas reglas a un sistema construible. El esquema de
  base de datos `04_` es un buen **borrador conceptual** pero **no es ejecutable**: tiene
  tablas referenciadas que no existen, dos columnas que Postgres rechazaría literalmente, una
  fórmula de calificación que no cierra aritméticamente, cero diseño de control de acceso, y
  le falta la entidad estructural más importante del sistema (la sesión de clase).

**Veredicto de plazo:** Fase 1 completa operando el 5 de septiembre es **alcanzable, con margen
cero**. Requiere tres condiciones duras (sección 6). Si alguna de las tres falla, la fecha
realista se corre a la última semana de septiembre.

**Dato de contexto que cambia el marco mental:** el 5 de septiembre de 2026 **es sábado**. Es
decir, es un día de clases real. La entrega no debe ser una demo ante la Junta: debe ser la app
operando con la matrícula real ese sábado. Entre hoy y esa fecha hay **6 sábados operativos**
(1, 8, 15, 22 y 29 de agosto, y el 5 de septiembre). Ese calendario es el esqueleto del plan de
ejecución, porque nos da cinco ensayos con usuarios reales antes de la entrega.

---

## 1. LO QUE ESTÁ BIEN (y hay que proteger de futuras "mejoras")

No es cortesía: estas decisiones ya están tomadas correctamente y volver a discutirlas costaría
tiempo que no tenemos.

| # | Decisión acertada | Por qué protegerla |
|---|---|---|
| 1 | Reglas de negocio confirmadas por la Junta y trazadas documento a documento | Elimina la causa #1 de retrabajo: construir sobre supuestos. Ya está pagado ese costo. |
| 2 | Rechazo explícito del modelo de rachas tipo Duolingo, con fundamento | Es una decisión de producto argumentada, no un capricho. Alguien intentará "agregar rachas" en Fase 2; la respuesta ya está escrita en `06_` §1. |
| 3 | Registro vivo de gaps abiertos (`07_`) | Es exactamente el artefacto que evita que un proyecto se detenga sin saber por qué. |
| 4 | Política de mora con techo normativo explícito ("nunca bloqueo físico") | Convierte un requisito legal en una restricción de diseño imposible de violar por error. Bien hecho. |
| 5 | Separación de Flujo A (curricular) y Flujo B (UGC) en el modelo de datos | Evita el error clásico de mezclar contenido pedagógico con contenido social y quedar atrapado. |
| 6 | Reutilizar el escaneo de asistencia para el refrigerio en vez de montar NFC | Menos infraestructura, menos costo, menos superficie de fallo. |
| 7 | El mapa de dominio se alimenta de las Guías de Aprendizaje que **ya existen** | Reduce el trabajo de "diseñar competencias" a "digitalizar datos". Cambia la naturaleza del riesgo de creativo a logístico, que es mucho más manejable. |
| 8 | Principio de "cada feature debe quitar trabajo, no solo agregarlo" | Es el mejor filtro anti-scope-creep que tiene el proyecto. Úsalo en cada solicitud nueva. |

---

## 2. HALLAZGOS BLOQUEANTES
> Impiden empezar a construir. Todos están resueltos en `09_` y `10_`.

### B-1 — No existe la capa de identidad del sistema
`04_ESQUEMA_BASE_DATOS.md` referencia `teachers.id` (en `exams`, `exam_attempts`) y `admins.id`
(en `payments.reviewed_by`). **Ninguna de esas dos tablas está definida en el esquema.** Tampoco
existe una tabla de roles ni un modelo de permisos.

El documento `00_` §1 declara cuatro roles y `06_` §3.1 exige "separación de permisos por rol,
no solo por UI" — pero no hay una sola tabla que implemente eso.

**Impacto:** no se puede escribir la primera migración. Cualquier tabla con `teacher_id`
falla al crear la clave foránea.

### B-2 — `students.password_hash` contradice la arquitectura de autenticación
El esquema define `students.password_hash`, pero `01_` §2 establece Supabase como proveedor de
autenticación y `00_` §3.1 habla de sesión JWT. Supabase gestiona credenciales en su propio
esquema `auth.users`.

Mantener ambos crea **dos fuentes de verdad de identidad**: un usuario podría existir en una y
no en la otra, y la contraseña que valida el login no sería la misma que guarda la tabla.
Es un defecto de seguridad, no solo de diseño.

Además hay un problema práctico no resuelto: el registro se define como *nombre + cédula +
contraseña*, sin correo. Pero `00_` §3.1 también exige **recuperación de contraseña**, y no hay
ningún canal por el cual recuperarla. Esa contradicción no está señalada en ningún documento.

### B-3 — Cero diseño de control de acceso a nivel de datos (RLS)
Supabase expone la base de datos directamente al cliente. Sin **Row Level Security**, cualquier
estudiante con la app instalada puede leer las notas, la cédula, la fecha de nacimiento y los
consentimientos parentales de los otros 99 estudiantes con una sola petición.

Ningún documento menciona RLS. Es el hueco más grave de la auditoría, y es especialmente grave
aquí porque:
- La base contiene **datos de menores de edad** con cédula y datos del representante legal.
- El proyecto se declara sujeto a **LOPNNA** (`03_` §2).

Una fuga de esa base no es un incidente técnico, es un incidente legal.

### B-4 — No existe la entidad "sesión de clase"
El sistema entero gira alrededor del sábado, pero no hay una tabla que represente un sábado de
clase. `attendance_events` guarda un `session_date` suelto, y `feedback_micro` apunta a
`attendance_events.id` como si fuera una sesión.

Consecuencias reales:
- No se puede saber qué sábados estaban programados y cuáles se dieron.
- No se puede abrir/cerrar el pase de lista.
- No se puede pedir feedback a un estudiante que asistió pero no escaneó.
- No se puede reprogramar una clase (que `00_` §3.4 exige explícitamente permitir).

### B-5 — No existe el concepto de cohorte / sección
`students.current_module_id` asume que cada estudiante avanza en una línea única. Pero con
13 módulos, ~100 estudiantes activos y admisiones continuas, en un sábado cualquiera habrá
**varios grupos cursando módulos distintos al mismo tiempo**, con profesores distintos.

Sin una entidad `cohorts` (o secciones), el sistema no puede responder "¿quién debe estar hoy
en el taller 2 a las 8 am?" — que es literalmente la pregunta operativa que la app viene a
resolver. **Este hueco no está señalado en ningún documento del proyecto.**

### B-6 — La autocalificación de exámenes es imposible como está modelada
`exams` tiene un único campo `type` a nivel de examen (opción múltiple / V-F / redacción). Eso
implica que un examen no puede mezclar tipos de pregunta, cosa que ningún examen real cumple.

Peor: **no existe una tabla de preguntas.** Las respuestas se guardan en
`exam_attempts.answers jsonb` y no hay dónde guardar la respuesta correcta, el puntaje de cada
pregunta ni la rúbrica de la redacción. Con este modelo, la autocalificación prometida en
`00_` §3.4 no se puede implementar.

### B-7 — El anti-fraude del QR de asistencia no está especificado
`00_` §3.3 dice "QR dinámico generado por sesión/día, escaneado desde el móvil del estudiante".
Eso deja abiertos todos los detalles que determinan si el sistema funciona o no:

- ¿Cada cuánto rota el código? ¿Cuál es su ventana de validez?
- Un estudiante fotografía el QR proyectado y lo manda por WhatsApp a un compañero que no vino.
  **Con la especificación actual, ese fraude funciona.** Y es el fraude que va a ocurrir: el
  público tiene entre 15 y 25 años y la asistencia afecta la nota de participación.
- Requiere que **los 100 estudiantes** tengan conectividad simultánea en el taller — justo lo
  que el propio roadmap pone en duda al programar un spike de cobertura de red.

Hay una alternativa estructuralmente mejor que la documentación no consideró. Está desarrollada
en `09_` (ADR-005): **invertir la dirección del escaneo** — que el carnet del estudiante muestre
el código y el profesor escanee. Un solo dispositivo necesita señal, el fraude por reenvío
desaparece porque hay una persona verificando presencia física, y permite modo offline.

---

## 3. DEFECTOS TÉCNICOS DEL ESQUEMA
> No bloquean el arranque, pero romperían en el momento de ejecutar la migración o de calcular
> una nota. Corregidos en `10_ESQUEMA_BASE_DATOS_V2.md`.

| # | Defecto | Qué pasa realmente |
|---|---|---|
| D-1 | `students.is_minor` como **columna generada** a partir de `birth_date` | Postgres exige que la expresión de una columna generada sea `IMMUTABLE`. Calcular una edad requiere la fecha actual, que no lo es. **La migración falla al ejecutarse.** Además la minoría de edad cambia sola al cumplir 18 años: no es un dato, es una función del tiempo. |
| D-2 | `module_enrollments.passing_threshold` generada como "10 si `order_index`=1, si no 12" | Una columna generada **no puede leer otra tabla** (`modules`). No compila. Debe resolverse por función o por copia del `order_index` al inscribir. |
| D-3 | `module_enrollments.final_score` = `teoría×0.5 + práctica×0.5`, "ajustado con participación" | "Ajustado" no es una fórmula. No se puede implementar. Ver D-4, que es peor. |
| **D-4** | **La regla de calificación no cierra aritméticamente** | `00_` §3.4 dice: 50% teoría + 50% práctica, **y** mínimo 5% de participación. **50 + 50 + 5 = 105%.** Esta es una inconsistencia en una regla marcada como "confirmada y no negociable". Hay que devolvérsela a Coordinación Académica. Propuesta de resolución en `09_` ADR-007. |
| D-5 | `feedback_micro.class_session_id` → `attendance_events.id` | Modelado incorrecto (ver B-4). Impide que dé feedback quien asistió pero no escaneó, y hace imposible agregar feedback por sesión. |
| D-6 | `payments` declarado "inmutable" | Declararlo en un documento no lo hace inmutable. Requiere `REVOKE UPDATE`, política RLS y trigger de bloqueo. Sin eso, cualquiera con la clave de servicio edita un pago aprobado sin dejar rastro. |
| D-7 | `system_config` exigida en `04_` §10 pero **nunca definida** | La tabla que centraliza todos los parámetros "que nunca se deben hardcodear" no existe. Sin ella, se van a hardcodear. |
| D-8 | No existe tabla de auditoría | `00_` §4.3 la exige explícitamente para todo módulo con dinero. El esquema no la tiene. |
| D-9 | No existe `exchange_rates` (tasa BCV) | `02_` §4 exige sincronización diaria de la tasa BCV. No hay dónde guardarla, ni qué pasa el sábado en que la sincronización falle — que es el día de mayor volumen de pagos. **El BCV no publica una API oficial estable**; en la práctica se depende de raspado web, que se cae. Necesita fuente, respaldo manual y alarma de tasa vencida. *(Fase 2, no bloquea Fase 1.)* |
| D-10 | No existe `invoices` | `02_` §3 exige que los descuentos se registren como "descuento formal sobre factura". No hay entidad factura. Contradicción directa entre la regla contable y el esquema. *(Fase 2.)* |
| D-11 | "30% del **excedente** del inicial de $60" (`02_` §10) | ¿Excedente sobre qué base? No está definido. Tal como está, no es implementable. Requiere una cifra. *(Fase 2.)* |
| D-12 | `installments` / `payments` no soportan pago parcial de una cuota | Si un estudiante abona $20 de una cuota de $30, el modelo no tiene cómo representarlo. En cobranza manual de $30 semanales esto pasa constantemente. *(Fase 2.)* |
| D-13 | `learning_videos` declarado 1:1 con `learning_guides` | En la práctica una sub-competencia tendrá varios micro-videos. Debe ser 1:N desde el inicio; convertirlo después es una migración con datos vivos. *(Fase 2.)* |

---

## 4. HUECOS DE INGENIERÍA
> Son ausencias de proceso, no de código. Son los que hacen que un proyecto llegue tarde
> incluso cuando el código funciona.

| # | Hueco | Consecuencia si no se cierra | Dónde se cierra |
|---|---|---|---|
| G-1 | Sin entornos separados (dev / producción), sin CI, sin proceso de release | Se prueba en producción. Un error de migración un viernes deja a la academia sin sistema el sábado. | `11_` Sprint 0 |
| G-2 | Sin política de respaldo ni prueba de restauración | Base con PII de menores y sin plan de recuperación. Un respaldo que nunca se restauró **no es un respaldo**. | `11_` Sprint 0 y Sprint 5 |
| G-3 | Sin plan de pruebas ni criterios de aceptación verificables | "Terminado" se vuelve una opinión. En un plazo de 5 semanas eso es fatal. | `11_`, Definición de Hecho |
| G-4 | Sin estrategia de distribución de la app | Con FlutterFlow había que pasar por revisión de App Store: 7-10 días hábiles para la primera publicación, que no caben en el calendario. **Resuelto** al pasar a PWA instalable. | `09_` ADR-003 |
| G-5 | Sin comportamiento offline definido | El propio roadmap programa un spike de cobertura de red porque duda de la señal en el taller — pero el producto asume conectividad total. | `09_` ADR-006 |
| G-6 | Sin catálogo de notificaciones | Se implementan al azar, se duplican, o el estudiante recibe 8 avisos un sábado. | `11_` Sprint 4 |
| G-7 | Sin modelo de costos | Nadie aprobó un gasto recurrente. Ver sección 7. | Sección 7 de este documento |
| G-8 | Sin política de privacidad ni términos de uso | Es requisito legal bajo LOPNNA y requisito técnico para instalar una PWA y pedir cámara. **Es una tarea legal con plazo, no un trámite.** | `11_` Sprint 1, tarea legal |
| G-9 | Sin plan de carga de datos semilla | 13 módulos × ~4 semanas ≈ **52 sub-competencias** que hay que transcribir de guías físicas. Nadie las ha entregado todavía (gap declarado en `07_`). **Es la dependencia externa #1 del proyecto.** | `11_` Sprint 0-2, con fecha límite dura |
| G-10 | Sin línea base medida | El criterio de salida de Fase 1 es "horas de personal ahorradas" (`06_` §7), pero **nadie ha medido las horas actuales**. Sin línea base, el criterio de salida es inevaluable. | `11_` Sprint 0, sábado 1 de agosto |
| G-11 | Sin dueño de producto único con autoridad para decidir | Hay 7 gaps abiertos en `07_` y ninguno tiene un nombre propio con fecha al lado. Los gaps sin dueño no se cierran solos. | `11_`, tabla de responsables |
| G-12 | Sin plan de capacitación ni canal de soporte | Se entrega un sistema que el personal no sabe usar y vuelve a las planillas de papel a la primera fricción. Es la forma más común de fracasar con el código funcionando. | `11_` Sprint 5 |

---

## 5. AUDITORÍA DEL STACK
> Esta sección justifica el cambio de stack decidido el 30 de julio.

El stack de `01_STACK_TECNICO_LOWCODE.md` (FlutterFlow + Retool + n8n + OneSignal) fue elegido
con un criterio correcto para una premisa que ya no aplica: **"1-2 desarrolladores full-stack
+ 1 diseñador UX"**. El equipo real es dos personas técnicas más un agente de código. Eso
invierte la ecuación:

| Herramienta | Por qué se propuso | Por qué deja de convenir con este equipo |
|---|---|---|
| **FlutterFlow** | Acelera a un humano que no quiere escribir código | Es una **interfaz gráfica SaaS**: un agente de código no puede operarla. Todo lo que se construya ahí lo tiene que hacer una persona a mano, clic por clic. Se convierte en el cuello de botella exacto del proyecto. Además el código exportado no vive en git de forma revisable ni testeable. |
| **Retool** | Panel interno en días en vez de semanas | Cobra por usuario y por mes. Con profesores + administración se paga por gente que entra una vez por semana. Y es un segundo sistema con su propia autenticación, sus propios permisos y su propia superficie de fallo. |
| **n8n self-hosted** | Automatizaciones visuales | Un servidor más que mantener, monitorear y respaldar, para tareas que Supabase resuelve con `pg_cron` + Edge Functions dentro de la misma base. |

**Stack adoptado (decisión del 30/07/2026):**

| Capa | Herramienta | Justificación |
|---|---|---|
| Frontend estudiante + panel profesor/admin | **Next.js (App Router) + TypeScript, PWA instalable** | Un solo repositorio, un solo despliegue, un solo modelo de permisos. Mobile-first real. Instalable desde el navegador: **sin revisión de tiendas**. Cámara para QR vía API del navegador. 100% escribible, versionable y testeable por un agente de código. |
| Backend / base de datos | **Supabase** (se mantiene) | La elección original era correcta. Postgres real, Auth, Storage, Edge Functions, RLS. |
| Automatizaciones | **`pg_cron` + Edge Functions** | Sin infraestructura adicional. |
| Notificaciones | **Web Push (VAPID)**, correo transaccional como respaldo | Nativo en PWA, sin costo por suscriptor. |
| Video (Fase 2) | Cloudflare Stream | Se mantiene; sigue siendo correcto. |

**Costo de la decisión, dicho honestamente:** se renuncia a la app nativa en tiendas y al
acceso NFC. Ninguna de las dos está en Fase 1, y `00_` §3.3 ya clasifica el NFC como
"opcional, evaluar ROI". Si en Fase 3 el simulador visual exige nativo, un frontend web bien
estructurado migra a Flutter o React Native sin tocar la base de datos, que es donde vive el
valor real del sistema.

---

## 6. DICTAMEN DE VIABILIDAD Y ESTIMACIÓN

### 6.1 Estimación de esfuerzo (equipo: 2 técnicos + agente de código)

| Alcance | Estimación | Contra el plazo del 5 de septiembre |
|---|---|---|
| **Fase 1 completa** (auth, consentimiento LOPNNA, carnet, asistencia QR, evaluaciones, e-learning, feedback micro, paneles de profesor y admin) | **5 a 6 semanas** | **Cabe, con margen cero.** Disponibles: 5,3 semanas. |
| Fase 1 sin cumplir las tres condiciones de 6.2 | 8 a 9 semanas | Entrega a finales de septiembre. |
| Fase 2 (financiamiento, micro-learning, refrigerios, insignias) | +5 a 7 semanas | Octubre-noviembre. |
| Fase 3 | No estimable hasta cerrar los spikes de moderación y simulador | — |

**Punto de comparación:** el mismo alcance construido de forma tradicional, con un equipo
humano y sin agente de código, son **4 a 6 meses**. La ventaja del método no es que el código
aparezca solo: es que el tiempo se desplaza de escribir a decidir y verificar. Por eso los
riesgos de este proyecto ya no son de programación, son de **decisiones pendientes y datos que
no han llegado**.

### 6.2 Las tres condiciones duras
> Si alguna falla, la fecha se mueve. No es negociable con esfuerzo.

**Condición 1 — Congelamiento de alcance a partir del 3 de agosto.**
Lo listado en `11_PLAN_EJECUCION_FASE1.md` es lo que se entrega. Toda idea nueva entra a un
backlog de Fase 1.5 sin excepción, aplicando el principio de `00_` §0: si no quita trabajo a
alguien, no entra. En 5 semanas no hay espacio para una sola función no planificada.

**Condición 2 — Las Guías de Aprendizaje digitalizadas, a más tardar el 14 de agosto.**
Sin las ~52 sub-competencias no hay contenido, no hay mapa de dominio y no hay exámenes con qué
probar. Es una tarea de **transcripción**, no de diseño: alguien de la academia con las guías
físicas y una plantilla. Debe tener nombre y apellido asignado esta semana. Si el 14 de agosto
no están, la Fase 1 se entrega con el esqueleto vacío y la academia no puede usarla.

**Condición 3 — Un decisor único disponible en menos de 24 horas.**
Durante 5 semanas van a aparecer entre 15 y 25 preguntas de negocio que bloquean código. Si
cada una espera una reunión de Junta, el proyecto se detiene. Hace falta una persona con
autoridad delegada para responderlas en el día.

### 6.3 Qué se excluye explícitamente de Fase 1
Para que no haya ambigüedad al momento de evaluar la entrega:

- **Módulo de financiamiento completo.** El roadmap lo ubica en Fase 2 y ahí se queda. No se
  construye ninguna pantalla de pagos, cuotas o estado de cuenta. Un módulo de dinero a medias
  es peor que ninguno.
- Micro-learning en video, mapa de dominio con puntos, refrigerios con contabilidad, insignias.
- Todo lo de Fase 3 (UGC, portafolio público, simulador, roles de especialización).
- Integración con la API de Google Classroom (decisión del 30/07: repositorio propio).

**Efecto secundario favorable:** al no estar el financiamiento en Fase 1, el *Spike
Legal/Financiero* deja de bloquear la entrega de septiembre. Sigue siendo urgente para Fase 2,
pero sale de la ruta crítica de este plazo.

---

## 7. MODELO DE COSTOS

Cifras aproximadas en USD/mes para el piloto (≈100 estudiantes activos). **Deben verificarse
contra las tarifas vigentes al momento de contratar.**

| Concepto | Stack adoptado | Stack original (FlutterFlow + Retool) |
|---|---|---|
| Base de datos / backend | Supabase Pro — ~$25 | Supabase Pro — ~$25 |
| Constructor de frontend | $0 (código propio) | FlutterFlow — ~$70 |
| Panel interno | $0 (mismo repositorio) | Retool, por usuario — ~$96 con 8 usuarios |
| Hosting web | Vercel — $0 en piloto, ~$20 al escalar | No aplica |
| Automatizaciones | $0 (`pg_cron`) | n8n autoalojado — ~$10 de servidor |
| Notificaciones | $0 (Web Push) | OneSignal — $0 en volumen bajo |
| Cuentas de desarrollador de tiendas | $0 | Apple $99/año + Google $25 único |
| Dominio | ~$1,5 (≈$15/año) | ~$1,5 |
| **Total mensual aproximado** | **~$27 – $47** | **~$203** |

Ahorro aproximado: **$155-175 mensuales**, más la eliminación de 7-10 días hábiles de revisión
de tiendas del camino crítico. El costo de video (Cloudflare Stream) entra en Fase 2 y debe
presupuestarse aparte: escala con minutos almacenados y minutos vistos, no con usuarios.

---

## 8. REGISTRO DE RIESGOS

| # | Riesgo | Prob. | Impacto | Mitigación | Dueño |
|---|---|---|---|---|---|
| R-1 | Las Guías de Aprendizaje no llegan a tiempo | **Alta** | **Crítico** | Fecha límite dura 14/08; plantilla de captura entregada el 3/08; el sistema se construye con datos ficticios en paralelo para no detenerse | Coordinación Académica |
| R-2 | Aparecen funciones nuevas durante agosto | **Alta** | Alto | Congelamiento de alcance desde el 3/08; backlog de Fase 1.5 visible en Trello | Dueño de producto |
| R-3 | Conectividad insuficiente en el taller | Media | Alto | Escaneo invertido (un solo dispositivo con señal) + cola offline; prueba de campo el sábado 1/08 | TI e Infraestructura |
| R-4 | Fraude de asistencia por reenvío de QR | **Alta si no se corrige** | Medio | ADR-005: el profesor escanea al estudiante; código rotatorio de 30 s; auditoría de escaneos manuales | Equipo técnico |
| R-5 | Fuga de datos de menores por falta de RLS | Media | **Crítico** | RLS obligatoria en Sprint 0; ninguna tabla se crea sin política; prueba automatizada de acceso cruzado | Equipo técnico |
| R-6 | El personal no adopta el sistema y vuelve al papel | Media | **Crítico** | Ensayo en sábado real desde el 8/08; capacitación en Sprint 5; canal de soporte definido | Dueño de producto |
| R-7 | Decisiones de negocio que se estancan | Media | Alto | Condición 3: decisor único con respuesta en 24 h | Junta |
| R-8 | La regla de calificación (D-4) no se aclara | Media | Alto | Escalado a Coordinación Académica el 3/08 con propuesta ya redactada en ADR-007 | Coord. Académica |
| R-9 | Enfermedad o ausencia de un técnico en 5 semanas | Media | Alto | Todo en git, sin conocimiento en la cabeza de una sola persona; documentación de operación en Sprint 5 | Equipo técnico |

---

## 9. RECOMENDACIÓN FINAL

Adelante, con estas cinco acciones esta semana:

1. **Hoy/mañana:** designar al decisor único y al responsable de digitalizar las guías. Sin
   nombres propios, el resto del plan es decorativo.
2. **Antes del 3 de agosto:** aprobar `09_DECISIONES_ARQUITECTONICAS.md`. Son 8 decisiones con
   recomendación redactada; se aprueban o se corrigen, pero se cierran.
3. **Sábado 1 de agosto:** ir a la sede. Medir el tiempo real que hoy toma pasar lista y
   calificar (línea base de G-10), probar la señal en los talleres y fotografiar las guías.
   Ese sábado no se escribe código: se recoge realidad.
4. **Lunes 3 de agosto:** congelamiento de alcance y arranque del Sprint 1.
5. **Devolver a Coordinación Académica** la inconsistencia D-4 (50+50+5=105%) con la propuesta
   de ADR-007 lista para aprobar.

**Documentos que continúan esta auditoría:**
- `09_DECISIONES_ARQUITECTONICAS.md` — las 8 decisiones que cierran los bloqueantes.
- `10_ESQUEMA_BASE_DATOS_V2.md` — el esquema corregido y ejecutable, con matriz de RLS.
- `11_PLAN_EJECUCION_FASE1.md` — el plan paso a paso, sprint por sprint.
- `12_TABLERO_TRELLO.md` + `trello_import.csv` — el tablero listo para importar.
