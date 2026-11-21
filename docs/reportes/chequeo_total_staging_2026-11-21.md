# Chequeo total de staging — 21-nov-2026 (v1.96 → v1.97)

Primer chequeo con la regla §12.10 de `CLAUDE.md`. Se hizo en `zr-staging`, sobre lo desplegado en
`develop` (https://zr-app-git-develop-mt-projects12.vercel.app), con las cuentas de prueba de los 4
perfiles principales. **Producción no se tocó.**

## Resumen

- **4 perfiles revisados**, en teléfono (360/375 px) y en PC (1440 px): **96 cargas de pantalla**
  revisadas. Ninguna página se sale del ancho y no hubo ningún error en la consola del navegador.
- **3 cosas corregidas** (detalle abajo). Ninguna rompía un flujo; eran un texto engañoso, un botón
  sin nombre accesible y un selector que se partía en el teléfono.
- **Flujos probados de punta a punta:** inicio de sesión (incluida la clave incorrecta), unidad →
  documento → video por enlace → tarea, duda del estudiante (enviada y recibida por el profesor
  correcto), crear unidad (queda guardada con su corte), bloque de texto, eliminar unidad,
  vista previa de mover una clase, validación del formulario de inscripción y cerrar sesión.

## Cómo se revisó

- Cada perfil entró con su cuenta real de prueba: Estudiante V-90000001, Profesor V-90000002,
  Dirección Académica V-90000003 y Administración V-10000003.
- **Barrido automático:** cada pantalla se cargó dentro de un marco de 360 px y de 1440 px.
  - Se midió si la página se sale del ancho, contando solo lo que no está dentro de una zona con
    scroll propio (las tablas de notas sí lo tienen, a propósito).
  - Se buscaron textos de error ("undefined", "NaN", "null", "Algo salió mal", "No se pudo",
    "Invalid Date").
  - Se capturaron los errores de consola.
- **Pruebas a mano** de las acciones principales de cada perfil, más capturas de pantalla para
  revisar proporciones.

## Por perfil

| Perfil | Pantallas (teléfono / PC) | Resultado | Acciones probadas |
|---|---|---|---|
| Estudiante | 16 / 15 + 4 de detalle de unidad | ✅ | Login (clave mala y buena), recorrido de Unidades, documento, video por enlace, tarea, enviar duda (vacía no se envía), campanita, carnet, cerrar sesión |
| Profesor | 21 / 19 | ✅ | Crear unidad (`cohort_id` = PTMA-2026-II, migr. 241), bloque de texto con formato (queda en el corte correcto y publicado), eliminar unidad con su resumen, dudas, notas (tabla con scroll propio), calificar |
| Dirección Académica | 26 / 26 | ✅ | Calendario general: detalle de clase y "Ver qué va a cambiar" (43 clases corridas, aviso de choque de salón; no se confirmó), material, programas, ficha del corte |
| Administración | 15 / 15 | ✅ | Menú (sin enlaces a lo académico), inscribir (no deja enviar vacío), asistencia, QR, finanzas, personal |

Redirecciones vistas y correctas:
- `/estudiantes/estadisticas` → panel: es solo de super_admin.
- `/casos-docente` → Hoy: la pantalla está retirada.
- Material, Unidades y Exámenes → panel para Administración: no son de su rol (§8.29).

## Bugs encontrados y corregidos

1. **Carnet del estudiante: prometía un código que no aparece.**
   - Qué pasaba: el carnet decía "Muéstrale este código a tu profesor… Cambia solo", pero no
     mostraba ningún QR.
   - Causa: el QR del carnet necesita un secreto guardado en el teléfono, y la función que lo guarda
     (`saveQRSecret`) no se llama en ninguna parte del código. Pasa igual en `main`, o sea en
     producción.
   - Arreglo: sin código, el texto ahora explica el flujo real: el estudiante escanea el QR de
     administración desde Inicio → Tomar asistencia. La asistencia nunca dependió de ese código.
   - Archivo: `app/(app)/perfil/page.tsx`.
   - **Decisión pendiente:** si se quiere el QR en el carnet de verdad, hay que conectar
     `provision-qr` al primer inicio de sesión. Si no, conviene quitar ese bloque.
2. **Botón de foto de perfil sin nombre** para lectores de pantalla. Se agregó
   `aria-label="Cambiar foto de perfil"` en `components/ui/FotoPerfil.tsx`.
3. **Calendario general en el teléfono: "Año" quedaba solo en una segunda línea** del selector de
   rango. Ahora las 5 opciones reparten el ancho en una fila; en PC queda igual.
   Archivo: `app/(admin)/calendario-general/page.tsx`.

## Observaciones (no son bugs)

- **Panel de Dirección/Administración a las 2 a. m.:** decía "No hay sesiones de clase programadas
  para hoy". Es correcto: la sesión del día se crea a las 4:00 a. m. (hora de Caracas) por el cron
  diario.
- **PTMA-III sin clase hoy en staging:** una prueba anterior corrió su calendario una semana.
- **Inicio del estudiante:** muestra "Hoy toca clase · Marca tu asistencia" dos veces (tarjeta
  destacada y sección 01). Es de diseño, pero se ve repetido.
- **"Tu clase cambió de fecha" en la campanita del estudiante de prueba:** vienen de movimientos
  reales de clases hechos en staging por super_admin.

## Lo que NO se pudo revisar

- **Cámara:** escanear QR de asistencia y refrigerio. El navegador de pruebas no tiene cámara.
- **Aprobar material:** no había ningún material pendiente en staging.
- **Avisos push en un teléfono real:** staging no tiene claves VAPID (§8.30).
- **Acciones que escriben datos importantes:** no se confirmaron mover clase, enviar/devolver
  notas, inscribir de verdad ni calificar. Se probaron sus pantallas y validaciones, y por base de
  datos `devolver_notas` (migr. 240).
- **Teléfonos físicos:** se usó el emulador de anchos del navegador.
- Super admin, vendedor y ZR Coffee no son parte de los 4 perfiles principales.

## Datos de prueba

- La unidad "QA chequeo total 21-nov" se creó y se borró desde la app.
- La duda de prueba se borró al terminar.
- No quedan datos nuevos en staging.
- No se cambió ninguna clave: se usó ZrTest2026, autorizado por el coordinador.
