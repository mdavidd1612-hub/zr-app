# Informe nocturno — 20 de noviembre de 2026 (v1.78 → v1.80, staging)

Pedido del coordinador: revisar qué hay en producción que no esté en staging, optimizar para poco internet y que se sienta como app, probar escenarios reales con varias cuentas y revisar UX. Todo quedó en `develop` → `zr-staging`. **Producción (`zr-prod`/`main`) no se tocó.**

## 1. Producción vs. staging

- Se compararon los commits de `main` (repo del programador) contra `develop` por contenido, no por nombre.
- **No falta nada de producción en develop.** Los arreglos hechos directo en producción (notas por cohorte, planillas, barra colapsable, push del feedback, etc.) ya están en develop. Los dos únicos commits que no se traen son a propósito: los que sacaban el Aula Virtual del menú de producción.
- También se revisaron las migraciones aplicadas en `zr-prod`: todas existen como archivo en el repo.
- **Para el paso a producción:** en `zr-prod` el módulo "Inglés técnico automotriz" se **borró** (migración 138, octubre). Antes de abrir Inglés virtual allá hay que crear el módulo otra vez (en `/modulos`). En staging ya existe como "Ingles Tecnico" (#14).

## 2. Rendimiento con poco internet

| Pantalla | JavaScript propio antes | Después |
|---|---|---|
| Login / Recuperar | ~608 KB | ~110 KB |
| Asistencia y refrigerio (escáner) | ~846 KB | ~370 KB |
| Personal, fichas de estudiante | ~680 KB | ~400 KB |

- Se quitó `zod` (285 KB) — solo se usaba para validar la cédula. Ahora es una función pequeña con la misma forma.
- El lector de QR (480 KB) se carga solo al abrir la cámara. El generador de QR, solo al generarlo (en el carnet **no**, para que siga funcionando sin conexión).
- La campanita ya no baja las 30 notificaciones cada 30 s: pregunta por una sola fila y baja la lista solo si hay algo nuevo.
- Lo pesado que queda es la librería de Supabase (~225 KB), compartida por todas las pantallas y guardada en caché una sola vez.

**Sensación de app:** sin el resaltado gris al tocar (Android), sin el menú de "copiar enlace" al mantener presionado un botón, respuesta visual al tocar y barra de estado translúcida en iPhone.

## 3. Pruebas de escenarios (cuentas reales de staging)

**Cómo se probó.** No pude entrar con las claves de prueba (el sistema bloqueó leerlas), así que:
- **Permisos:** con los permisos reales de cada cuenta, desde la base, revirtiendo todo al final. 3 profesores (QA con 3 módulos, Pedro Ramírez en Fluidos, Arjona en Introducción), 10 estudiantes en 2 cortes (PTMA-II y PTMA-III), Dirección, admin, vendedor y ZR Coffee.
- **Pantallas:** a 375 px con la sesión de Dirección abierta, y como estudiante con la "vista de recorrido".

### Encontrado y corregido

1. 🔴 **Un profesor podía modificar unidades de módulos que no dicta.** El de Introducción renombró una unidad de Inglés; el de Fluidos vació una unidad de Inglés; también se podían crear/borrar tareas y calificar entregas ajenas. **Migración 227:** el profesor solo escribe en sus módulos. Verificado: bloqueado para los ajenos, permitido para quien lo dicta y para Dirección.
2. 🔴 **Un estudiante podía abrir un intento en un examen de otro corte o en un borrador** (aunque no lo veía). **Migración 228.** Verificado: bloqueado otro corte y borrador; su propio examen funciona.
3. 🟠 **La ficha del corte se salía del ancho en el teléfono** (calendario de salones y de módulos cortados a la derecha). La prueba automática de "desborde" no lo veía porque la app recorta el exceso; se cambió la prueba para medir cada elemento y se pasó por todas las pantallas.
4. 🟠 **La vista de estudiante (recorrido) mezclaba las unidades de todos sus módulos** y no mostraba Presencial/Virtual. Ahora calcula sus módulos igual que la base.
5. 🟡 Las pestañas Unidades/Notas/Dudas/Feedback no cabían enteras a 375 px.
6. 🟡 Programas ahora avisa cuando un corte cursa un módulo **sin profesor**.

### Verificado que funciona

- Cada estudiante ve solo su corte: 0 exámenes de otro corte, no ve notas ni perfil de compañeros, no puede entregar por otro ni publicar exámenes.
- PTMA-II ve 4 módulos (incluido Inglés virtual); PTMA-III ve solo el suyo.
- Cierre de notas: cada profesor edita solo su módulo **en curso**; terminados y futuros cerrados.
- Asistencia filtra por módulo (Todos / Introducción / Instrumentación / Fluidos).
- Personal: Dirección ve solo profesores.
- Datos sanos: sin módulos con más de 100 %, sin exámenes publicados con puntos descuadrados, sin estudiantes sin corte.
- Avisos de seguridad de la base: los mismos de siempre, ninguno nuevo.
- Sin desbordes a 375 px en Panel, Programas, ficha del corte, Asistencia, Personal, Notas, Material, Módulos, Salones, Exámenes, Feedback, Salud, Inicio, Unidades, Mi módulo, Notas, Calendario, Malla y Dudas del estudiante; Calendario y Exámenes del profesor.

## 4. Para decidir (no lo toqué)

1. ~~¿Administración puede cambiar notas?~~ **Decidido: no.** Quitado en v1.81 (migración 229).
2. **PTMA-2026-III está cursando Introducción a la Mecánica sin ningún profesor asignado** (0 asignaciones). Nadie puede subir material ni calificar ese módulo hasta que se asigne en la ficha del corte.
3. **Cuentas para pruebas en pantalla:** para probar cada rol en pantalla (no solo permisos) necesito poder entrar con las cuentas de prueba. Opciones: que me dejes leer la clave de `.secrets` o que tú inicies sesión en el panel del navegador cuando haga falta.

## 5. Lo que no se cubrió

- Teléfono físico real (solo emulación de 375 px) y cámara (escaneo QR).
- Flujos de vendedor y ZR Coffee en pantalla (solo permisos).
- Sin conexión real (descargas de unidades).
