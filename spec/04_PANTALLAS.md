# 04 · PANTALLAS Y RUTAS
> Cada ruta con sus campos exactos, sus estados y su comportamiento.
> Construye en el orden de las tareas, no en el orden de este documento.

---

## 0. REGLAS DE DISE�'O �?" APLICAN A TODA PANTALLA

La app se usa **de pie, en un taller, con las manos sucias o con guantes**. No es una app de
escritorio adaptada a móvil.

| Regla | Valor concreto |
|---|---|
| Ancho de referencia | 360 px. Diseña ahí primero |
| Altura mínima de un botón | 56 px (`min-h-14`) |
| Tamaño mínimo de texto | 16 px (`text-base`). Nunca menos |
| Área táctil mínima | 48 �- 48 px |
| Zona de acciones principales | Tercio inferior de la pantalla, alcanzable con el pulgar |
| Contraste | Mínimo 4.5:1. Se usa a la luz del día, en un taller |
| Texto por pantalla | Lo mínimo. Un icono grande vale más que un párrafo |
| Estado de carga | Toda acción con red muestra un indicador. Nunca una pantalla congelada |
| Estado de error | Siempre en español, siempre con qué hacer después |
| Estado vacío | Siempre explica por qué está vacío y qué hacer |

**Paleta, tipografía y logo: ver `spec/06_IDENTIDAD_VISUAL.md`.** Son los oficiales del
Manual de Identidad ZR Mecademy 2025 y no se modifican. Resumen para tenerlo a mano:

| Uso | Color |
|---|---|
| Barras y texto | `#21284F` azul noche |
| Botón de acción principal | `#3869B1` azul de marca |
| Fondos de tarjeta informativa | `#98BAE3` azul claro |
| Fondo de página | `#F5F7FB` |
| �?xito / Advertencia / Error | `#16A34A` · `#EAB308` · `#DC2626` *(capa funcional, solo estados)* |

Tipografías: **Raleway** para títulos y cifras grandes, **Roboto** para todo lo demás.

---

## 1. ESTRUCTURA DE RUTAS

```
app/
�"o�"?�"? layout.tsx                      raíz, fuentes, metadatos de la PWA
�"o�"?�"? page.tsx                        redirige según el rol
�"o�"?�"? login/page.tsx
�"o�"?�"? registro/page.tsx
�"o�"?�"? registro/consentimiento/page.tsx
�"o�"?�"? recuperar/page.tsx
�",
�"o�"?�"? (estudiante)/
�",   �"o�"?�"? layout.tsx                  navegación inferior de 4 botones
�",   �"o�"?�"? carnet/page.tsx             pantalla de inicio
�",   �"o�"?�"? clases/page.tsx
�",   �"o�"?�"? examenes/page.tsx
�",   �"o�"?�"? examenes/[examId]/page.tsx
�",   �"o�"?�"? contenido/page.tsx
�",   �"o�"?�"? contenido/[moduleId]/page.tsx
�",   �"o�"?�"? notas/page.tsx
�",   �""�"?�"? feedback/[sessionId]/page.tsx
�",
�"o�"?�"? (profesor)/
�",   �"o�"?�"? layout.tsx                  navegación lateral
�",   �"o�"?�"? hoy/page.tsx                pantalla de inicio del profesor
�",   �"o�"?�"? escanear/[sessionId]/page.tsx
�",   �"o�"?�"? sesiones/page.tsx
�",   �"o�"?�"? examenes/page.tsx
�",   �"o�"?�"? examenes/nuevo/page.tsx
�",   �"o�"?�"? examenes/[examId]/editar/page.tsx
�",   �"o�"?�"? calificar/page.tsx
�",   �"o�"?�"? notas/[cohortId]/page.tsx
�",   �""�"?�"? contenido/page.tsx
�",
�"o�"?�"? (admin)/
�",   �"o�"?�"? layout.tsx
�",   �"o�"?�"? panel/page.tsx
�",   �"o�"?�"? estudiantes/page.tsx
�",   �"o�"?�"? estudiantes/nuevo/page.tsx
�",   �"o�"?�"? consentimientos/page.tsx
�",   �"o�"?�"? cohortes/page.tsx
�",   �"o�"?�"? reportes/page.tsx
�",   �""�"?�"? configuracion/page.tsx      solo super_admin
�",
�""�"?�"? api/
    �""�"?�"? auth/callback/route.ts
```

**`middleware.ts` en la raíz** protege las rutas: si no hay sesión �?' `/login`. Si el rol no
corresponde al grupo de rutas �?' redirige a la pantalla de inicio de su rol.

---

## 2. PANTALLAS P�sBLICAS

### `/login`
| Campo | Tipo | Validación |
|---|---|---|
| Cédula | texto | `V-12345678`, se convierte a mayúsculas sola |
| Contraseña | contraseña | mínimo 8 caracteres |

Botón grande: **Entrar**. Enlace pequeño: *¿Olvidaste tu contraseña?* �?' `/recuperar`.
Enlace: *¿Eres nuevo? Regístrate* �?' `/registro`.

**Comportamiento:** convierte la cédula a correo con `cedulaAEmail()` y llama a
`signInWithPassword`. Si falla, mensaje único: *"Cédula o contraseña incorrecta"* �?" nunca
digas cuál de las dos falló.

Al entrar, redirige según el rol: estudiante �?' `/carnet`, profesor �?' `/hoy`,
admin y super_admin �?' `/panel`.

### `/registro`
Un solo formulario, sin pasos, para que un mayor de edad termine en menos de 60 segundos.

| Campo | Tipo | Nota |
|---|---|---|
| Nombre completo | texto | |
| Cédula | texto | formato `V-12345678` |
| Fecha de nacimiento | fecha | **determina si hace falta consentimiento** |
| Correo de contacto | correo | *"Si eres menor de 18, pon el correo de tu representante"* |
| Teléfono | teléfono | opcional |
| Contraseña | contraseña | |
| Repetir contraseña | contraseña | debe coincidir |

**Comportamiento:**
1. Validar con `registroSchema`.
2. `signUp` con el correo sintético y los metadatos.
3. Insertar la fila en `students` con `birth_date`.
4. **Si la edad calculada es menor de 18** �?' redirigir a `/registro/consentimiento`.
5. Si no �?' llamar a `provision-qr` y redirigir a `/carnet`.

### `/registro/consentimiento`
Pantalla obligatoria para 15-17 años. **No se puede saltar.**

Encabezado explicativo: *"Como eres menor de edad, la ley exige que tu representante legal
autorice tu cuenta."*

| Campo | Tipo |
|---|---|
| Nombre del representante | texto |
| Cédula del representante | texto |
| Correo del representante | correo |
| Teléfono del representante | teléfono |
| Método | opciones: *Firmó en papel en la sede* / *Subir documento firmado* |
| Documento | archivo (solo si eligió subirlo) �?' bucket `consentimientos` |

Al guardar: insertar en `parental_consents` con `consent_type = 'account_creation'`, luego
actualizar `students.onboarding_status = 'completo'`.

**Si el disparador de la base rechaza el cambio**, muestra el error de LOPNNA y no continúes.
Ese rechazo es la red de seguridad: nunca lo desactives.

---

## 3. PANTALLAS DEL ESTUDIANTE

Navegación inferior fija, 4 botones grandes con icono y etiqueta:
**Carnet · Clases · Exámenes · Material**

### `/carnet` �?" pantalla de inicio
Es la pantalla más usada de la app. Debe cargar rápido y **funcionar sin internet**.

**El orden de las tarjetas no es negociable** (razón en `docs/13_` §9): las dos primeras son
del estudiante, la tercera es de la academia. Si el carnet va primero, la app se percibe como
un trámite.

**1 · Tarjeta «Próximo sábado»** �?" lo único accionable de la pantalla.
Datos de la vista `v_proximo_sabado`. Fondo `--zr-blue-light`, texto `--zr-navy`.
```
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", �Y". PR�"XIMO SÁBADO · 15 de agosto         �",
�", Semana 2 · Diagnóstico de batería        �",
�",                                          �",
�", Para llegar preparado:                   �",
�", Investiga los tipos de batería y cómo    �",
�", se mide su densidad.                     �",
�",                                  Ver �?� �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
```
Si no hay sesión próxima: *"No tienes clase programada por ahora."*
Si la guía no está digitalizada (`pre_practice_description` vacío): se muestra solo la fecha y
el módulo, **sin inventar texto**.

**2 · Tarjeta «Mi progreso»** �?" resumen, con enlace a `/progreso`.
```
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", �YZ� MI PROGRESO · Electricidad Automotriz �",
�", �-��-��-��-<  Dominas 2 de 4 competencias        �",
�",                              Ver todas �?� �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
```

**3 · El carnet propiamente dicho:**
- Foto o iniciales, nombre completo, cédula.
- Cohorte y módulo actual.
- **El código QR, grande, al menos el 60% del ancho**, con marco `--zr-navy`. Debajo, una barra
  que se vacía en 30 segundos y el código se regenera solo.
- Contador: *"Módulos aprobados: 3 de 13"*.
- Aviso en `--zr-warning` si hay consentimiento pendiente.

### `/progreso` �?" mapa de dominio
Lee de la vista `v_mi_dominio`. Muestra **todas** las competencias del módulo, incluidas las
que aún no tienen fila en `mastery_map` (salen como pendientes). Nunca una pantalla vacía.

```
M�"DULO 3 · ELECTRICIDAD AUTOMOTRIZ
Dominas 2 de 4 competencias

SEMANA 1
�o. Ley de Ohm aplicada
   Verificado en práctica de taller · 8 ago

SEMANA 2
�o. Diagnóstico de batería
   Verificado en práctica de taller · 15 ago

SEMANA 3
�Y"" Sistema de carga: alternador
   En progreso

SEMANA 4
�o Lectura de diagramas eléctricos
   Pendiente
```

Colores: `--zr-success` para dominado, `--zr-blue-mid` para en progreso, `--zr-border` para
pendiente. **Sin porcentajes, sin barras de nivel, sin puntos.** Es una lista de cosas que
sabes hacer, no un videojuego.

**Nunca muestres una comparación con otros estudiantes.** Ni promedio del grupo, ni posición.
El mapa es personal.

**Cómo se genera el QR:**
```ts
// El secreto se guardó cifrado al registrarse. No se pide de nuevo.
import { TOTP, Secret } from 'otpauth'
const totp = new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30 })
const codigo = `ZR1|${cedula}|${totp.generate()}`
```

Se regenera cada segundo para actualizar la barra; el código cambia cada 30.

### `/clases`
Lista de sesiones de la cohorte, la más reciente arriba.

Cada fila: fecha (`sáb 15 ago`), módulo, semana, y una insignia de estado:
�o. **Asististe** · �o **No registrada** · �Y.� **Próxima**.

Si la sesión está `cerrada` y no ha dado feedback, un botón: **Opinar sobre esta clase** �?'
`/feedback/[sessionId]`.

### `/examenes`
Solo exámenes con estado `habilitado`, `cerrado` o `calificado`.

Cada tarjeta: título, módulo, estado y acción.

| Estado del intento | Qué muestra |
|---|---|
| Sin empezar | Botón **Presentar examen** |
| En progreso | Botón **Continuar** + *"Empezaste hace X"* |
| Entregado, sin calificar | *"Entregado. Esperando calificación"* |
| Calificado | La nota, en grande: `16,5 / 20` en verde o rojo |

### `/examenes/[examId]`
**Una pregunta por pantalla.** Nunca todas juntas: en un teléfono es ilegible.

Arriba: barra de progreso `Pregunta 3 de 10`. Si el examen tiene límite, el tiempo restante.

Cuerpo según el tipo:
- **Opción múltiple:** tarjetas grandes, una por opción, tocables completas.
- **Verdadero/falso:** dos botones enormes, mitad y mitad de la pantalla.
- **Redacción abierta:** área de texto con contador de caracteres.

Abajo: **Anterior** y **Siguiente**. En la última pregunta, **Entregar examen** en ámbar, con
confirmación: *"¿Seguro? No podrás cambiar tus respuestas."*

**Guardado automático:** cada respuesta se guarda en `exam_answers` al cambiar de pregunta. Si
se cae la señal o se cierra la app, no se pierde nada.

Al entregar: llamar a `submit-attempt` y mostrar el resultado. Si quedan redacciones por
calificar, decir: *"Tu profesor calificará las preguntas abiertas."*

> **Lee las preguntas siempre de `v_exam_questions_student`.** Si consultas
> `exam_questions` directamente, la respuesta correcta viaja al navegador y el examen queda
> resuelto para cualquiera que abra las herramientas de desarrollo.

### `/contenido` y `/contenido/[moduleId]`
Lista de módulos con material. Dentro, agrupado por semana.

Cada elemento: icono según tipo, título, tamaño. Al tocar: visor de PDF con zoom, o descarga.
Al abrir, registrar en `content_views`.

### `/notas`
Tabla por módulo: nombre, teoría, práctica, participación, nota final, estado.
Debajo de la nota final, el umbral: *"Aprueba con 12"*.

### `/feedback/[sessionId]`
Máximo 3 preguntas, una debajo de otra, escala de 1 a 5 con caritas o estrellas grandes.
Debe responderse en menos de 20 segundos. Botón: **Enviar**.
Después: *"Gracias. Tu respuesta es anónima para tu profesor."* �?" y es verdad, la base lo
garantiza.

---

## 4. PANTALLAS DEL PROFESOR

### `/hoy` �?" pantalla de inicio
Lo que el profesor necesita el sábado a las 8 de la mañana, sin buscar nada:

1. **Tarjeta grande: la clase de hoy.** Cohorte, módulo, salón, cantidad de estudiantes.
   Botón enorme: **Abrir clase y pasar asistencia** �?' cambia la sesión a `abierta` y navega a
   `/escanear/[sessionId]`.
2. Contador: *"N exámenes por calificar"* �?' `/calificar`.
3. Resumen de la última sesión: cuántos asistieron de cuántos.

Si no hay clase hoy: *"No tienes clase programada hoy"* y un enlace a `/sesiones`.

### `/escanear/[sessionId]` �?" la pantalla crítica
Es la que se usa de pie, con una mano, apurado, mientras entran los estudiantes.

**Disposición:**
- **Arriba, 70% de la pantalla:** la cámara en vivo. Sin marcos decorativos.
- **Franja de resultado, muy grande:**
  - �o. Verde, nombre del estudiante en letra grande, más un pitido corto.
  - �s�️ Amarillo: *"Ya registrado"* (no es un error, no alarma a nadie).
  - �O Rojo, el motivo del catálogo de errores, más un pitido doble.
  - El resultado permanece 2 segundos y vuelve a escanear solo.
- **Abajo:** contador `Asistencia: 18 / 24`, un botón **Buscar por cédula** y el indicador de
  cola sin conexión.

**Modo refrigerio:** un interruptor arriba cambia entre *Asistencia* y *Refrigerio*. En modo
refrigerio, llama a `claim-snack` en vez de a `validate-scan`. Todo lo demás es igual.

**Sin conexión �?" obligatorio:**
```ts
// 1. Cada escaneo entra a IndexedDB con synced: false
// 2. Se intenta enviar de inmediato
// 3. Si falla por red, se queda en la cola y se muestra "N sin sincronizar"
// 4. Al volver la conexión (evento 'online'), se reintenta en orden
// 5. La respuesta { duplicate: true } cuenta como éxito y limpia la cola
```
El contador de pendientes **siempre visible**. El profesor tiene que poder ver de un vistazo
si algo quedó sin subir.

**Búsqueda por cédula (respaldo manual):** abre una lista de los estudiantes de la cohorte con
un buscador. Al elegir uno, pide obligatoriamente un motivo (*"olvidó el teléfono"*,
*"teléfono sin batería"*, *"otro"*) y registra con `method = 'manual'`. Queda auditado.

### `/sesiones`
Lista de sesiones de sus cohortes. Acciones: abrir, cerrar, reprogramar, ver asistencia.

### `/examenes`, `/examenes/nuevo`, `/examenes/[examId]/editar`
Constructor de exámenes. Datos del examen arriba; lista de preguntas debajo, reordenables.

Al agregar una pregunta se elige el tipo primero, y el formulario cambia:
- Opción múltiple: enunciado, de 2 a 6 opciones, marcar cuál es la correcta, puntos.
- Verdadero/falso: enunciado, cuál es la correcta, puntos.
- Redacción abierta: enunciado, rúbrica, puntos.

**Indicador permanente:** `Puntos asignados: 18 / 20`. En rojo si no cuadra.
El botón **Publicar examen** está deshabilitado mientras no sume exacto. Si aun así se
intenta, la base lo rechaza �?" esa es la garantía real.

### `/calificar`
Cola de redacciones abiertas sin puntaje, la más antigua primero.

Por cada una: enunciado, **la rúbrica siempre visible al lado**, la respuesta del estudiante,
un campo de puntaje (0 al máximo de la pregunta) y un campo de comentario.
Botones: **Guardar y siguiente**.

El nombre del estudiante se muestra; no es anónimo (a diferencia del feedback).

### `/notas/[cohortId]`
Tabla editable: una fila por estudiante, columnas teoría, práctica y participación.
Arriba, un control para el **peso de participación** de esa cohorte (mínimo 5%).
La nota final y el estado se muestran calculados, **en gris, no editables**: los calcula la
base de datos.

### `/contenido`
Subir material: archivo, título, módulo, semana, publicar ahora o en una fecha.

---

## 5. PANTALLAS DE ADMINISTRACI�"N

### `/panel`
Cuatro tarjetas con números grandes:
- Estudiantes activos
- **Consentimientos pendientes** (en rojo si hay alguno)
- Asistencia del último sábado
- Exámenes sin calificar

### `/estudiantes`
Tabla con buscador por nombre o cédula. Filtros: cohorte, estado, menores de edad.
Columnas: nombre, cédula, edad, cohorte, estado de registro, consentimiento.
Acciones: ver, editar, cambiar de cohorte, suspender.
Botones: **Nuevo estudiante** y **Cargar CSV**.

**Carga por CSV** �?" columnas exactas, en este orden:
```
nombre_completo,cedula,fecha_nacimiento,correo_contacto,telefono,cohorte
```
Antes de importar, muestra una vista previa con los errores marcados por fila. Nunca importes
a medias: o entra todo el archivo o no entra nada.

### `/consentimientos`
Cola de la vista `v_students_blocked`. Por cada menor: nombre, edad, si falta el consentimiento
o si falta verificarlo, el documento adjunto si lo hay, y el botón **Verificar**.

Esta pantalla es la que evita que la academia incumpla LOPNNA. Debe ser imposible de ignorar:
si hay pendientes, sale un aviso en `/panel`.

### `/cohortes`
Crear cohortes, asignar profesor y salón, avanzar de módulo, ver estudiantes.

**Avanzar de módulo** pide confirmación explícita, porque cambia el contenido y los exámenes
visibles de todo el grupo.

### `/reportes`
Cuatro reportes, todos con botón **Exportar a CSV**:
1. Asistencia por cohorte y por sesión.
2. Avance académico: aprobados, reprobados y en curso por módulo.
3. Uso del repositorio: qué material se abre y cuál no.
4. Exámenes pendientes de calificar, con antigüedad en horas.

### `/configuracion` �?" solo `super_admin`
Tabla editable de `system_config`. Por cada clave: descripción, valor actual, campo de edición
y quién la cambió por última vez. Debajo, el historial de cambios.

**Toda la aplicación lee de aquí.** Cambiar un umbral es editar una fila, no desplegar código.

---

## 6. LA PWA

**`app/manifest.ts`:**
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZR App · ZR Mecademy',
    short_name: 'ZR App',
    description: 'Plataforma académica de ZR Mecademy',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8FAFC',
    theme_color: '#1E3A5F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

**Service worker (`public/sw.js`):** guarda en caché el esqueleto de la app y la pantalla del
carnet. **No guarda en caché** exámenes ni contenido: deben estar frescos.

**Prueba obligatoria:** instalar la app en un Android y en un iPhone reales, y comprobar que
la cámara funciona en modo instalado. No basta con probarlo en el navegador de escritorio.

