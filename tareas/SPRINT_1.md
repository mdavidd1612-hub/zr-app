# SPRINT 1 · IDENTIDAD, CONSENTIMIENTO Y CARNET
**3 → 9 de agosto** · Prueba en campo: **sábado 8 de agosto**
Objetivo: que un estudiante real se registre, cumpla LOPNNA si es menor, y vea su carnet.

---

## T-101 · Middleware de protección de rutas
**Archivo:** `middleware.ts` (raíz del proyecto).
**Haz:**
- Refrescar la sesión de Supabase en cada petición.
- Sin sesión y ruta protegida → redirigir a `/login`.
- Con sesión, leer el rol y verificar que corresponde al grupo de rutas:
  `estudiante` → `(estudiante)`, `profesor` → `(profesor)`,
  `admin` y `super_admin` → `(admin)` y también `(profesor)`.
- Rol equivocado → redirigir a la pantalla de inicio de su propio rol.
- Rutas públicas: `/login`, `/registro`, `/registro/consentimiento`, `/recuperar`,
  `/api/auth/callback`.

**Verifica:** entra como estudiante e intenta abrir `/panel`. Debe mandarte a `/carnet`.

---

## T-102 · Diseño base y componentes comunes
**Archivos:** `app/globals.css`, `tailwind.config.ts`, `components/ui/*`.
**Haz:** define la paleta de `spec/04_PANTALLAS.md` §0 y crea estos componentes, todos con las
medidas mínimas de esa sección:
`Boton`, `Campo`, `Tarjeta`, `Aviso` (éxito/error/advertencia), `Cargando`, `EstadoVacio`.
**Verifica:** todos los botones miden al menos 56 px de alto y el texto nunca baja de 16 px.

---

## T-103 · Pantalla de inicio de sesión
**Archivo:** `app/login/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §2.
- Convertir cédula a correo con `cedulaAEmail()`.
- Ante cualquier fallo, un solo mensaje: *"Cédula o contraseña incorrecta"*.
  **Nunca reveles cuál de los dos falló.**
- Redirigir según el rol.

**Verifica:** entra con `V-30000001` / `Prueba123!` y llegas a `/carnet`. Entra con
`V-10000003` y llegas a `/hoy`.

---

## T-104 · Registro
**Archivo:** `app/registro/page.tsx`.
**Haz:** el formulario único de `spec/04_PANTALLAS.md` §2, validado con `registroSchema`.
Al enviar: `signUp`, luego insertar en `students`, luego **calcular la edad**.
- Menor de 18 → `/registro/consentimiento`.
- 18 o más → llamar a `provision-qr` y ir a `/carnet`.

**Verifica:** un registro de mayor de edad llega al carnet en menos de 60 segundos,
cronometrado de verdad.

---

## T-105 · Consentimiento parental
**Archivo:** `app/registro/consentimiento/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §2. Insertar en `parental_consents` con
`consent_type = 'account_creation'`, subir el documento a `consentimientos` si lo hay, y luego
poner `students.onboarding_status = 'completo'`.

**Esta pantalla no se puede saltar.** No pongas botón de "después", ni permitas volver atrás
al registro, ni dejes navegar a `/carnet` sin completarla.

**Verifica:**
1. Registra a alguien nacido en 2010. Debe llegar aquí obligatoriamente.
2. Intenta ir a `/carnet` escribiendo la URL a mano. Debe devolverte aquí.
3. Completa el formulario y verifica que ahora sí entra.

---

## T-106 · Edge Function `provision-qr`
**Archivo:** `supabase/functions/provision-qr/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 1.
**Verifica:** llámala con el token de un estudiante y devuelve un secreto en base32. Llámala
con el token de un profesor y devuelve `NO_AUTORIZADO`.

---

## T-107 · Guardado seguro del secreto en el dispositivo
**Archivo:** `lib/qr-secret.ts`.
**Haz:**
- `guardarSecreto(secreto)`: lo guarda en IndexedDB, no en `localStorage`.
- `leerSecreto()`: lo recupera.
- `borrarSecreto()`: al cerrar sesión.
- Si no hay secreto guardado, llamar a `provision-qr` una sola vez.

**Verifica:** cierra sesión y vuelve a entrar. El secreto se recupera sin volver a pedirlo al
servidor.

---

## T-108 · Carnet digital
**Archivo:** `app/(estudiante)/carnet/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §3.
- Generar el QR con `otpauth` + `qrcode`, formato `ZR1|<cedula>|<totp>`.
- Barra de progreso que se vacía en 30 segundos; el código se regenera solo.
- **Debe funcionar sin internet**: el TOTP se calcula en el dispositivo.

**Verifica:** activa el modo avión. El QR debe seguir apareciendo y cambiando cada 30 segundos.

---

## T-109 · Recuperación de contraseña
**Archivos:** `app/recuperar/page.tsx`, `app/api/auth/callback/route.ts`.
**Haz:** el usuario escribe su cédula; se busca `profiles.contact_email` y se envía el enlace a
**ese** correo, no al sintético.
**Verifica:** para un menor de edad, el enlace llega al correo del representante legal. Esa es
la intención del diseño, no un efecto secundario.

---

## T-110 · Esqueleto de la PWA
**Archivos:** `app/manifest.ts`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`.
**Haz:** según `spec/04_PANTALLAS.md` §6.
**Verifica:** en Chrome, aparece la opción de instalar. Instálala en un Android real y
comprueba que abre en pantalla completa.

---

## T-111 · Navegación del estudiante
**Archivo:** `app/(estudiante)/layout.tsx`.
**Haz:** barra inferior fija con 4 botones grandes: Carnet, Clases, Exámenes, Material.
El activo se resalta. Cada botón mide al menos 56 px de alto.
**Verifica:** a 360 px de ancho, los cuatro caben sin comprimirse ni desbordarse.

---

## T-112 · Edge Function `create-staff-user`
**Archivo:** `supabase/functions/create-staff-user/index.ts`.
**Haz:** según `spec/03_EDGE_FUNCTIONS.md` función 6.
**Verifica:** un `admin` puede crear un profesor. Un `admin` **no** puede crear un
`super_admin`. Un estudiante no puede llamarla.

---

## T-113 · Panel de administración: estudiantes
**Archivos:** `app/(admin)/layout.tsx`, `app/(admin)/panel/page.tsx`,
`app/(admin)/estudiantes/page.tsx`, `app/(admin)/estudiantes/nuevo/page.tsx`.
**Haz:** según `spec/04_PANTALLAS.md` §5. Incluye la carga por CSV con vista previa y errores
por fila.
**Regla:** la importación es todo o nada. Nunca importes un archivo a medias.
**Verifica:** sube un CSV con una fila mala. Debe mostrar el error y **no importar nada**.

---

## T-114 · Cola de consentimientos
**Archivo:** `app/(admin)/consentimientos/page.tsx`.
**Haz:** lista de `v_students_blocked`, con el documento adjunto y el botón **Verificar**.
Si hay pendientes, mostrar un aviso rojo en `/panel`.
**Verifica:** con los datos de prueba deben aparecer 2 estudiantes: uno sin consentimiento y
otro sin verificar.

---

## T-115 · Pruebas del sprint
**Archivos:** `tests/e2e/registro-menor.spec.ts`, `tests/e2e/registro-adulto.spec.ts`.
**Haz:** cópialos de `spec/05_PRUEBAS.md` §3.
**Verifica:** `npm run test:e2e` pasa.

---

## SÁBADO 8 DE AGOSTO · PRUEBA EN CAMPO
Registrar a **5 estudiantes reales, al menos 2 menores de edad**, con alguien del equipo
presente pero sin ayudarlos.

**Se aprueba si:** los 5 se registran sin ayuda técnica, los menores quedan con consentimiento
capturado, y todos ven su QR en su propio teléfono.

**Anota:** cada punto donde alguien dudó o se detuvo. Eso es lo más valioso que sale del día.

---

## CRITERIO DE SALIDA
- [ ] `npm run verify` pasa.
- [ ] Un menor de edad no puede llegar al carnet sin consentimiento, ni escribiendo la URL.
- [ ] El QR funciona en modo avión.
- [ ] La app se instala en un Android real.
- [ ] Los 5 registros del sábado 8 salieron bien.
