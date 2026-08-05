# CONTEXTO MAESTRO — ZR APP (ZR MECADEMY)
> Documento raíz para agentes de código (Claude Code, Cursor, Copilot Workspace, etc.)
> Léelo completo antes de generar código, esquemas o UI. Los demás documentos de esta carpeta
> son extensiones detalladas de secciones específicas de este archivo.
>
> **Actualización Julio 2026:** este documento incorpora las reglas de negocio confirmadas por
> la Junta y las coordinaciones Académica, Administrativa/Financiera y Legal tras la mesa de
> planificación operativa (ver `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md` para el detalle de
> qué cambió, qué se confirmó y qué sigue abierto). El esquema `04_ESQUEMA_BASE_DATOS.md`,
> antes inexistente, ya está disponible.

## 0. RESUMEN EJECUTIVO
ZR App es la plataforma digital de ZR Mecademy, una academia técnica de mecánica automotriz.
El público principal tiene entre 15 y 25 años. El objetivo no es construir "todo el sistema
posible", sino resolver primero los dolores operativos reales de la academia (asistencia,
evaluaciones, pagos, contenido) y luego capas de retención (gamificación, video, comunidad).

**Principio de diseño no negociable:** cada feature debe sumar valor neto a al menos uno de los
tres roles (estudiante, profesor, administración) sin generar fricción a los otros dos. Si un
módulo agrega trabajo sin quitar trabajo en otro lado, se cuestiona antes de construirse.

### 0.1 Estructura real del programa (confirmado por Coordinación Académica)
- El programa completo consta de **13 módulos**, con una duración total de **13 meses**.
- Duración típica de un módulo: **4 sábados** (4 semanas). Existen excepciones planificadas:
  módulos cortos de 3 sábados y módulos especiales de hasta 8 sábados.
- Las clases son **sabatinas** (una sesión presencial por semana, el sábado) — esto es
  estructural para todo el sistema: asistencia, cuotas de financiamiento y entrega de
  refrigurios están todas ancladas al ciclo semanal de sábados, no a un calendario genérico.
- El contenido curricular y las sub-competencias por módulo **ya existen** en forma de
  **Guías de Aprendizaje** físicas (investigación previa entre semana + práctica de taller el
  sábado + informe evaluado por el profesor). No hay que crearlas desde cero: hay que
  digitalizarlas y estructurarlas para alimentar el mapa de dominio (ver sección 3.10 y
  `05_ROADMAP_FASES.md`, hito de Semana 1).

## 1. ROLES DEL SISTEMA
1. **Estudiante** — usuario final, mobile-first, consume contenido, paga cuotas, gana puntos.
2. **Profesor** — habilita exámenes, califica preguntas abiertas, sube contenido de módulo,
   revisa feedback de sus clases.
3. **Administración** — gestiona pagos/comprobantes, inventario de refrigerios, moderación de
   contenido social, emisión de certificados, reportes generales.
4. **Super Admin / Dirección Académica** — configura programas, módulos, tarifas, políticas de
   financiamiento y moderación.

## 2. FASES DEL PROYECTO (ver `05_ROADMAP_FASES.md` para detalle)
- **Fase 1 (MVP — dolor operativo):** Login/Perfil, Carnet Digital, Asistencia QR, Evaluaciones
  Digitales, Repositorio E-learning, Feedback micro por clase.
- **Fase 2 (Retención + Ingreso):** Financiamiento estilo Cashea, Gamificación con Video
  Micro-learning, Refrigerios (reusando QR de asistencia, sin módulo NFC dedicado).
- **Fase 3 (Diferenciador de marca, sujeto a validación):** Red social interna de video (UGC),
  Portafolio/Certificación pública, Simulador visual interactivo, Roles dinámicos avanzados.

## 3. MÓDULOS — ESPECIFICACIÓN RESUMIDA

### 3.1 Autenticación y Perfil
- Registro: nombre completo, cédula, contraseña.
- Login simple, recuperación de contraseña, sesión persistente (JWT).
- Onboarding objetivo: **menos de 60 segundos**, sin fricción.

### 3.2 Carnet Estudiantil Digital
- Sincronización en tiempo real con base central.
- Muestra: programa activo, módulo actual, historial de módulos completados.
- Evoluciona en Fase 3 hacia portafolio público (ver sección 3.11).
- Asignación progresiva de "roles de especialización" según cuestionarios y desempeño —
  **confirmado como Fase 3**, sin cambios de alcance; sigue sin existir un responsable
  académico asignado para diseñar esos cuestionarios (ver `07_REGISTRO_DE_CAMBIOS...md`).

**Regla de certificación confirmada (afecta directamente qué debe mostrar el carnet):**
- La academia **no emite certificado por módulo individual** en la sede de San Antonio de
  los Altos. El certificado oficial de "Técnico Automotriz" (avalado por Semprom/PROEM) se
  emite únicamente al aprobar **los 13 módulos de forma consecutiva**.
- Alianza con **INCES**: homologa y certifica de forma independiente 4 módulos específicos
  (Electricidad, Transmisión, Suspensión/Frenos, Dirección) bajo su programa PPL. El
  estudiante recibe esos certificados adicionales del INCES, aparte del certificado final.
- **Nueva función aprobada:** si un estudiante se retira antes de terminar el programa, puede
  solicitar una **"certificación de notas"** — una constancia descargable (PDF) de los
  módulos que sí cursó y aprobó, sin validez de título de técnico, pero útil como aval
  parcial de currículum. Esto debe modelarse como un documento distinto al certificado
  oficial final (entidad separada, no un estado más del mismo certificado).

### 3.3 Asistencia Automatizada
- **Fase 1:** QR dinámico generado por sesión/día, escaneado desde el móvil del estudiante.
- **Fase 2+ (opcional, evaluar ROI):** NFC físico como respaldo, no como reemplazo.
- Registro automático en base de datos, sin intervención manual del staff.
- Este mismo evento de escaneo se reutiliza para validar la entrega de refrigerio (ver 3.8).

### 3.4 Evaluaciones Digitales
- Exámenes ocultos hasta que el profesor los habilita desde su dashboard (dispara notificación).
- Tipos: opción múltiple (auto-calificado), verdadero/falso (auto-calificado), redacción abierta
  (cola de calificación manual para el profesor).
- Estado del examen: `oculto` → `habilitado` → `en_progreso` → `entregado` → `calificado`.

**Reglas de calificación confirmadas por Coordinación Académica (no negociables, van al
esquema de datos tal cual):**
- Escala numérica: **sobre 20 puntos** en todas las evaluaciones internas.
- Una evaluación individual se aprueba con **10 puntos o más**.
- El módulo completo se compone de **50% teoría + 50% práctica**, y se aprueba con:
  - **10 puntos o más** — únicamente en el **primer módulo** (regla excepcional de arranque).
  - **12 puntos o más** — a partir del **segundo módulo** en adelante.
- **Participación:** el profesor debe asignar un porcentaje de la nota final a participación
  en clase (**mínimo 5%**, el valor exacto queda a criterio de cada docente, no es fijo en el
  sistema). La participación **solo se obtiene asistiendo y participando activamente** —
  faltar implica perder automáticamente ese porcentaje.
- **Asistencia — regla explícitamente flexible, no rígida:** no existe una regla automática
  de "pierdes el módulo si faltas N sábados". Un estudiante que falta un sábado pero se pone
  al día con las actividades/prácticas de esa semana no pierde el módulo por eso. La
  reprobación ocurre de forma natural cuando las faltas repetidas le impiden acumular notas
  de teoría, práctica y participación suficientes — **el sistema no debe implementar una
  baja automática por inasistencia**, solo debe permitir reprogramación de actividades
  guiada por el profesor.
- La evaluación práctica en taller sigue una guía con objetivos/competencias definidos
  (pre-práctica de investigación + práctica física del sábado + informe evaluado por el
  profesor), con margen de "libertad de cátedra" para que el docente amplíe el contenido
  según su experiencia — no está 100% estandarizado entre profesores, y no se fuerza a que
  lo esté.

### 3.5 Simulador Visual (Fase 3)
- Entorno interactivo de diagnóstico vehicular.
- **No se construye en Fase 1 ni 2.** Requiere spike de viabilidad técnica y de costo antes de
  comprometer roadmap (ver `05_ROADMAP_FASES.md`, sección de spikes).

### 3.6 E-learning y Repositorio
- Contenido: presentaciones, PDFs técnicos, fórmulas, esquemas con zoom.
- Organización por programa → módulo → clase.
- Requiere buen manejo de assets pesados (PDFs, imágenes de alta resolución) — ver stack técnico.

**⚠️ Hallazgo nuevo — pendiente de decisión con TI antes de construir este módulo:** la
política de mora confirmada (`02_MODULO_FINANCIAMIENTO.md`, sección 7) bloquea "acceso al
contenido digital y asignaciones a través de la plataforma virtual (**Google Classroom**)".
Esto revela que la academia **ya usa Google Classroom** como plataforma de contenido, lo cual
no estaba contemplado en el stack original (que asumía un repositorio propio en Supabase
Storage). El agente de código **no debe asumir automáticamente** cuál de estas dos rutas
tomar sin validarlo primero:
1. ZR App construye su propio repositorio E-learning en Supabase (como se planeó originalmente),
   y Google Classroom queda como una herramienta paralela/legada que se retira con el tiempo, o
2. ZR App se integra con la API de Google Classroom (para mostrar contenido y ejecutar el
   bloqueo por mora dando/quitando acceso al curso), y el "repositorio E-learning" de ZR App es
   en realidad una capa de presentación sobre Classroom, no un repositorio nuevo.

Ver detalle de la pregunta en `02_MODULO_FINANCIAMIENTO.md` sección 9 y en
`07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md`.

### 3.7 Pasarela de Pagos y Financiamiento ("Cashea style")
- Ver especificación completa en `02_MODULO_FINANCIAMIENTO.md`. Es el módulo de mayor riesgo
  financiero/legal del proyecto, se construye con reglas de negocio explícitas desde el día 1.

### 3.8 Inventario de Refrigerios
- **Decisión de diseño:** NO se construye como módulo NFC/QR separado. Se reutiliza el escaneo
  de asistencia del día como validación de "una porción por estudiante", reduciendo
  infraestructura duplicada.
- **Dimensionamiento confirmado:** ~100 refrigerios semanales (proxy usado también para
  estimar la matrícula activa semanal, ver `02_MODULO_FINANCIAMIENTO.md` sección 5.1).
- **Origen de fondos confirmado:** se reserva sistemáticamente el 30% del excedente del pago
  inicial de $60 del primer sábado de cada módulo 1 para financiar los refrigerios semanales
  — ver `02_MODULO_FINANCIAMIENTO.md` sección 10. Esto implica que el módulo de refrigerios,
  aunque operativamente es "solo un escaneo QR", tiene una dependencia contable real con el
  módulo de financiamiento que el esquema de datos debe reflejar.

### 3.9 Feedback y QA
- Micro-feedback por clase: **máximo 3 preguntas**, selección múltiple, se responde en menos
  de 20 segundos.
- Macro-feedback por módulo: formulario abierto, genera insignia digital (QR/PDF) vinculada al
  carnet.

### 3.10 Progreso y Dominio Visible (rediseñado — ver `03_MODULO_SOCIAL_VIDEO.md`)
> **Decisión de producto explícita, no arbitraria:** este módulo NO replica el modelo de rachas
> tipo Duolingo. La evidencia de retención de Duolingo (caída de churn mensual de 47% a 28%
> entre 2020 y 2023) se construyó sobre años de rediseño de producto explotando aversión a la
> pérdida en un público *voluntario y sin nada en juego*. El estudiante de ZR ya pagó matrícula,
> ya asiste presencialmente y tiene un objetivo laboral concreto — es una población cautiva con
> motivación intrínseca real (el oficio mismo), no una población que hay que enganchar con
> mecánicas de juego. Superponer un sistema de rachas ahí compite con esa motivación intrínseca
> en vez de reforzarla (ver meta-análisis en `06_FLUJOS_USUARIO_AGENTE.md`, sección de
> fundamento). El eje del módulo es **hacer visible el dominio técnico real**, no fabricar
> urgencia artificial.
- **Mapa de dominio por módulo:** cada módulo se descompone en sub-competencias verificables
  (ej. "diagnóstico de sistema de frenos"). El carnet digital muestra cuáles están dominadas,
  en progreso o pendientes — progreso real, no puntaje abstracto.
  **Confirmado:** estas sub-competencias no hay que inventarlas ni definirlas desde cero — ya
  existen como **Guías de Aprendizaje** físicas que la academia usa hoy (investigación previa
  entre semana + práctica de taller el sábado). El trabajo de Fase 0/1 es **digitalizar y
  estructurar** esas guías (13 módulos × su plan semanal) para poblar el mapa de dominio,
  validando objetivo por objetivo, sábado a sábado — no diseñar un mapa de competencias nuevo.
- **Video micro-learning de 30 segundos + pregunta corta**, curado por profesores/admin, ligado
  al módulo activo. Formato elegido porque coincide con el consumo nativo de contenido del
  rango 15-25 años (vertical, corto) — no porque imite un quiz diario de racha.
- **Insignias por dominio verificado**, no por constancia diaria: se otorgan al demostrar una
  sub-competencia (evaluación, corrección del profesor, o umbral de aciertos en micro-learning),
  y se acumulan visiblemente en el portafolio (ver 3.11).
- **Racha (streak) como mecánica secundaria y opcional**, nunca como KPI principal del módulo:
  puede existir como recordatorio suave de actividad, pero el éxito del módulo se mide por
  finalización de sub-competencias, no por días consecutivos de uso.
- Puntos redimibles como descuento real en el módulo de financiamiento (3.7) — el incentivo con
  peso real es económico, el cosmético es secundario.

### 3.11 Red Social Interna / Portafolio Profesional (Fase 3)
- Feed de contenido generado por estudiantes (UGC): videos de mecánica, autos, carreras, etc.
- Portafolio profesional público vía QR al finalizar el programa (certificación oficial).
- Requiere reglas de moderación explícitas dado que el público incluye menores de edad
  (15-17 años) — ver `03_MODULO_SOCIAL_VIDEO.md`, sección de seguridad y moderación.

## 4. PRINCIPIOS TÉCNICOS TRANSVERSALES
1. Arquitectura de base de datos relacional, escalable, con integridad referencial fuerte entre
   estudiantes, módulos, pagos y gamificación (ver `04_ESQUEMA_BASE_DATOS.md`).
2. Mobile-first real (no "responsive de escritorio"). Optimizado para uso con manos sucias/con
   guantes en taller: botones grandes, poco texto, iconografía clara.
3. Todo módulo con dinero (pagos, puntos redimibles) requiere tabla de auditoría inmutable
   (append-only log), nunca solo un campo de balance mutable.
4. Todo módulo con contenido generado por usuarios requiere cola de moderación antes de
   publicación pública, dado el público menor de edad.
5. Preferencia por backend-as-a-service (Supabase) + frontend low-code (FlutterFlow) en fases
   1 y 2 para velocidad; ver `01_STACK_TECNICO_LOWCODE.md` para justificación completa.


## 5. GLOSARIO RÁPIDO PARA EL AGENTE
- **Cuota / Installment:** pago parcial programado dentro de un plan de financiamiento.
- **Racha / Streak:** días consecutivos de actividad gamificada.
- **Insignia / Badge:** certificado visual (QR/PDF) por completar feedback o módulo.
- **UGC:** contenido generado por el usuario (videos subidos por estudiantes).
- **Micro-learning:** video corto (30s) + pregunta, reemplazo del "quiz diario" estilo Duolingo.
- **Guía de Aprendizaje:** documento curricular físico ya existente (por módulo/semana) que
  define investigación previa + práctica de taller; fuente real de las sub-competencias del
  mapa de dominio, no un concepto nuevo de producto.
- **Cash & Carry (niveles):** sistema de niveles de confianza de pago desde el módulo 2 en
  adelante (Nivel 1 = 60% inicial, Nivel 2 = 50%, Nivel 3 = 40%) — ver
  `02_MODULO_FINANCIAMIENTO.md`.
- **Certificación de notas:** constancia parcial descargable para estudiantes que se retiran
  antes de terminar el programa; distinta del certificado oficial final de Técnico Automotriz.

## 6. VER TAMBIÉN
- `04_ESQUEMA_BASE_DATOS.md` — esquema relacional derivado de las reglas confirmadas en este
  documento y en `02_MODULO_FINANCIAMIENTO.md`.
- `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md` — qué cambió respecto a la versión anterior de
  esta documentación, qué quedó confirmado y qué preguntas siguen abiertas.
