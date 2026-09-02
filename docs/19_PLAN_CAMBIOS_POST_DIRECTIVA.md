# 19 · Plan de ejecución — cambios pedidos por la directiva (reunión 01/09/2026)

> **Origen**: dos documentos del cliente, redactados a partir de la reunión con la directiva
> académica tras la primera demostración:
> - `plan-ejecucion-sistema-inscripciones.md` (raíz del repo) — inscripciones.
> - `docs/roles-y-permisos-sistema-inscripciones.md` — separación de roles administrativos.
>
> **Qué agrega este documento**: esos archivos dicen *qué pidió el cliente*. Este dice *qué hay
> realmente en el código y en la base de datos de producción*, cuál de esos pedidos ya está hecho,
> cuáles están mal diagnosticados, **qué se rompió y nadie vio**, y en qué orden se ejecuta todo.
>
> **Auditoría hecha el 2 de septiembre de 2026** contra el código en `main` (commit `b14b049`) y
> contra el proyecto Supabase `zr-prod` (`hagbqhnittynxebdssua`), consultado en vivo.
>
> Complementa —no reemplaza— a `docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md`. Lo de allá sigue vigente.

---

## 0. Resumen en diez líneas

De los 15 puntos del documento de la reunión: **4 ya están construidos** y nadie lo notó en la
demo, **3 están mal diagnosticados** (el síntoma que vio la directiva no tiene la causa que se
supuso), **6 son trabajo real** y **2 son backlog**.

Y hay un **hallazgo nuevo, más grave que todo lo que se reportó en la reunión**: hoy, cualquier
cohorte creada desde la app nace incompleta, y **todo estudiante inscrito en ella recibe un código
de carnet inválido que además es su contraseña**. Nadie lo detectó porque las 7 cohortes que
existen se crearon por migración, no por la pantalla. En el momento en que Érica cree el corte
nuevo y empiece a inscribir, se rompe la inscripción entera. Eso es la Fase 0.

**Sobre el segundo documento (roles y permisos)**: la directiva detectó bien el síntoma —
Dirección Académica y Superadmin se solapan— pero el solapamiento **no es de interfaz, está
incrustado en la base de datos**: una sola función, `is_admin_up()`, mete a `admin`,
`super_admin` y `direccion_academica` en la misma bolsa, y de ella dependen **28 políticas de
RLS**. Hoy, a efectos de permisos reales, los tres roles son **exactamente el mismo rol**. Eso es
la Fase 1.5, y arrastra un hallazgo de seguridad que hay que atender esta semana (§2.5).

---

## 1. Diagnóstico punto por punto

Cada fila cruza lo que pidió la reunión contra lo que hay en el código. **La columna "estado" es
lo que cambia el plan** — no repitas trabajo hecho.

| § de la reunión | Pedido | Estado real | Detalle |
|---|---|---|---|
| 3.1 | Login cédula + contraseña | ✅ **Hecho** | `app/login/page.tsx`. La contraseña inicial es el código de carnet. |
| 3.1 | Contraseña inicial autogenerada | ✅ **Hecho** | `create-student` la fija al código que genera el trigger del servidor. |
| 3.1 | APK descargable | ❌ **Falta** | Hoy es PWA instalable (commit `425c322`). Ver §4 y Fase 4. |
| 3.1 | Igual en móvil y escritorio | ✅ **Hecho** | `Marco` responsive (commit `fdd010f`). |
| 3.1 | Contradicción "¿depende de Odoo?" | 🟢 **Resuelta, ver §3.1** | Cero líneas de Odoo en el repo. La app no depende de Odoo en absoluto. |
| 3.2 | Formulario de inscripción | ✅ **Hecho** | `app/(vendedor)/carga-ventas/page.tsx`, con los 8 campos del representante. |
| 3.2 | Nombre completo sin abreviar | 🟡 **Parcial** | Solo valida que no esté vacío. Falta la regla real. → **R-10** |
| 3.2 | Teléfono: ¿opcional o 2 mínimo? | ⛔ **Decisión pendiente** | Hoy: uno solo, opcional. Ver §3.2. → **R-11** |
| 3.3 | Dropdown muestra programas de 2025 | 🔴 **Confirmado, causa distinta** | No es el año: es `status`. Ver §2.3. → **R-12** |
| 3.4 | Bug del correlativo (`04` en vez de `03`) | 🔴 **Confirmado, causa distinta** | No hay "lógica de generación" que arreglar: **no existe generación**. Ver §2.2. → **R-01** |
| 3.5 | Pantalla crear programa/corte | 🟡 **Parcial y peligrosa** | Existe (`/programas`), pero **crea cohortes rotas**. Ver §2.1. → **R-03** |
| 3.5 | Unicidad de nombre/siglas | ❌ **Falta** | Ni `programs.name` ni `cohorts.name` tienen `unique`. → **R-13** |
| 3.6 | Panel "mis inscripciones" del vendedor | ✅ **Hecho** | `app/(vendedor)/mis-inscripciones/page.tsx`, con filtro PTMA/PFTA. |
| 3.7 | Usuarios reales del sistema | 🟡 **Parcial** | El personal real **ya existe** en producción (Érika, Cecilia, Anyi, Nancy, Marco). Lo que falta es **borrar los de prueba**. → **R-30** |
| 3.8 | Foto del estudiante | ❌ **Backlog** | `profiles.avatar_url` existe; no hay bucket ni pantalla. → **Fase 5** |
| 3.8 | Color por sede | 🚫 **Descartado** | Correcto descartarlo. No se toca. |

### 1.b · Documento de roles y permisos

| § del doc de roles | Pedido | Estado real | Detalle |
|---|---|---|---|
| 2 | Que existan los 5 roles | ✅ **Hecho** | El enum `user_role` ya tiene los 6: `estudiante`, `profesor`, `admin`, `super_admin`, `direccion_academica`, `vendedor`. |
| 1 | Dirección Académica y Superadmin se solapan | 🔴 **Confirmado, y es peor de lo que parece** | Están unificados en `is_admin_up()`, de la que dependen 28 políticas RLS. Ver §2.4. → **R-14** |
| 3 | Solo Superadmin crea admins y vendedores | 🟡 **Parcial** | `create-staff-user` ya lo exige para `admin`/`super_admin`/`direccion_academica`. **Pero `vendedor` no está en la lista de roles válidos: hoy nadie puede crear un vendedor desde la app.** → **R-16** |
| 3 | Dirección Académica y Administración crean profesores | 🔴 **Contradice una decisión previa** | `create-staff-user` **excluye a `admin` a propósito** («eso pasó a ser académico»). Ver §2.4. → decisión en §3.5 |
| 3 | Dirección Académica también inscribe estudiantes | ❌ **Falta, y es una línea** | `create-student` acepta `admin`, `super_admin` y `vendedor` — **`direccion_academica` no está**. → **R-17** |
| 3 | Administración: asistencia y control estudiantil | ✅ **Hecho** | `/asistencias`, `/asistencias/historico`, `/estudiantes`. |
| 3 | Superadmin: control total | 🟡 **Parcial** | Solo `system_config` distingue de verdad al super_admin (3 políticas con `is_super()`). El resto lo comparte con los otros dos. → **R-14** |
| 5 | Renombrar roles a `superadmin` / `administracion` | 🚫 **No hacer** | Ver §3.5. Se cambia la etiqueta visible, no el enum. |
| 4 | Las 4 preguntas abiertas | ⛔ **Pendientes** | Tres tienen recomendación en §3.5; una es puramente de negocio. |

---

## 2. Los hallazgos que cambian el plan

### 2.1 · 🔴 CRÍTICO — Las cohortes nuevas nacen rotas y rompen la inscripción

**Esto no se reportó en la reunión porque todavía no había pasado.** Es el riesgo más alto del
proyecto ahora mismo.

El código de carnet lo arma `set_student_code_calc()` (migración `044`). Su primera decisión lee
`cohorts.code_number`, y si ese número es `NULL` devuelve un código provisional
`ZR-PENDIENTE-<8 caracteres del uuid>`.

Ahora mira las dos pantallas que crean cohortes:

- `app/(vendedor)/programas/page.tsx:88` — inserta `program_id`, `name`, `sede`, `turno`, `status`.
- `app/(admin)/cohortes/page.tsx` — inserta además `days` y `schedule`.

**Ninguna de las dos escribe `code_number`.** Tampoco `start_date` (queda en `current_date`).

Consecuencia en cadena, el día que Érica cree el corte nuevo desde la app:

1. La cohorte nace con `code_number = NULL`.
2. Cada estudiante que inscriba ahí recibe `student_code = 'ZR-PENDIENTE-a1b2c3d4'`.
3. `create-student` **usa ese texto como contraseña** de la cuenta (`index.ts`, `updateUserById`).
4. El carnet digital muestra un código que no significa nada, y la planilla física que firma el
   representante lleva impreso `ZR-PENDIENTE-a1b2c3d4`.
5. El trigger de recálculo (`fn_recalcular_student_code`) **no lo salva**: solo dispara cuando
   cambia `cohort_id`, y aquí nunca cambia.

Las 7 cohortes actuales no lo sufren porque se crearon a mano en la migración `043` y se
numeraron a mano en la `044`. **La pantalla nunca se usó de verdad.**

> **Regla operativa hasta que salga la Fase 0: nadie crea cohortes desde la app.** Si hace falta
> el corte nuevo antes, se crea por migración con `code_number` explícito.

### 2.2 · 🔴 El bug del correlativo: no hay que arreglar la lógica, hay que escribirla

El documento de la reunión dice «revisar la lógica de generación del correlativo». **No existe tal
lógica.** Los números están escritos uno por uno en la migración `044`, contando desde 2025 y sin
reiniciar por año. Esto es lo que hay hoy en producción, verificado en vivo:

| Programa | Cohorte | `code_number` actual | Turno | Según la regla de la reunión |
|---|---|---|---|---|
| PTMA | PTMA-2025-I | 1 | mañana | 01 |
| PTMA | PTMA-2025-II | 2 | tarde | 02 |
| PTMA | PTMA-2026-I | **3** | tarde | **01** |
| PTMA | PTMA-2026-II | **4** | mañana | **02** |
| PFTA | PFTA-2025-I | 1 | mañana | 01 |
| PFTA | PFTA-2026-I · mañana | **2** | mañana | **01** |
| PFTA | PFTA-2026-I · tarde | **3** | tarde | **02** |

**Ahí está el `04` que reportó la directiva**: PTMA-2026-II tiene `code_number = 4` porque arrastra
las dos cohortes de 2025.

Y fíjate que la regla de la reunión encaja perfecto con la realidad de las sedes: en San Antonio
(PTMA) la primera cohorte de 2026 es la de **tarde** y la segunda la de **mañana**; en Central
(PFTA) la primera es la de **mañana**. Es exactamente lo que se dijo en la reunión: «1 = tarde en
San Antonio, 1 = mañana en Central, es solo el correlativo de creación en el año». **La regla queda
confirmada por los datos, no hace falta volver a preguntarla:**

> `code_number` = correlativo por **(programa, año de inicio)**, reiniciando cada año, asignado por
> el servidor al crear la cohorte.

**Pero ojo con el efecto colateral, que es lo que hace esta tarea delicada:** el `code_number`
entra en el código de carnet, y **el código de carnet es la contraseña del estudiante**. Renumerar
cambia contraseñas de gente que ya está adentro. Hoy son 3 estudiantes (2 de prueba + un alumno
real, `PTMA-2026-04-762`). **Por eso esto se hace ya, esta semana, y no después del corte nuevo**:
en dos semanas serán 40 y el costo de la corrección se multiplica.

### 2.3 · 🔴 El dropdown de 2025: no es el año, es el estado

`carga-ventas/page.tsx:44` ya filtra: `.eq('status', 'activa')`. El filtro funciona. El problema es
el **dato**: en producción, `PTMA-2025-II` y `PFTA-2025-I` siguen marcadas `activa`. Solo
`PTMA-2025-I` está `finalizada`.

Es decir: **la mitad de este bug se arregla sin escribir código**, cambiando dos filas. La otra
mitad es evitar que vuelva a pasar (que "vigente" no dependa de que alguien se acuerde de cerrar la
cohorte a mano). Ver **R-12**.

### 2.4 · 🔴 El solapamiento de roles está en la base de datos, no en la interfaz

La directiva dijo: «Dirección Académica y Superadmin funcionan, en la práctica, como el mismo tipo
de administrador». Es correcto, y la causa es una sola función. Migración `022`:

```sql
create or replace function public.is_admin_up() ... as $$
  select coalesce(public.auth_role() in ('admin', 'super_admin', 'direccion_academica'), false);
$$;
```

**De esa función dependen 28 políticas de RLS.** Y `can_see_student()` y `teaches_cohort()` la
llaman a su vez, así que el alcance real es todavía mayor. En la práctica: **a nivel de datos, los
tres roles son un solo rol.** Lo único que de verdad los separa hoy son las tres políticas de
`system_config`, que sí usan `is_super()`.

En el cliente pasa lo mismo: `lib/auth-helpers.ts` tiene `esAdmin()` (los tres juntos, para entrar
al área de administración) y `esDireccionAcademica()` (que **incluye a `super_admin`**). La
separación se hace pantalla por pantalla, a mano, y por eso es inconsistente.

**Esto significa que la Fase 1.5 no es "ocultar botones": es reescribir el control de acceso.**
No se puede hacer a medias — si se separan los permisos en la interfaz pero no en RLS, cualquiera
con la sesión de un `admin` puede leer y escribir por API lo que la pantalla le esconde. Sería
seguridad de teatro sobre datos de menores.

**Además, hay una contradicción explícita entre la matriz del cliente y una decisión ya tomada**:
la matriz dice que **Administración también crea profesores**. El código dice lo contrario, y lo
dice a propósito, con el motivo escrito en `create-staff-user/index.ts`:

> «Gestionar personal (crear profesores, admins, etc.) es trabajo de Dirección Académica y
> super_admin — un admin normal ya no da de alta profesores, eso pasó a ser académico, no
> administrativo.»

No es un olvido: alguien decidió esto antes y lo documentó. La matriz nueva lo revierte. **Hay que
preguntarlo explícitamente antes de cambiarlo** (§3.5), o se deshace una decisión de producto sin
que nadie se entere — exactamente el error que `docs/18` §1 advierte que no hay que cometer.

### 2.5 · 🔴 SEGURIDAD — hay una cuenta de prueba con rol `super_admin` en producción

Al auditar los roles apareció esto, y es lo más urgente después de la Fase 0.

La migración `017` crea la cuenta `V-10000001` como **profesor de prueba**, con la contraseña
**`Prueba123!` escrita en texto plano en el repositorio** (que está en GitHub).

En producción, esa misma cédula hoy tiene:

| Cédula | Nombre en `profiles` | Rol actual |
|---|---|---|
| `V-10000001` | «Dirección Académica» | **`super_admin`** |

Alguien la promovió de profesor a super_admin para probar. **Es una cuenta con contraseña pública
y control total sobre datos de salud de menores de edad.** No es hipotético: `is_super()` da acceso
a `system_config`, y `is_admin_up()` a todo lo demás.

**Acción inmediata, no espera a ninguna fase**: cambiarle la contraseña hoy mismo o desactivarla, y
borrarla en R-30 junto con el resto de las cuentas de prueba. Está listado en §6 como tarea de la
semana 1.

---

### 2.6 · 🟠 Borrar una cuenta fallaba con «Database error deleting user» — arreglado

Apareció al ejecutar la limpieza de cuentas de prueba: administración intentaba borrar a un
estudiante desde la app y recibía ese mensaje, sin más detalle. **No fallaba siempre**, y esa era
la parte confusa: unas cuentas se borraban y otras no, sin patrón visible desde la pantalla.

La causa está a tres saltos de distancia del síntoma:

1. `attendance_events.scanned_by` tiene `ON DELETE SET NULL` (migraciones `029`/`032`).
2. Al borrar la cuenta, Postgres primero **actualiza** esa fila para poner la columna en NULL.
3. El guard `fn_attendance_guard` (migración `006`) trataba `scanned_by` como inmutable y
   rechazaba ese UPDATE — con lo que el DELETE completo se cae.

Solo lo sufre quien alguna vez figuró como **su propio escaneador**, que es justo lo que produce el
auto-registro con código diario (migración `037`). A quien escaneó un profesor, el SET NULL no le
tocaba ninguna fila y el borrado funcionaba.

Esto ya había pasado a medias: la migración `028` arregló el `DELETE` que el mismo guard bloqueaba
y **dejó el `UPDATE` sin arreglar**. La `059` cierra la otra mitad: `scanned_by` sigue siendo
inmutable —nadie puede reasignar una asistencia a otro profesor— pero ahora puede pasar a NULL,
que es lo único que hace la base al borrar una cuenta. Cubierto por
`tests/reglas/borrado-de-cuenta.test.ts`, con las dos caras: que el borrado funcione y que la
reasignación siga prohibida.

---

## 3. Los 4 temas abiertos de la reunión — cerrados o con recomendación

La reunión dejó 4 preguntas «bloqueantes». **Tres se pueden cerrar sin volver a reunirse**, porque
el código o los datos ya las responden. Solo una necesita decisión de negocio.

### 3.1 · ¿La APK depende de Odoo / de la web en producción? → **NO. Cerrado.**

No hay una sola línea de Odoo en el repositorio (confirmado en `docs/18`, D-1: «cero líneas de
código en todo el repo»). La app corre sobre Next.js + Supabase + Vercel y no le pide nada a Odoo.

La confusión viene de mezclar dos cosas: *dónde se aloja el archivo APK* con *de qué depende la
app*. **El APK se puede publicar en el propio dominio de Vercel** (`/descargar`) el mismo día que
esté compilado, sin esperar a que la web salga a producción. Cuando la web exista, se pone un
enlace ahí. **Esto desbloquea la Fase 4 por completo.**

### 3.2 · Teléfono: ¿opcional o mínimo dos? → **Única pregunta real que queda.**

Hoy: `profiles.phone`, uno solo, opcional. Ya existe además `students.emergency_contact_phone`
(migración `003`), sin usar.

**Recomendación**: *un teléfono del estudiante obligatorio + un segundo teléfono de contacto
obligatorio si es menor de edad, opcional si es mayor.* Motivos: (a) el pedido de «2 números» nació
de no poder ubicar a los estudiantes, y en un menor el segundo número siempre es el del
representante, que la planilla ya pide; (b) no requiere columna nueva —usa la que existe—; (c) no
bloquea la inscripción de un adulto que llegó solo, que es el caso donde exigir dos números
paralizaría la venta en el mostrador.

Si la respuesta es «dos siempre obligatorios», es media hora de cambio. Lo que **no** se puede es
dejarlo sin decidir: la validación vive en el servidor y hay que escribirla una sola vez.

### 3.3 · Fórmula exacta del código de estudiante → **Cerrada la parte del correlativo (§2.2). Queda un detalle a confirmar.**

El documento de la reunión escribe el formato como `PTMA-2026-01` (tres segmentos). **El formato
real que produce la app tiene cuatro**: `PTMA-2026-04-762`, donde los últimos 3 dígitos son **el
final de la cédula del estudiante**, no un correlativo de alumno.

Eso es una decisión anterior deliberada (migración `044`, tomada de la spec del coordinador), y es
mejor que la alternativa: distingue a los dos "Ricardo Hernández" del mismo corte, que es
precisamente el problema que la directiva quería resolver con el «nombre completo sin abreviar».

**Recomendación: mantener los cuatro segmentos** y mostrarle a la directiva un ejemplo real en la
próxima demo, para que quede asentado. No es bloqueante: si la directiva insiste en tres segmentos,
se cambia en la Fase 1 sin tocar nada más.

### 3.4 · Criterio de «programa vigente» → **Recomendación técnica, no necesita reunión.**

**Regla propuesta**: una cohorte aparece en el dropdown de inscripción si `status = 'activa'`
**y** su `start_date` es posterior a hoy menos el margen que diga `system_config`
(`enrollment.ventana_dias`, por defecto 30 días). Así:

- cubre el «ocultar 1 mes después de iniciar» que la reunión marcó como mejora futura, sin trabajo
  extra, porque es la misma expresión;
- el margen es un valor de negocio y va en `system_config`, no en el código (regla 5 de `CLAUDE.md`);
- no depende de que nadie cierre cohortes a mano.

### 3.5 · Las 4 preguntas abiertas del documento de roles

Ninguna es bloqueante para la Fase 0. Todas hay que cerrarlas antes de empezar la Fase 1.5, porque
definen qué se escribe en las políticas de RLS — y una política mal escrita sobre datos de menores
no es un detalle estético.

**P1 · ¿Qué permisos son solo de Administración y cuáles solo de Dirección Académica?**

Es la pregunta central y la que más trabajo desbloquea. **Propuesta concreta, derivada de lo que
cada rol ya hace hoy en la app** — llévala a la reunión como borrador para aprobar o corregir, es
mucho más rápido que partir de una hoja en blanco:

| Área | Dirección Académica | Administración | Motivo |
|---|:---:|:---:|---|
| Crear / editar profesores | ✅ | ⛔ *(ver P-extra)* | Es la decisión ya tomada en `create-staff-user` |
| Aprobar solicitudes de profesor | ✅ | ❌ | Ya implementado así (migración `021`) |
| Asignar profesor ↔ cohorte / módulo | ✅ | ❌ | Académico |
| Crear / editar exámenes y notas, corregir calificaciones | ✅ | ❌ | Académico |
| Malla, módulos, contenido académico | ✅ | ❌ | Académico |
| Asistencia (de hoy e histórica), justificar ausencias | ❌ | ✅ | Operativo del sábado |
| Validar la planilla firmada (`validated_at`) | ❌ | ✅ | Es el trámite administrativo |
| Alta / edición de estudiantes, consentimientos, reportes | ❌ | ✅ | Control estudiantil |
| Inscribir estudiantes (respaldo del vendedor) | ✅ | ✅ | Lo pide la matriz |
| `system_config`, crear usuarios de personal, sedes/programas | ❌ | ❌ | Solo `super_admin` |

Regla de oro para resolver cualquier caso que no esté en la tabla: **si la pregunta es "¿qué
aprende y cómo se evalúa?" es Dirección Académica; si es "¿quién vino, quién está inscrito y qué
papel firmó?" es Administración.**

**P-extra (la contradicción de §2.4) · ¿Administración crea profesores, sí o no?**
La matriz dice que sí; el código dice que no, a propósito. **Recomendación: mantener el "no"** y
que Administración pueda *ver* el personal pero no darlo de alta. Motivo: crear un profesor no es
solo una fila —le da acceso a notas, exámenes y datos de estudiantes—, y ya existe un flujo de
aprobación pensado para que eso pase por Dirección Académica. Si la directiva insiste en el «sí»,
es un cambio de una línea, pero que quede asentado que se revirtió una decisión anterior.

**P2 · ¿Pueden editar/eliminar profesores o solo crearlos?**
**Recomendación: editar sí, eliminar no.** Que se **desactiven** (`teachers.is_active`, que ya
existe) en vez de borrarse. Borrar un profesor arrastra sus sesiones, asistencias y notas por las
cascadas de las migraciones `028`/`029` — se perdería el histórico académico de estudiantes que no
tienen nada que ver. Desactivar resuelve el caso real (un profesor que ya no da clase) sin
destruir datos.

**P3 · ¿Pueden editar inscripciones ya hechas por el vendedor?**
**Recomendación: sí, y queda registrado quién lo hizo.** El caso real es corregir una cédula mal
tecleada en el mostrador. Dos condiciones: (a) `students.enrolled_by` **no cambia nunca** —el
vendedor sigue siendo el autor de su inscripción, o el panel «mis inscripciones» deja de servir
para llevar control; (b) toda edición se registra en la tabla de auditoría que ya existe desde la
migración `002`. **El vendedor no edita lo de otro vendedor.**

**P4 · ¿El Superadmin es uno solo o pueden ser varios?**
**Recomendación: varios, mínimo dos, y auditados.** Uno solo es un punto único de falla: si esa
persona pierde el acceso, nadie puede tocar `system_config` ni crear usuarios. Hoy en producción
hay dos cuentas `super_admin` — y **una de ellas es la cuenta de prueba de §2.5**, así que en la
práctica hoy hay *una sola real*. Lo correcto: dos personas reales de dirección, la cuenta de
prueba borrada, y (más adelante, `docs/18` C-4) 2FA para ese rol.

---

## 4. Sobre el APK — qué implica de verdad

La directiva pidió «una APK descargable que funcione en móvil y escritorio». Hoy la app es una PWA
instalable (`app/manifest.ts`, `public/sw.js`, `app/service-worker-init.tsx`).

| Camino | Qué da | Costo | Riesgo |
|---|---|---|---|
| **TWA con Bubblewrap** (recomendado) | Un `.apk` real, firmado, que instala la misma PWA como app nativa. Ícono, splash, sin barra de navegador. | ~1 día + generar y **custodiar la clave de firma** | El usuario debe permitir «orígenes desconocidos» al instalar fuera de Play Store. Hay que explicarlo en la página de descarga. |
| Capacitor | Igual, más pesado; abre la puerta a plugins nativos (cámara para la foto) | 2-3 días | Otro sistema de compilación que mantener |
| Solo PWA | Ya funciona | 0 | La directiva pidió un archivo descargable; «instalar desde el navegador» no es lo que pidió |

**Escritorio: no hace falta nada.** Una PWA se instala desde Chrome/Edge como aplicación de
escritorio con ventana propia. No se necesita Electron. Lo que sí falta es **decirlo** en la página
de descarga, con instrucciones separadas para Android y para PC.

**Advertencia de alcance**: un APK fuera de Play Store no se actualiza solo. Como el contenido vive
en la web y el APK es solo un envoltorio, las actualizaciones de la app sí llegan solas; solo un
cambio del envoltorio exige reinstalar. Esto hay que decírselo a la directiva antes de prometer.

---

## 5. Plan de ejecución

Cinco fases. **Las fases 0 y 1 son secuenciales y bloqueantes**; las 2, 3 y 4 pueden solaparse.
Cada tarea dice qué toca y cómo se verifica. Migración libre siguiente: **`057`**.

---

### FASE 0 — Parar la hemorragia (bloquea todo lo demás)

> **Objetivo**: que sea imposible crear una cohorte o inscribir un estudiante con un código
> inválido. **Nadie crea cohortes desde la app hasta que esto esté desplegado.**
>
> ✅ **EJECUTADA el 2 de septiembre de 2026.** Migraciones `057` y `058` aplicadas en `zr-prod`;
> cohortes renumeradas; pantallas corregidas; prueba de regresión escrita.
> Verificado contra producción: dos cohortes nuevas del mismo programa y año reciben `01` y `02`,
> un tercer intento con número repetido es rechazado por la base (`23505`), y el código que
> produce una cohorte recién creada es `PTMA-2099-01-762`, no `ZR-PENDIENTE-…`.
> Las cohortes de prueba se borraron después de comprobarlo.
>
> **Sin cabos sueltos de contraseñas**: la cuenta de Pedro Guayamuri, que era la única afectada
> por la renumeración, se borró después por pedido del cliente (era también una cuenta de prueba).
> Producción quedó con **cero estudiantes**: el primer carnet real se emitirá ya con la
> numeración correcta.
>
> **Bug extra encontrado y arreglado aquí** (migración `059`): borrar la cuenta de un estudiante
> fallaba con «Database error deleting user». Ver §2.6.

#### R-01 · Generación automática del correlativo de cohorte
- **Migración `057_code_number_automatico.sql`**:
  - Trigger `BEFORE INSERT` en `cohorts` que asigna
    `code_number = coalesce(max(code_number), 0) + 1` sobre las cohortes del **mismo `program_id` y
    el mismo año de `start_date`**.
  - Índice `unique (program_id, extract(year from start_date), code_number)` — que la base impida
    el duplicado, no solo la aplicación.
  - `start_date` pasa a `not null` (ya tiene default).
  - Backfill: renumerar las 7 cohortes existentes según la tabla de §2.2.
- **Verificación**: insertar dos cohortes seguidas del mismo programa y año → `01`, `02`. Insertar
  una de otro año → vuelve a `01`. Intentar duplicar a mano → falla.

#### R-02 · Recalcular códigos y contraseñas de los estudiantes ya inscritos
- Depende de R-01 (renumerar cambia los códigos).
- **Migración `058_recalcular_student_codes.sql`**: recalcular `student_code` de todos los
  estudiantes con cohorte.
- **Script `scripts/resincronizar-passwords.mjs`** (service_role, se corre a mano una vez): para
  cada estudiante **que nunca cambió su contraseña**, fijarla al código nuevo. Emite un CSV con
  `cédula / nombre / código anterior / código nuevo` para que administración avise.
- ⚠️ **Un estudiante que ya cambió su contraseña no se toca.** No se puede detectar con certeza
  desde la base; usar `students.validated_at` / `terms_acceptances` como señal y, ante la duda,
  **no cambiar la contraseña y listarlo aparte**. Es preferible avisarle a una persona de más que
  dejar a alguien afuera.
- Hoy son **3 estudiantes, uno real**. Esta tarea cuesta una hora ahora y días dentro de un mes.
- **Verificación**: los 3 entran con su código nuevo; el CSV coincide con lo que muestra el carnet.

#### R-03 · Que las pantallas dejen de crear cohortes incompletas
- **Hallazgo extra encontrado al ejecutarlo**: `app/(admin)/cohortes/page.tsx` tomaba el programa
  con `programs.select('id').limit(1).single()` — es decir, **toda cohorte creada por
  administración caía en el primer programa que devolviera la base**. Una cohorte de PFTA podía
  quedar colgada de PTMA, y el prefijo del carnet sale del programa. Se agregó el selector de
  programa. Estaba en el mismo archivo y era la misma clase de bug, así que entró aquí.
- `app/(vendedor)/programas/page.tsx` y `app/(admin)/cohortes/page.tsx`:
  - **fecha de inicio obligatoria** (hoy no se pide y define el año del código);
  - **sede desde lista**, no texto libre (hoy se escribe a mano → «UCV» y «U.C.V.» son sedes
    distintas para la base);
  - días y horario: ya están en admin, **faltan en la pantalla del vendedor**;
  - tras crear, **mostrar el `code_number` que asignó el servidor** («Cohorte creada: PTMA, corte
    03 de 2026») para que ventas confirme en el acto que el número es el que espera.
- **Nunca** enviar `code_number` desde el cliente (regla 2 de `CLAUDE.md`).
- **Verificación**: crear una cohorte desde `/programas`, inscribir un estudiante de prueba, y que
  el código salga `PTMA-2026-03-XXX` — no `ZR-PENDIENTE-…`.

#### R-04 · Prueba de regresión que blinda esto
- `tests/` — test que falla si un estudiante insertado en una cohorte recién creada recibe un
  código que empieza por `ZR-PENDIENTE`.
- Es la red que evita que este bug vuelva por otra vía.

**Salida de la Fase 0**: `npm run verify` en verde **y** las tres pruebas manuales de arriba hechas
en el navegador, no solo compilando (lección de `docs/18` §2bis).

---

### FASE 1 — Reglas de datos de la inscripción

#### R-10 · Nombre completo sin abreviar
- Validación **en el servidor** (`supabase/functions/create-student/index.ts`, junto a las demás):
  mínimo dos palabras de 3+ letras, sin puntos de abreviatura (`J. Pérez` se rechaza).
- Mensaje concreto: «Escribe el nombre completo como aparece en la cédula, sin abreviar».
- Espejo en la UI (`carga-ventas`) para que el vendedor lo vea antes de enviar. **La UI avisa, el
  servidor decide.**
- No se puede detectar toda abreviatura; esta regla ataca el caso real (dos "Ricardo Hernández")
  sin bloquear nombres legítimos cortos.

#### R-11 · Regla de teléfonos — *bloqueada por §3.2*
- Con la recomendación de §3.2: `profiles.phone` obligatorio; segundo número en
  `students.emergency_contact_phone`, obligatorio si es menor. Sin columna nueva.
- Formato venezolano validado en el servidor; la UI ayuda pero no decide.

#### R-12 · Vigencia de cohortes en el dropdown
- **Dato primero** (sin código, se puede hacer hoy): marcar `finalizada` las cohortes de 2025 que
  siguen `activa` en producción — `PTMA-2025-II` y `PFTA-2025-I`.
- **Migración `059`**: `system_config['enrollment.ventana_dias'] = 30` + vista
  `v_cohorts_inscribibles` con la regla de §3.4.
- `carga-ventas` consulta la vista en vez de `cohorts`.
- Con esto, la «mejora futura» de ocultar el programa un mes después de iniciar **queda hecha de
  una vez**, sin trabajo adicional.
- **Verificación**: el dropdown muestra solo cohortes de 2026 vigentes; cambiar
  `enrollment.ventana_dias` en Configuración cambia lo que se ve, sin desplegar.

#### R-13 · Unicidad de nombres
- **Migración `060`**: `unique` en `programs.name` y en `cohorts (program_id, name)`.
- Mensaje de error legible en las dos pantallas de creación (hoy se muestra el error crudo de
  Postgres: `programas/page.tsx:96` hace `setError(fallo.message)`).
- Requiere revisar antes que no haya duplicados en producción, o la migración falla.

---

### FASE 1.5 — Roles y permisos

> **Objetivo**: que cada rol pueda hacer exactamente lo que dice la matriz, **y nada más**, tanto
> en la interfaz como en la base de datos.
>
> ⛔ **No empezar sin las 4 preguntas de §3.5 cerradas.** Escribir 28 políticas de RLS con la
> matriz equivocada cuesta el doble que esperar la respuesta.
>
> ⚠️ **Esta es la fase con más riesgo de romper cosas de todo el plan.** `is_admin_up()` sostiene
> media aplicación: si se estrecha mal, un profesor deja de ver a sus estudiantes o administración
> pierde la asistencia del sábado. Se ejecuta con pruebas antes, no después.

#### R-14 · Separar `is_admin_up()` en funciones por responsabilidad
- **Migración `061_roles_separados.sql`**. Reemplazar la función-cajón por funciones con
  significado, sin borrar la vieja de entrada:
  - `is_academico()` → `direccion_academica`, `super_admin`
  - `is_administracion()` → `admin`, `super_admin`
  - `is_super()` → ya existe, no se toca
  - `is_admin_up()` **se conserva** como «cualquiera de los tres», porque hay políticas donde eso
    es justo lo que se quiere (leer la lista de cohortes, por ejemplo). Lo que cambia es que deja
    de usarse por defecto.
- Después, **recorrer las 28 políticas una por una** y decidir cuál de las tres corresponde, según
  la tabla de §3.5. No hay atajo: es trabajo de lectura, y es el corazón de esta fase.
- **Migrar en dos pasos, no en uno**: primero crear las funciones y las políticas nuevas
  conviviendo con las viejas; verificar; y en una segunda migración retirar las que sobran. Un
  `drop policy` equivocado deja una tabla sin política, y una tabla sin política es una fuga de
  datos de menores (regla 1 de `CLAUDE.md`).
- **Verificación**: `npm run test:rls` extendido con un caso por rol y por tabla (R-18).

#### R-15 · Alinear la interfaz con la matriz
- `lib/auth-helpers.ts`: `esAdmin()` sigue sirviendo de portero del área `/(admin)`, pero cada
  pantalla pasa a preguntar por la función específica (`esAcademico()`, `esAdministracion()`).
  Hoy `esDireccionAcademica()` incluye a `super_admin`, lo cual está bien, pero conviene renombrarla
  para que se lea como lo que es.
- La barra de navegación de `/(admin)` muestra solo lo que el rol puede usar. **Ocultar el botón no
  es la seguridad** —esa la da R-14— pero evita que alguien haga clic en algo que le va a fallar.
- **Verificación**: entrar con cada uno de los tres roles y comprobar que la barra y las pantallas
  coinciden con la matriz.

#### R-16 · Poder crear vendedores desde la app
- **Hoy no se puede.** `create-staff-user/index.ts` valida el rol contra
  `['profesor', 'admin', 'super_admin', 'direccion_academica']`: **`vendedor` no está en la lista**,
  así que la Edge Function lo rechaza. La única vendedora de producción se creó a mano.
- Agregar `vendedor` a los roles válidos, permitido **solo a `super_admin`** (matriz §3), y a la
  lista de roles del selector en `app/(admin)/personal/page.tsx`.
- Al crear un vendedor **no** se inserta fila en `teachers` (esa rama es solo de profesores).
- **Verificación**: un `super_admin` crea un vendedor, que entra y ve `/carga-ventas`; un
  `direccion_academica` intenta lo mismo y recibe 403.

#### R-17 · Dirección Académica también inscribe estudiantes
- Una línea en `supabase/functions/create-student/index.ts`: la comprobación de rol acepta hoy
  `['admin', 'super_admin', 'vendedor']` y **le falta `direccion_academica`**.
- Junto con eso, dar acceso al formulario de inscripción desde el área de administración (hoy solo
  vive en `/(vendedor)/carga-ventas`), como pide el punto 4 de la §5 del documento de roles.
- **Cuidado**: la validación «ventas debe asignar una cohorte» está atada a `esVendedor`. Al abrir
  el formulario a otros roles hay que decidir si esa exigencia aplica también a ellos.
  **Recomendación: sí** — un estudiante sin cohorte recibe un código provisional (§2.1).

#### R-18 · Pruebas de RLS por rol
- Extender `tests/rls` con una matriz ejecutable: **un caso por rol y por acción de la tabla de
  §3.5**, incluyendo los casos negativos (que Administración *no* pueda crear un profesor, que un
  vendedor *no* vea las inscripciones de otro vendedor).
- Es lo que convierte la matriz de un documento en una garantía. Sin esto, la Fase 1.5 se degrada
  sola con el próximo cambio.
- Corre dentro de `npm run verify`.

#### R-19 · Etiquetas visibles de los roles
- El documento de roles propone renombrar a `superadmin` y `administracion`. **No se renombra el
  enum.** Un `alter type ... rename value` sobre `user_role` toca 28 políticas y varias funciones
  `SECURITY DEFINER` para no ganar nada funcional, y `CLAUDE.md` §9 ya fija la regla: **código y
  base de datos en inglés, lo que ve el usuario en español**.
- Lo que sí se hace: una sola tabla de etiquetas en la interfaz — `admin` → «Administración»,
  `super_admin` → «Superadmin», `direccion_academica` → «Dirección Académica», `vendedor` →
  «Vendedor» — y usarla en todas partes, para que la directiva vea los nombres que pidió.

---

### FASE 2 — Programas y sedes

#### R-20 · Catálogo de sedes
- Sede es hoy texto libre en `cohorts.sede`. Con dos sedes reales (San Antonio de Los Altos, UCV)
  y más por venir, pasa a tabla `sedes` con RLS, y las pantallas la consultan.
- Habilita agrupar por sede en reportes sin depender de cómo se escribió el nombre.

#### R-21 · Crear **programa** (no solo cohorte)
- Hoy solo administración puede crear cohortes de los dos programas que existen; **nadie puede
  crear un programa nuevo desde la app**.
- Pantalla en `/panel` (solo `admin` / `super_admin`, **no vendedor**): nombre, siglas, total de
  módulos, duración.
- **Validación de siglas**: únicas, 3-5 letras, mayúsculas — es lo que pidió §3.5 de la reunión
  (`PTMA` vs `PFTA` deben distinguirse) y lo que alimenta el prefijo del código de carnet.
- ⚠️ **Dependencia oculta, no la pases por alto**: `set_student_code_calc` decide el prefijo con
  `pr.name like 'PTMA%'` y **cae a `PFTA` para cualquier otro programa**. Si se crea un tercer
  programa sin tocar eso, sus estudiantes reciben códigos `PFTA-…`. **R-21 debe incluir la
  migración que lea las siglas de `programs.siglas` en vez del `like`.** Sin esto, crear programas
  es peligroso.

---

### FASE 3 — Usuarios y panel

#### R-30 · Sacar los usuarios de prueba de producción — ⚠️ *adelantado a la semana 1 por §2.5*
- En `zr-prod` conviven el personal real (Érika Hidalgo, vendedora; Cecilia Suarez, admin; Anyi
  Mejias y Nancy Cardenas, dirección académica; Marco Mejias) **con los usuarios de prueba** de las
  migraciones `016` / `017`: `V-30000001/2/3` (estudiantes), `V-20000001/2` (profesores),
  `V-10000001`.
- Riesgo: contraseñas conocidas y publicadas en el repo (`Prueba123!`) en cuentas con acceso a
  datos de menores. **Y `V-10000001` tiene hoy rol `super_admin` en producción (§2.5)** — esa
  cuenta se atiende de inmediato, sin esperar a la Fase 3: contraseña cambiada o cuenta
  desactivada el mismo día.
- Borrarlos con `delete-account` (respeta las cascadas de las migraciones `028` / `029`), **no con
  `DELETE` a mano**.
- Antes de borrar: confirmar que ningún dato real cuelga de ellos (sesiones, asistencias, exámenes).
- Con esto, §3.7 de la reunión queda cerrado: los usuarios reales ya estaban creados.

#### R-31 · Mejoras al panel del vendedor
- `mis-inscripciones` ya existe. Agregar lo que hace falta para «llevar control» de verdad:
  estado de validación (pendiente / validado por administración), fecha, buscador por
  cédula o nombre, y total por cohorte.
- Bajo esfuerzo, alto valor percibido en la próxima demo.

---

### FASE 4 — Distribución (independiente, se puede empezar en paralelo desde ya)

#### R-40 · Compilar el APK (TWA / Bubblewrap)
- Requiere `assetlinks.json` en el dominio de producción y **custodia de la clave de firma**
  (si se pierde, no se puede publicar una actualización del envoltorio: guardarla fuera del repo).
- Salida: un `.apk` firmado y versionado.

#### R-41 · Página de descarga
- Ruta pública `/descargar` en la propia app: APK para Android + instrucciones de instalación de
  la PWA en PC (Chrome/Edge) y en iPhone (Safari → Compartir → Añadir a inicio; **en iOS no hay
  APK, es PWA obligatoriamente** — decírselo a la directiva).
- Advertir del aviso de «orígenes desconocidos» de Android, con captura.

#### R-42 · Prueba en dispositivos reales
- Instalar y hacer login en: un Android de gama baja (es el parque real de la academia), un iPhone
  y un PC. Verificar que **el escaneo de QR funciona dentro del APK** — es lo que más se puede
  romper al envolver la PWA, y es el flujo del sábado.

---

### FASE 5 — Backlog (no bloquea la entrega)

- **R-50 · Que el estudiante cambie su contraseña** desde Perfil. Hoy solo existe recuperación por
  correo (`/recuperar`), y el correo de contacto de muchos estudiantes es el del representante.
- **R-51 · Foto del estudiante**. `profiles.avatar_url` ya existe; falta bucket con RLS
  (la migración `015` solo creó `contenido` y `consentimientos`), captura desde la cámara,
  y validación de tamaño/formato **en el servidor**. Lo pidió la reunión como «no urgente».
- **R-52 · Color por sede** — 🚫 descartado por la directiva. No hacer.

---

## 6. Orden y cronograma sugerido

| Semana | Fase | Entregable comprobable |
|---|---|---|
| **Hoy** | §2.5 | La cuenta `V-10000001` (`super_admin` con contraseña pública) queda desactivada o con contraseña nueva. |
| 1 (2-6 sept) | **Fase 0 completa** | Se crea una cohorte desde la app y el estudiante inscrito recibe `PTMA-2026-03-XXX`. Los 3 estudiantes actuales entran con su código nuevo. |
| 1 | R-12 (parte de dato) | El dropdown deja de mostrar 2025 — cambio de dos filas, se puede hacer hoy. |
| 1 | R-30 (adelantado) | Producción sin cuentas de prueba. |
| 2 | Fase 1 | Inscripción con nombre y teléfonos validados en servidor; vigencia configurable. |
| 2-3 | Fase 4 (en paralelo) | APK firmado + `/descargar`, probados en un Android real. |
| 3 | **Fase 1.5** | Cada rol hace exactamente lo de la matriz, verificado por `npm run test:rls`. |
| 4 | Fase 2 | Sedes normalizadas y creación de programas con siglas propias. |
| 4 | Fase 3 (resto) | Panel del vendedor completo. |
| — | Fase 5 | Backlog, según prioridad de la directiva. |

La Fase 1.5 va en la semana 3, después del APK, por dos motivos: necesita las 4 respuestas de §3.5,
y es la que más puede romper lo que ya funciona — conviene hacerla con la Fase 0 asentada y no en
paralelo a ella.

**Lo que bloquea al equipo hoy**: la pregunta del teléfono (§3.2) y las 4 preguntas de roles
(§3.5), todas con recomendación escrita para que la reunión sea de aprobar, no de diseñar. Las
otras tres «decisiones pendientes» de la reunión ya están resueltas por los datos y no requieren
juntar a nadie.

---

## 7. Riesgos y cómo se manejan

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Renumerar cohortes cambia contraseñas de estudiantes activos | Alto si se hace tarde | Hacerlo en la Fase 0, con 3 estudiantes. CSV para administración. No tocar a quien ya cambió su contraseña. |
| Alguien crea el corte nuevo desde la app antes de la Fase 0 | Inscripciones rotas, planillas firmadas con códigos inválidos | **Avisar hoy a Érika y a administración: no crear cohortes hasta nuevo aviso.** |
| Un tercer programa con el `like 'PTMA%'` todavía vigente | Códigos de carnet incorrectos y silenciosos | R-21 incluye la corrección; no crear programas nuevos antes. |
| Pérdida de la clave de firma del APK | No se puede actualizar el envoltorio | Custodia fuera del repo, respaldada por dirección. |
| Reintroducir obligatoriedad por minoría de edad sin querer | Deshace una decisión de producto (`docs/18` §2.1) | R-11 toca teléfonos, **no** los campos del representante. |
| Cuenta de prueba con `super_admin` y contraseña pública en producción | **Acceso total a datos de salud de menores** | §2.5: atender hoy, borrar en R-30 (adelantado a la semana 1). |
| Estrechar `is_admin_up()` y romper accesos legítimos | Un profesor deja de ver a sus estudiantes; administración pierde la asistencia del sábado | R-14 en dos migraciones (crear y convivir → verificar → retirar), con R-18 escrito **antes**. |
| Separar permisos solo en la interfaz y no en RLS | Seguridad de teatro: el botón se oculta pero la API responde | R-14 es obligatoria; R-15 sola no cierra nada. |
| Aplicar la matriz nueva sin notar que revierte una decisión anterior | Se deshace lo decidido sobre quién crea profesores | §3.5, P-extra: preguntarlo explícitamente y dejar constancia. |

---

## 8. Reglas del proyecto que aplican a todo esto

Recordatorio, porque cada tarea las toca (`CLAUDE.md` §2):

- Toda tabla nueva, **con RLS y políticas escritas**. Son datos de menores.
- **Nunca editar una migración aplicada.** Siguiente libre: **`057`**.
- El correlativo, el prefijo y la contraseña **se calculan en el servidor**. El cliente solo muestra.
- Umbrales y ventanas de tiempo van en `system_config` — nunca en el código.
- Nada de Fase 2/3 del producto: sin pagos, puntos, insignias ni mensajería.
- Interfaz en español de Venezuela; código y tablas en inglés.
- Antes de cerrar cualquier tarea: `npm run verify` **y** probarla en el navegador.
