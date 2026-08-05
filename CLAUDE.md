# AGENTS.md — LEE ESTE ARCHIVO COMPLETO ANTES DE ESCRIBIR CÓDIGO

Eres un agente de código trabajando en **ZR App**, la plataforma de la academia técnica
ZR Mecademy. Este archivo es tu punto de entrada. Todo lo que necesitas está enlazado desde aquí.

**Si solo puedes recordar una cosa: no inventes nada.** Cada tabla, cada columna, cada ruta,
cada función y cada regla de negocio ya está definida literalmente en los archivos de `spec/` y
`supabase/migrations/`. Tu trabajo es **implementar lo que está escrito**, no diseñarlo. Si algo
no está especificado, la respuesta correcta es **detenerte y preguntar**, nunca improvisar.

---

## 1. QUÉ ESTÁS CONSTRUYENDO

Una aplicación web instalable (PWA) para una academia de mecánica automotriz en Venezuela.
Las clases son **los sábados**. Hay ~100 estudiantes activos, de 15 a 25 años.

**Fase 1 (lo único que se construye ahora):**
1. Registro e inicio de sesión con cédula.
2. Consentimiento parental obligatorio para estudiantes de 15 a 17 años (ley LOPNNA).
3. Carnet digital con código QR rotatorio.
4. Asistencia: **el profesor escanea el QR del estudiante** (no al revés).
5. Entrega de refrigerio marcada con el mismo escaneo.
6. Exámenes digitales con autocalificación.
7. Repositorio de material de estudio (PDFs).
8. Feedback corto por clase (3 preguntas).
9. Paneles de profesor y de administración.
10. **«Próximo sábado»**: qué debe preparar el estudiante para la clase que viene.
11. **«Mi progreso»**: qué competencias del módulo ya domina.

Los puntos **10 y 11 son los únicos que el estudiante gana para sí mismo**; todo lo demás
resuelve un dolor de la academia. Si hay que recortar, se recortan de últimos, no de primeros.

**Fecha de entrega: sábado 5 de septiembre de 2026.**

---

## 2. REGLAS ABSOLUTAS — VIOLARLAS ROMPE EL PROYECTO

Estas diez reglas no se negocian, no se optimizan y no se saltan "solo por esta vez".

1. **Nunca escribas una tabla sin su política de RLS.** Row Level Security va habilitada en el
   100% de las tablas. Una tabla sin política es una fuga de datos de menores de edad.
2. **Nunca calcules notas, aprobaciones ni validaciones de QR en el navegador.** Todo eso vive
   en Edge Functions del lado servidor. El cliente solo muestra resultados.
3. **Nunca envíes `exam_questions.correct_answer` al estudiante.** Usa siempre la vista
   `v_exam_questions_student`, que no tiene esa columna.
4. **Nunca uses la clave `service_role` en código de navegador.** Solo en Edge Functions y en
   rutas de servidor de Next.js.
5. **Nunca escribas un número de negocio en el código.** Umbrales, porcentajes y ventanas de
   tiempo se leen de la tabla `system_config`.
6. **Nunca edites una migración ya aplicada.** Crea una nueva con el número siguiente.
7. **Nunca implementes reprobación automática por inasistencia.** Está explícitamente prohibida
   por la academia. No existe un contador de faltas que dé de baja a nadie.
8. **Nunca implementes bloqueo de acceso físico a aulas o talleres.** Está prohibido por
   normativa del Ministerio de Educación. Ni siquiera como opción configurable.
9. **Nunca permitas que el rol de un usuario venga del cliente.** Todo el que se registra es
   `estudiante`. Los roles de personal los asigna un administrador desde el servidor.
10. **Nunca construyas nada de Fase 2 o Fase 3.** Ver la lista de prohibiciones en §7.

---

## 3. STACK — YA ESTÁ DECIDIDO, NO LO CAMBIES

| Capa | Herramienta | Versión |
|---|---|---|
| Frontend y paneles | Next.js (App Router) + TypeScript | 15+ |
| Estilos | Tailwind CSS | 4+ |
| Base de datos, auth, almacenamiento | Supabase (PostgreSQL) | — |
| Lógica de servidor | Supabase Edge Functions (Deno) | — |
| Lector de QR | `@zxing/browser` | — |
| Generador de QR | `qrcode` | — |
| Códigos rotatorios | `otpauth` (TOTP) | — |
| Pruebas | Vitest + Playwright | — |
| Despliegue | Vercel | — |

**No uses:** FlutterFlow, Retool, n8n, Firebase, Prisma, ni un ORM. Se escribe SQL directo y se
usa el cliente oficial `@supabase/supabase-js`.

---

## 4. ORDEN DE TRABAJO — NO TE SALTES PASOS

Ejecuta en este orden exacto. Cada paso depende del anterior.

| Orden | Qué hacer | Archivo que debes leer |
|---|---|---|
| 1 | Preparar entorno, crear proyecto, instalar dependencias | `spec/01_SETUP.md` |
| 2 | Aplicar las 14 migraciones SQL **sin modificarlas** | `supabase/migrations/` |
| 3 | Cargar datos de prueba | `supabase/seed/seed_dev.sql` |
| 4 | Generar los tipos de TypeScript desde la base | `spec/01_SETUP.md` §6 |
| 5 | Implementar las Edge Functions | `spec/03_EDGE_FUNCTIONS.md` |
| 6 | Implementar las pantallas, en el orden de las tareas | `spec/04_PANTALLAS.md` |
| 7 | Escribir y correr las pruebas | `spec/05_PRUEBAS.md` |

**Las tareas atómicas están en `tareas/`.** Cada una dice exactamente qué archivos crear, qué
debe hacer, y cómo se verifica que quedó bien. Ejecútalas en orden numérico: `T-001`, `T-002`, …
No empieces una tarea sin haber cumplido el criterio de verificación de la anterior.

---

## 5. MAPA DE ARCHIVOS

```
ZR App/
├── AGENTS.md                    ← estás aquí
├── CLAUDE.md                    ← copia de este archivo
│
├── COLABORACION.md              ← cómo trabajan juntos el equipo y tú
│
├── spec/                        ← LA ESPECIFICACIÓN. Es la verdad.
│   ├── 01_SETUP.md              ← comandos exactos para preparar todo
│   ├── 02_CONTRATOS.md          ← tipos de TypeScript y formas de datos
│   ├── 03_EDGE_FUNCTIONS.md     ← cada función con su entrada y salida exactas
│   ├── 04_PANTALLAS.md          ← cada ruta con sus campos y estados
│   ├── 05_PRUEBAS.md            ← qué probar y cómo
│   └── 06_IDENTIDAD_VISUAL.md   ← colores, tipografía, medidas, voz y tono
│
├── supabase/
│   ├── migrations/              ← 14 archivos SQL. COPIAR TAL CUAL, NO EDITAR.
│   └── seed/seed_dev.sql        ← datos de prueba
│
├── tareas/                      ← 6 archivos, uno por sprint, con tareas atómicas
│   ├── SPRINT_0.md … SPRINT_5.md
│
└── docs/                        ← contexto de negocio. Léelo si dudas del "por qué".
    ├── 00_CONTEXTO_MAESTRO_AGENTE.md      reglas de negocio de la academia
    ├── 08_AUDITORIA_TECNICA_Y_VIABILIDAD.md
    ├── 09_DECISIONES_ARQUITECTONICAS.md   por qué cada cosa es como es
    ├── 10_ESQUEMA_BASE_DATOS_V2.md        el esquema explicado en prosa
    ├── 11_PLAN_EJECUCION_FASE1.md         el cronograma
    └── 13_DISENO_DE_PRODUCTO_ESTUDIANTE.md  qué gana el estudiante y por qué
```

**Jerarquía cuando dos archivos se contradicen:**
`supabase/migrations/*.sql` gana sobre `spec/` gana sobre `docs/`.
Los documentos `01_` y `04_` de `docs/` están **superados** — describen un stack (FlutterFlow) y
un esquema que ya no se usan. No los sigas.

---

## 6. LOS CUATRO ROLES

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| `estudiante` | El alumno | Ver su carnet, mostrar su QR, presentar exámenes, ver contenido y sus notas, dar feedback |
| `profesor` | El docente | Abrir sesiones, escanear asistencia, crear y calificar exámenes, subir contenido, ver feedback agregado |
| `admin` | Administración | Todo lo de profesor + gestionar estudiantes, cohortes, consentimientos y reportes |
| `super_admin` | Dirección académica | Todo + editar `system_config` |

**Concepto clave que debes entender:** un estudiante pertenece a una **cohorte** (un grupo).
La cohorte cursa un módulo a la vez. Una **sesión de clase** es un sábado concreto de una
cohorte. La asistencia se registra contra una sesión, nunca contra una fecha suelta.

---

## 7. LO QUE ESTÁ PROHIBIDO CONSTRUIR

Si el usuario te pide algo de esta lista, respóndele que pertenece a otra fase y no lo construyas:

- Cualquier pantalla de **pagos, cuotas, saldos, estado de cuenta o financiamiento** → Fase 2.
- **Video micro-learning**, **puntos**, canjes, insignias, rachas → Fase 2.
  ⚠️ El **mapa de dominio SÍ entra en Fase 1** (tareas T-413 a T-417), pero **solo el estado
  de cada competencia**: dominada, en progreso o pendiente. Sin puntos, sin niveles, sin
  insignias y sin comparación entre estudiantes.
- **Contabilidad del fondo de refrigerios** → Fase 2.
- **Red social, subida de videos por estudiantes, comentarios, portafolio público** → Fase 3.
- **Simulador visual, roles de especialización, certificados** → Fase 3.
- **Integración con Google Classroom** → descartada, no se hace nunca.
- **Aplicación nativa o publicación en App Store / Play Store** → descartada en Fase 1.
- **Mensajería privada entre usuarios** → prohibida por seguridad de menores.

Las tablas de Fase 2 y 3 **no se crean todavía**. No las agregues "por si acaso".

---

## 8. CÓMO SABER SI VAS BIEN

Antes de dar por terminada cualquier tarea, las siete condiciones:

1. El código compila y `npm run typecheck` pasa sin errores.
2. Si tocaste la base, la migración está en `supabase/migrations/` con número nuevo.
3. Si creaste una tabla, tiene RLS habilitada y políticas escritas.
4. `npm run test:rls` pasa (el estudiante A no puede leer datos del estudiante B).
5. `npm run test` pasa.
6. Probaste el camino feliz **y** el camino de error.
7. Funciona en una pantalla de teléfono (360 px de ancho), no solo en escritorio.

Comando único que verifica todo:
```bash
npm run verify
```

---

## 9. CONTEXTO QUE EVITA ERRORES DE DISEÑO

Cosas que parecen decisiones libres pero no lo son:

- **El profesor escanea al estudiante, nunca al revés.** Si lo haces al revés, un alumno
  fotografía el QR y lo manda por WhatsApp a un compañero ausente. Además así solo un teléfono
  necesita señal, y en los talleres la señal es mala.
- **El escaneo debe funcionar sin internet.** Se guarda en el teléfono y se sincroniza después.
  La sincronización debe ser idempotente: mandar el mismo escaneo dos veces no crea dos
  asistencias.
- **El profesor nunca ve el feedback individual de un estudiante**, solo el promedio del grupo,
  y solo si hay 3 o más respuestas. Si viera quién dijo qué, nadie diría la verdad.
- **La app se usa de pie, en un taller, con las manos sucias.** Botones grandes, mucho
  contraste, poco texto, todo alcanzable con un pulgar.
- **La interfaz va en español de Venezuela.** Los nombres de tablas y código en inglés; los
  valores de los enums y todo lo que ve el usuario, en español.

---

## 10. SI TE ATASCAS

1. Busca el tema en `spec/`. Ahí está el 95% de las respuestas.
2. Si es una pregunta de "por qué", busca en `docs/09_DECISIONES_ARQUITECTONICAS.md`.
3. Si es una regla de la academia, busca en `docs/00_CONTEXTO_MAESTRO_AGENTE.md`.
4. Si de verdad no está escrito en ningún lado: **detente y pregunta.** No adivines. Una
   decisión inventada cuesta días de retrabajo; una pregunta cuesta cinco minutos.
