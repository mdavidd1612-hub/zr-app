# CONTEXTO ACTUAL · ZR APP

> **Documento de traspaso.** Escrito el **sábado 1 de agosto de 2026**.
> Sirve para que cualquier persona o agente de código retome el trabajo sin releer los
> 7.500 renglones de documentación del repositorio.
>
> Si eres un agente de código y solo vas a leer un archivo antes de tocar código, **lee
> `AGENTS.md` completo**, no este. Este te dice *dónde vamos*; `AGENTS.md` te dice *qué está
> prohibido hacer*.

---

## 1. QUÉ ES ESTO EN UN PÁRRAFO

Aplicación web instalable (PWA) de gestión académica para **ZR Mecademy**, una academia técnica
de mecánica automotriz en Venezuela. Clases **los sábados**, ~100 estudiantes de 15 a 25 años,
programa de 13 módulos en 13 meses. Como hay estudiantes menores de edad, aplica la **LOPNNA**:
consentimiento parental obligatorio y protección estricta de datos personales.

**Fecha de entrega de Fase 1: sábado 5 de septiembre de 2026.**

---

## 2. CÓMO ESTÁ ORGANIZADA LA DOCUMENTACIÓN

**Jerarquía cuando dos archivos se contradicen:**
`supabase/migrations/*.sql` › `spec/` › `docs/`

| Carpeta | Qué contiene | Cuándo se lee |
|---|---|---|
| `AGENTS.md` · `CLAUDE.md` | Las 10 reglas absolutas y el orden de trabajo. Son copias idénticas | **Antes de escribir una línea** |
| `COLABORACION.md` | Cómo trabaja el equipo: ramas, PR, ritmo semanal | El primer día |
| `spec/` | **La especificación. Es la verdad.** 6 archivos | Todos los días |
| `supabase/migrations/` | 14 archivos SQL. **No se editan jamás** | Al tocar la base |
| `tareas/SPRINT_0..5.md` | 86 tareas atómicas, T-001 a T-515 | Al tomar una tarea |
| `docs/` | Contexto de negocio y decisiones. El «por qué» | Cuando dudas de una decisión |
| `marca/` | Logos oficiales y referencia visual | Al hacer pantallas |

### Los 6 archivos de `spec/`
- `01_SETUP.md` — comandos exactos para montar el entorno
- `02_CONTRATOS.md` — tipos de TypeScript, formato del QR, catálogo de errores
- `03_EDGE_FUNCTIONS.md` — las 7 funciones de servidor, con entrada y salida exactas
- `04_PANTALLAS.md` — cada ruta con sus campos y estados
- `05_PRUEBAS.md` — qué probar y cómo
- `06_IDENTIDAD_VISUAL.md` — paleta, tipografías, uso del logo

### Documentos superados — NO los sigas
`docs/01_STACK_TECNICO_LOWCODE.md` y `docs/04_ESQUEMA_BASE_DATOS.md` describen un stack
(FlutterFlow) y un esquema que **ya no se usan**. Llevan el aviso al inicio.

---

## 3. LA ARQUITECTURA EN UNA IDEA

**Las reglas de negocio viven en PostgreSQL, no en el código.** Esto es deliberado y es lo mejor
del proyecto: la aplicación no puede violarlas aunque el programador se equivoque.

- `handle_new_user()` **fuerza** `role = 'estudiante'`. Aunque el navegador mande
  `role: super_admin`, la base lo ignora. Por eso existe la Edge Function `create-staff-user`.
- `audit_log` es de **solo inserción** por disparador. UPDATE y DELETE lanzan excepción.
- Un menor sin consentimiento **no puede** completar el registro. Lo rechaza la base.
- El estudiante **no puede** marcarse competencias como dominadas: no tiene política de INSERT.
- La respuesta correcta de un examen nunca sale al navegador: se usa la vista
  `v_exam_questions_student`, que no tiene esa columna.

**Consecuencia práctica:** casi todo el trabajo restante es construir pantallas y Edge Functions
contra un esquema **ya diseñado y cerrado**. No hay que diseñar modelo de datos.

### Stack
Next.js 16 (App Router) + TypeScript · Supabase (Postgres, Auth, Storage, Edge Functions) ·
Tailwind 4 · PWA · Vercel · Vitest + Playwright.
**No se usa:** FlutterFlow, Retool, n8n, Firebase, ni ningún ORM.

---

## 4. DÓNDE VAMOS — ESTADO AL 1 DE AGOSTO DE 2026

### Fase
**Fase 1** (la única que se construye). Fases 2 y 3 están **prohibidas**: nada de pagos,
gamificación, video, red social ni certificados. Ver `AGENTS.md` §7.

### Sprint
**Sprint 0 cerrado en su parte técnica. Sprint 1 en curso.**

```
SPRINT 0 · FUNDACIONES        30 jul → 2 ago   ██████████████████░░░░░░  10/13
SPRINT 1 · CARNET             3 → 9 ago        ████░░░░░░░░░░░░░░░░░░░░   3/15  ← AQUÍ
SPRINT 2 · ASISTENCIA         10 → 16 ago      ░░░░░░░░░░░░░░░░░░░░░░░░   0/13
SPRINT 3 · EVALUACIONES       17 → 23 ago      ░░░░░░░░░░░░░░░░░░░░░░░░   0/13
SPRINT 4 · CONTENIDO          24 → 30 ago      ░░░░░░░░░░░░░░░░░░░░░░░░   0/17
SPRINT 5 · ENTREGA            31 ago → 5 sep    ░░░░░░░░░░░░░░░░░░░░░░░░   0/15
```

> **Para ver el estado real y actualizado en cualquier momento:**
> ```
> npm run estado
> ```
> Lee `tareas/SPRINT_*.md`, comprueba qué archivos existen y dice qué toca. Deja una copia en
> `ESTADO.md`. Las tareas que no crean archivos se marcan a mano en `tareas/COMPLETADAS.txt`.
>
> **Un archivo escrito no es un archivo correcto.** Eso lo dice `npm run verify`.

### Ojo con el calendario
Vamos **con retraso respecto al plan**: el Sprint 0 debía cerrar el 2 de agosto incluyendo
producción desplegada y respaldos probados, y eso todavía no está. No es catástrofe —la base de
datos, que era lo caro, ya está lista— pero conviene decirlo en la reunión del lunes en vez de
que se descubra el 15 de agosto.

---

## 5. QUÉ ESTÁ HECHO

### Entorno — funcionando al 100%
- Node 24.18 · Docker Desktop 29.6.2 · **WSL2 2.7.11** (era el bloqueo real) · Supabase CLI 2.111
- Los 12 contenedores de Supabase local **corriendo**
- `.env.local` con las claves locales (son las de demo, públicas, no son secretos)

### Sprint 0 — T-001 a T-010 ✅
| Tarea | Estado |
|---|---|
| T-001 Entorno | Next 16 + Tailwind 4 + todas las dependencias de la spec |
| T-002 Migraciones | Las 14 en su sitio + `supabase/seed.sql` |
| T-003 Esquema | `db reset` aplica las 14 sin un solo error |
| T-004 RLS | **Cero tablas sin RLS.** La única sin política es `student_qr_secrets`, que es lo correcto |
| T-005 Datos | **13 módulos · 12 estudiantes · 4 menores · 2 bloqueados · 18 sesiones · 12 inscripciones · umbrales 10 y 12.** Todo exacto |
| T-006 Tipos | `lib/database.types.ts`, 2.088 líneas generadas |
| T-007 Clientes | `lib/supabase/{client,server,admin}.ts` |
| T-008 Contratos | `lib/{types,validators,auth-helpers,auth-server}.ts` |
| T-009 Pruebas RLS | **Las 15 pruebas de acceso cruzado pasan** |
| T-010 CI | `ci.yml` rescatado de una ruta corrupta |

### Sprint 1 — T-101, T-102, T-103 ✅
- **T-101** `middleware.ts` — protección por rol + puerta LOPNNA (un menor sin consentimiento no
  llega al carnet ni escribiendo la URL a mano)
- **T-102** `app/globals.css` con la paleta oficial + 6 componentes en `components/ui/`
  (`Boton`, `Campo`, `Tarjeta`, `Aviso`, `Cargando`, `EstadoVacio`).
  Fuentes Roboto y Raleway **servidas localmente**, nunca desde Google Fonts: el carnet debe
  dibujarse con el teléfono en modo avión
- **T-103** `app/login/page.tsx` — probado con los cuatro roles del seed, los cuatro entran
- **T-104** Registro: `app/registro/page.tsx` + `/api/auth/register`. Si menor → consentimiento
- **T-105** Consentimiento: `app/registro/consentimiento/page.tsx` + `/api/auth/consent`. 
  Inserta en `parental_consents` y actualiza `onboarding_status = 'completo'`
- **T-106** `provision-qr`: Edge Function que genera y entrega secreto TOTP (20 bytes base32)
- **T-107** `lib/qr-secret.ts`: almacenamiento en IndexedDB (no localStorage). Save/get/delete
- **T-108** Carnet de estudiante: `app/(estudiante)/carnet/page.tsx` con QR rotatorio cada 30s,
  próximo sábado, mi progreso, contador de módulos. **Funciona sin internet** (lee de IndexedDB)
- **T-109** Recuperar contraseña: `app/recuperar/page.tsx`. Envía enlace al `contact_email` real
- **T-110** PWA: `app/manifest.ts` + `public/sw.js` + Service Worker Hook. Instalable, offline-first

**`npm run verify` pasa completo** (typecheck + lint + pruebas + pruebas RLS).

## 🎯 NÚCLEO DE ESTUDIANTE: TERMINADO

El flujo completo del estudiante está funcional:
1. **Registro** (T-104): Cédula, edad, email, contraseña
2. **Consentimiento** (T-105): Para menores de 18 años, LOPNNA obligatorio
3. **Carnet** (T-108): QR rotatorio, próximo sábado, progreso
4. **Offline** (T-110): Funciona sin conexión, se sincroniza después
5. **Recuperar** (T-109): Si olvidó contraseña

Falta: Navegación de profesor, panel admin, pruebas e2e (T-111 a T-115).

---

## 6. QUÉ FALTA — EN ORDEN

### Lo siguiente, ahora mismo (Sprint 1)
| Tarea | Estado | Archivo | Nota |
|---|---|---|---|
| **T-104** Registro | ✅ | `app/registro/page.tsx` + `/api/auth/register` | Calcular edad; menor → consentimiento |
| **T-105** Consentimiento | ✅ | `app/registro/consentimiento/page.tsx` + API | LOPNNA: inserta en `parental_consents` |
| **T-106** `provision-qr` | ✅ | `supabase/functions/provision-qr/index.ts` | Genera y guarda secreto TOTP |
| **T-107** Guardar secreto | ✅ | `lib/qr-secret.ts` | IndexedDB, **no** localStorage |
| **T-108** Carnet | ✅ | `app/(estudiante)/carnet/page.tsx` | QR rotatorio, próximo sábado, progreso, **sin internet** |
| **T-109** Recuperar contraseña | ⏳ | `app/recuperar/page.tsx` | Al `contact_email` real, no al sintético |
| **T-110** PWA | ⏳ | `app/manifest.ts`, `public/sw.js` | |
| **T-111** Navegación estudiante | ⏳ | `app/(estudiante)/layout.tsx` | 4 botones de 56 px mínimo |
| **T-112** `create-staff-user` | ⏳ | Edge Function | Solo un super_admin crea otro super_admin |
| **T-113** Panel admin | ⏳ | `app/(admin)/…` | Carga CSV: todo o nada |
| **T-114** Cola de consentimientos | ⏳ | `app/(admin)/consentimientos/page.tsx` | Con el seed deben salir 2 |
| **T-115** Pruebas e2e | ⏳ | `tests/e2e/registro-*.spec.ts` | |

### Sprint 0, lo que queda (necesita cuentas del dueño)
- **T-011** Buckets `contenido` y `consentimientos`, **ambos privados**
- **T-012** Proyecto `zr-prod` en Supabase + Vercel + respaldos diarios
- **T-013** Probar una restauración de respaldo **cronometrada** y escribir `docs/OPERACION.md`

---

## 7. ⚠️ DEFECTOS DE LA ESPECIFICACIÓN YA CORREGIDOS

**Léelos antes de tocar nada.** Los seis se encontraron ejecutando, no leyendo, y los seis
volverán a aparecer si alguien restaura los archivos originales.

| # | Qué estaba mal | Por qué importaba |
|---|---|---|
| 1 | `ci.yml` commiteado en la ruta literal `C:\Users\Administrador\Downloads/.github/workflows/ci.yml` | GitHub Actions **nunca lo ejecutó**; la protección de rama no bloqueaba nada. Además `git clone` **fallaba en Windows** |
| 2 | Cuatro archivos decían «13 migraciones (001 a 013)» | Son **14**. `seed_dev.sql` inserta en `mastery_map`, que solo existe en `014_`. Copiando 13, `db reset` revienta |
| 3 | `seed_dev.sql` dejaba en NULL 8 columnas de token de `auth.users` | GoTrue las lee como texto no anulable → **todo login devolvía 500**. Ningún usuario de prueba podía entrar. Probado en ambos sentidos |
| 4 | La prueba «no puede escribir sus propias notas» esperaba un error | Cuando RLS bloquea un UPDATE, PostgREST devuelve **éxito con cero filas**, no error. **RLS nunca falló**: nota antes 11,00 → el estudiante intenta 20 → después 11,00. La prueba estaba mal escrita. **Peligroso**: al verla en rojo, lo natural es aflojar RLS para que lance el error, y *ahí sí* habría un hueco real |
| 5 | `spec/02` ponía `cedulaAEmail()` y `getSessionProfile()` en el mismo archivo | No compila: el primero lo usa el navegador, el segundo usa `next/headers`. Separados en `auth-helpers.ts` y `auth-server.ts` |
| 6 | `spec/01` decía `"lint": "next lint"` | Ese comando **no existe en Next.js 16**. Es `eslint` a secas |

### Además, sin resolver todavía
- **`npm audit` reporta 3 fallos altos** (`postcss` y `sharp`), los tres dentro de Next.js.
  **NUNCA corras `npm audit fix --force`**: instalaría `next@9.3.3` y destruiría el proyecto.
  Detalle completo en **`docs/SEGURIDAD.md`**.
- **Next 16 marcó `middleware.ts` como obsoleto** en favor de `proxy.ts`. Funciona, pero hay que
  decidirlo antes de la entrega.
- **`spec/04` y `spec/06` tienen la codificación dañada** (94 y 23 líneas). Las tablas se leen,
  los diagramas ASCII no.
- **`spec/04` §6** usa `#F8FAFC` y `#1E3A5F` en el manifiesto de la PWA, que **contradicen** la
  paleta oficial del mismo archivo (`#F5F7FB` y `#21284F`). Manda `spec/06`.

---

## 8. ESTADO DE GIT — IMPORTANTE

- **Rama:** `tarea/T-001-entorno-y-tablero`
- **5 commits hechos, NINGUNO subido todavía**
- Copia de seguridad en la rama `respaldo-antes-de-reescribir`
- Identidad: `mtprojects1612-arch <307628638+mtprojects1612-arch@users.noreply.github.com>`

```
0e3a854  T-101/T-103: middleware de rutas y pantalla de inicio de sesion
7be83e6  T-003..T-009: base de datos aplicada, tipos generados y RLS en verde
29bb0d9  docs: registrar estado de seguridad y vulnerabilidades conocidas
0cb503e  T-001: montar el entorno de Next.js y el tablero de estado
e242d2b  T-010: mover ci.yml a .github/workflows/
```

### El push está pendiente
Requiere el permiso `workflow` porque uno de los commits toca `.github/workflows/ci.yml`.
La sesión de `gh` del usuario ya lo tiene; hay que lanzarlo desde **su** terminal:

```
git push -u origin tarea/T-001-entorno-y-tablero
```

Colaboradores del repo: `guayamuripm-boop` (dueño), `mdavidd1612-hub`, `mtprojects1612-arch`.

---

## 9. LO QUE DEPENDE DEL DUEÑO, NO DEL CÓDIGO

| Prioridad | Qué | Límite |
|---|---|---|
| 🔴 | **Medir la línea base en la sede**: cuánto tarda pasar lista en papel, y censar las cohortes reales | **Vencía el 1 de agosto** |
| 🟠 | Subir la rama | Ya |
| 🟡 | Crear `zr-prod` en Supabase y el proyecto en Vercel | Esta semana |
| 🟢 | Averiguar si la academia ya tiene `zrmecademy.com` (entonces `app.zrmecademy.com` sale gratis) | Antes de comprar nada |
| 🔴 | **Política de privacidad, términos de uso y consentimiento parental** | **14 de agosto** |

> **Los tres documentos legales son bloqueantes de verdad.** Sin ellos la app no puede salir a
> producción con estudiantes reales el 5 de septiembre, por bien que funcione: maneja datos de
> menores bajo LOPNNA y pide permiso de cámara.

> **Sin la línea base**, el criterio de éxito del piloto del 15 de agosto («menos tiempo que la
> línea base del 1 de agosto») y el criterio de salida de toda la Fase 1 son **inevaluables**.

---

## 10. CÓMO RETOMAR EL TRABAJO

```
supabase start          # si la base local está apagada
npm run estado          # dónde vamos y qué toca
npm run dev             # http://localhost:3000
npm run verify          # ANTES de dar por terminada cualquier tarea
```

**Usuarios de prueba**, todos con la contraseña `Prueba123!`:

| Cédula | Rol | Va a |
|---|---|---|
| `V-30000001` | estudiante | `/carnet` |
| `V-10000003` | profesor | `/hoy` |
| `V-10000002` | admin | `/panel` |
| `V-10000001` | super_admin | `/panel` |

**Panel de Supabase local:** http://127.0.0.1:54323
**Correos de prueba (Mailpit):** http://127.0.0.1:54324

### Las reglas que no se rompen
1. Ninguna tabla sin RLS y sin su prueba de acceso cruzado.
2. Nada de calcular notas ni validar QR en el navegador. Eso vive en Edge Functions.
3. Ningún número de negocio escrito en el código: va en `system_config`.
4. Nunca editar una migración ya aplicada; se crea una nueva.
5. El rol nunca viene del cliente.
6. Nadie sube directo a `main`. Nadie despliega en viernes.
7. **Si las pruebas de RLS fallan, no se publica.** Sin excepción: es una fuga de datos de
   menores de edad.

**Si algo no está escrito en `spec/`: detente y pregunta. No lo inventes.**
