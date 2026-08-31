# 17 — Plan consolidado: currículo real + spec del coordinador

> Junta dos cosas: (A) la migración de cohortes/programas/módulos reales que
> ya habíamos acordado, y (B) lo que aporta
> `especificacion-funcional-zrm-academy.md` que SÍ tiene sentido meter antes
> del 5 de septiembre. Lo que no, queda explícitamente fuera y explico por
> qué. Nada de esto se ejecuta todavía — es el plan para que lo apruebes.

---

## 0. Primero, lo importante: qué de la spec del coordinador NO vamos a hacer ahora

La spec del coordinador describe un sistema más grande del que se está
construyendo para el 5 de septiembre (Fase 0). Antes de mezclar todo, separo
lo que es **infraestructura/alcance de otro proyecto** de lo que sí aplica:

| Del documento del coordinador | Por qué NO ahora |
|---|---|
| **Migrar todo a un VPS de Hostinger** (§16) | Ya está resuelto y funcionando: Vercel (frontend) + Supabase (base de datos, auth, storage, Edge Functions). Eso YA da CDN, backups, SSL, escalado gestionado — todo lo que la sección 16 recomienda "armar a mano" en un VPS, aquí ya viene incluido. Migrar de stack a dos semanas de la entrega sería reemplazar algo que funciona por algo que hay que operar a mano. Recomiendo **no migrar**, y si en el futuro hace falta reducir costo, se evalúa aparte — no es un bloqueante de producto. |
| **Integración con Odoo** (§12) | Requiere credenciales de Odoo, mapeo de campos y probablemente semanas de integración. No es necesario para que la app funcione el 5 de septiembre. Se puede agregar después como una sincronización aparte, sin tocar el resto. |
| ~~Rol "Vendedor"~~ | **Confirmado que SÍ se hace** — ver Sprint 5 abajo, ya no está fuera de alcance. |
| ~~Documento firmable en PDF + código `PTMA-XXXX-XX-XXX`~~ | **Confirmado que SÍ se hace** — ver Sprints 4 y 7 abajo, ya no está fuera de alcance. |
| **Classroom con carpetas jerárquicas + visor de video** | Nuestro "Material" ya cubre PDF con visor/descarga por módulo, que es lo esencial para el 5 de septiembre. Carpetas anidadas y video son una ampliación de la misma función, no algo urgente. |
| **2FA para administradores, DRM/watermark de video** (§19) | Endurecimiento de seguridad válido, pero no bloquea la demo. Se agenda para después del lanzamiento. |
| **Cola de trabajos (background jobs) para la IA** (§18) | Ahora mismo generamos casos uno a la vez y ya es rápido (~15s) gracias al ajuste de modelo que hicimos. Si más adelante hay muchos profesores generando al mismo tiempo, se agrega una cola — no hace falta hoy con 7 cohortes. |

Todo lo anterior queda anotado como **Fase 2**, igual que ya se venía haciendo
con exámenes/notas en este proyecto — no se pierde, se pospone a propósito.

---

## 1. Lo que SÍ se integra ahora — currículo y estructura real

(Esto ya lo habíamos acordado, lo dejo aquí como Sprint 1 del plan
consolidado.)

### Sprint 1 — Programas, sedes, módulos y cohortes reales
- Dos programas separados: **PTMA** (San Antonio) y **PFTA** (UCV), cada uno
  con sus 14 módulos (12 + 2 complementarios), solo nombre por ahora.
- Campo de **sede** propio en `cohorts` (hoy solo existe `location`, que se
  usa para el salón — se separan los dos conceptos).
- Las 7 cohortes reales, con su sede, turno (mañana 9:00 am / tarde 2:00 pm)
  y módulo actual, según la tabla que ya armamos:

| Cohorte | Sede | Turno | Módulo actual |
|---|---|---|---|
| PTMA-2025-I | San Antonio | Mañana | Finalizada — pendiente entrega certificada |
| PTMA-2025-II | San Antonio | Tarde | X · Aire acondicionado automotriz |
| PTMA-2026-I | San Antonio | Tarde | V · Sistemas de transmisión |
| PTMA-2026-II | San Antonio | Mañana | I · Fundamentos del automóvil (arranca 5 sept) |
| PFTA-2025-I | UCV | Mañana | XI → X (transición) |
| PFTA-2026-I (turno mañana) | UCV | Mañana | III · Fluidos automotrices |
| PFTA-2026-I (turno tarde) | UCV | Tarde | III · Fluidos automotrices |

- Los estudiantes de prueba (Pablo, etc.) se reasignan a una cohorte real
  (ej. PTMA-2026-I) para seguir probando QR/casos/dudas con datos de verdad.
- **Efecto en cascada, gratis**: Casos por IA, Material, "Mi módulo",
  asistencia — todo ya lee el nombre del módulo desde la base, así que en
  cuanto esto esté cargado, todo empieza a hablar de "Fluidos automotrices"
  en vez de nombres de relleno, sin tocar código de esas pantallas.

---

## 2. Lo que SÍ vale la pena sumar de la spec del coordinador, antes del 5 de sept

### Sprint 2 — Malla curricular visible (Módulo 7 de la spec)
- Pantalla nueva (estudiante, y accesible desde admin) que muestra los 14
  módulos del programa de esa cohorte, en orden, con el módulo actual
  resaltado. Es una vista de solo lectura sobre datos que ya vamos a tener
  del Sprint 1 — bajo esfuerzo, alto valor: responde directo a "¿qué me
  falta para graduarme?".

### Sprint 3 — Consentimiento general de términos (parte de la §20 de la spec)
- Ya existe el consentimiento parental para menores (LOPNNA). Lo que falta
  es una casilla general de "Acepto los Términos y Condiciones" al
  registrarse — todos los usuarios, no solo menores. Es una casilla +
  guardar versión/fecha/IP, reutilizando el patrón que ya existe para el
  consentimiento parental. El **texto legal en sí** no lo escribo yo — eso
  lo definen ustedes o un abogado; yo dejo el mecanismo listo para
  recibirlo.

### Sprint 4 — Código de estudiante: nuevo formato `PTMA/PFTA-2026-XX-XXX`
- **Decidido**: se cambia el formato del código del carnet, del actual
  `ZR-2026-XXX` al del coordinador — prefijo de sede (`PTMA`/`PFTA`) + año +
  número de cohorte (2 dígitos) + correlativo/cédula (3 dígitos).
- Se sigue generando en el servidor (migración 039 es donde vive hoy esa
  lógica) — nunca en el cliente. Depende del Sprint 1 (necesita saber sede
  y número de cohorte de cada estudiante).

### Sprint 5 — Rol "Vendedor" + pantalla "Carga de ventas"
- **Decidido**: se crea un rol nuevo `vendedor`, separado de
  admin/profesor/estudiante, con una pantalla propia y limitada — solo
  puede inscribir estudiantes nuevos, no ve notas, asistencia ni
  configuración de nadie más.
- Se agrega `'vendedor'` al enum `user_role` (migración 001) vía migración
  nueva, con sus propias políticas RLS de solo-inserción sobre
  `students`/`enrollments`.

### Sprint 6 — Formulario digital del primer login (13 preguntas)
- **Decidido**: listo para el 5 de septiembre, y **100% digital** — nunca
  en papel. El estudiante (o el Vendedor, si lo carga por él) lo completa
  la primera vez que entra a la app.
- Cubre nacionalidad, estado civil, condición laboral, salud, escolaridad,
  etc. (sección 5.3 de la spec del coordinador), con sus reglas
  condicionales (ej. solo pregunta detalles de trabajo si contestó que sí
  trabaja).

### Sprint 7 — Planilla firmable en PDF (autocompletada)
- **Decidido**: sigue haciendo falta, PERO ya no como formulario que se
  llena a mano — se genera **automáticamente en PDF**, pre-llenado con los
  datos que ya se cargaron en los Sprints 5 y 6 (inscripción + las 13
  preguntas) más el texto de términos/políticas institucionales.
- El estudiante (o su representante, si es menor) solo la firma
  **físicamente, en la academia**, al llegar — el sistema no le pide nada
  que ya haya contestado antes.

---

## 3. Orden recomendado de ejecución

1. **Sprint 1** (currículo/sedes/cohortes reales) — primero, todo lo demás
   depende de tener programas, sedes y cohortes de verdad.
2. **Sprint 4** (nuevo formato de código) — justo después, usa datos del
   Sprint 1.
3. **Sprint 2** (malla curricular) y **Sprint 5** (rol Vendedor) — en
   paralelo, son independientes entre sí.
4. **Sprint 3** (consentimiento general) y **Sprint 6** (formulario de 13
   preguntas) — el 6 es el más grande de todos.
5. **Sprint 7** (PDF firmable) al final — necesita que ya existan los datos
   de inscripción y del formulario para poder autocompletarse.

Con esto ya no quedan preguntas pendientes — todo lo de la tabla de la
sección 0 sigue fuera de alcance (VPS, Odoo, Classroom con video, 2FA, cola
de IA), y todo lo de arriba está confirmado. Dime si arranco con el
Sprint 1 ahora, o si prefieres reordenar algo.
