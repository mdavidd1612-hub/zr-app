# MDV — IMPLEMENTACIÓN TÉCNICA, PARTE II

**Días 8 a 14 · Matriz completa de alternativas gratuitas · El porqué de cada decisión de ingeniería**

Continuación del documento de implementación. Al terminar el día 14, el sistema está en producción, medido, respaldado y con un ciclo de producción de contenido de cuatro horas por semana.

---

## 0. Dónde estamos y qué falta

| | Parte I (días 1-7) | Parte II (días 8-14) |
|---|---|---|
| Qué se construyó | El **motor académico**: compuertas, rúbricas, competencias, semana 1 completa | La **operación**: tutor, contenido de las semanas 2-4, medición, respaldos, continuidad |
| Estado al terminar | Un estudiante puede recorrer una semana de punta a punta | La academia puede sostener el modelo sin usted |

La diferencia entre ambas semanas es la que separa un piloto que funciona de un piloto que sobrevive.

---

## 1. El orden no es arbitrario: el grafo de dependencias

Antes del paso a paso, la lógica que lo ordena. Cada bloque solo puede construirse cuando existe el anterior, y saltarse el orden obliga a rehacer trabajo.

```
INFRAESTRUCTURA (día 1)
        │  sin servidor y cron no hay nada que probar
        ▼
ESCALA Y COMPETENCIAS (día 2)
        │  la rúbrica necesita saber contra qué competencia se califica
        ▼
RÚBRICAS Y LIBRO DE CALIFICACIONES (día 3)
        │  las compuertas restringen el acceso A las actividades del sábado:
        │  esas actividades deben existir primero
        ▼
COMPUERTAS (día 3, tarde)
        │  el contenido se diseña sabiendo qué debe desbloquear
        ▼
CONTENIDO SEMANA 1 (días 4-5)
        │  el tutor da pistas SOBRE un contenido que ya existe
        ▼
TUTOR DE IA (día 8)
        │  la medición mide un sistema que ya corre
        ▼
MEDICIÓN Y LÍNEA BASE (días 9-10)
        │  se respalda lo que ya tiene valor
        ▼
RESPALDO Y MONITOREO (día 11)
        │  se clona una semana que ya está validada
        ▼
SEMANAS 2-4 (días 12-13)
        ▼
ENSAYO GENERAL (día 14)
```

**Los tres errores de secuencia más caros**, por si alguien propone acelerar:

| Error tentador | Qué provoca |
|---|---|
| Producir contenido antes de definir rúbricas | El contenido enseña una cosa y la rúbrica evalúa otra. Hay que rehacer los videos |
| Configurar compuertas antes de crear las actividades del sábado | Las restricciones apuntan a nada y hay que rehacerlas una por una |
| Matricular estudiantes antes del ensayo general | La primera impresión se gasta una sola vez, y con este público no se recupera |

---

## 2. Matriz de alternativas gratuitas

Para cada función, las opciones reales, cuál elegir y **por qué**. Todo lo marcado como elegido tiene costo cero.

### 2.1 Núcleo académico

| Opción | Costo | Veredicto |
|---|---|---|
| **Moodle autoalojado** | 0 (software) + servidor | **Elegida.** Único con competencias, restricciones y rúbricas nativas |
| MoodleCloud | Plan gratuito muy limitado o de prueba | Descartada: sin control de plugins ni de la base de datos |
| Chamilo | 0 | Descartada: competencias más débiles, comunidad menor |
| Google Classroom | 0 | Descartada: no tiene compuertas por dominio ni rúbricas con nota de aprobación |
| Canvas Free for Teacher | 0 | Descartada: sin plugins ni acceso a base de datos |

### 2.2 Servidor

| Opción | Costo real | Veredicto |
|---|---|---|
| **VPS de gama baja** (Hetzner CX22, Contabo) | 5-8 USD/mes | **Elegida.** Es el único gasto y es despreciable |
| Oracle Always Free ARM | 0 | Alternativa válida. Ahora 2 OCPU / 12 GB. Contra: conseguir la instancia puede tomar días por falta de capacidad |
| PC de la academia con IP fija | 0 | Solo si tienen internet estable y UPS. El sábado no puede caerse |

**Por qué no recomiendo la opción de cero costo como primera:** el ahorro es de 70 dólares al año y el riesgo es perder el sábado de evaluación de una cohorte. La relación no cierra.

### 2.3 Contenido interactivo

| Opción | Costo | Veredicto |
|---|---|---|
| **H5P integrado en Moodle** | 0 | **Elegida.** Sin cuentas externas, con calificación y finalización nativas |
| Lumi Education (H5P de escritorio) | 0 | Complemento útil: permite crear sin conexión y subir el `.h5p` |
| Genially / Canva | Freemium | Descartadas para lo evaluable: no devuelven calificación a Moodle |
| Edpuzzle | Freemium con límite de videos | Descartada: H5P hace lo mismo sin límite ni cuenta externa |

### 2.4 Alojamiento de video

| Opción | Costo | Veredicto |
|---|---|---|
| **YouTube, no listado, incrustado en H5P** | 0 | **Elegida para las microlecciones.** Ancho de banda infinito, reproducción adaptativa en conexiones malas |
| Subir el MP4 a Moodle | 0 | Solo para clips cortos. Consume disco y el servidor sirve el video, que es su peor uso |
| PeerTube propio | 0 + servidor | Innecesario para el piloto |

**Por qué YouTube no listado y no público:** no aparece en búsquedas ni en el canal, pero cualquiera con el enlace lo ve. Para material técnico de la academia es el equilibrio correcto entre control y costo. Si algún día el contenido es propiedad sensible, se migra a video alojado.

**Regla de calidad:** el video del estudiante (evidencia de ejecución) **nunca** va a YouTube. Ese sube a Moodle, es dato personal de un menor y se queda en el servidor de la academia.

### 2.5 Tutor de IA

| Opción | Costo | Privacidad | Veredicto |
|---|---|---|---|
| **Enlace a un proyecto de Claude o GPT personalizado** | 0 | El estudiante usa su propia cuenta | **Elegida para el día 8.** Cero desarrollo, funciona esta semana |
| Groq / Google AI Studio + plugin de chat en Moodle | 0 dentro de límites | ⚠️ En capa gratuita los datos suelen usarse para entrenar | Elegida como fase 2, con las salvaguardas de la sección 4 |
| API de pago con el subsistema de IA de Moodle | ~3-8 USD/mes para 20 estudiantes | Sin entrenamiento sobre los datos | Recomendada desde el mes 2 |
| Ollama en el propio servidor | 0 | Total | Requiere 16 GB de RAM y una GPU decente para ser usable. No en este piloto |

### 2.6 Simulación

| Opción | Costo | Uso |
|---|---|---|
| **H5P Branching Scenario** | 0 | **Elegida.** El caso de diagnóstico con decisiones y consecuencias |
| **Falstad Circuit Simulator** | 0 | Circuitos eléctricos; se enlaza con el circuito precargado en la URL |
| **CircuitVerse** | 0 | Lógica y circuitos, con proyectos guardables |
| **Tinkercad Circuits** | 0 | Electrónica básica y Arduino |
| Electude u otro comercial | Licencia | Se decide **después** del piloto, con el dato de cuántas simulaciones hicieron falta |

### 2.7 Encuestas, votación en vivo y asistencia

| Función | Elegida | Por qué |
|---|---|---|
| Duda obligatoria del miércoles | **Feedback de Moodle** | Queda en el expediente, exporta a Excel y alimenta la finalización |
| Votación anónima en la clínica | **Encuesta de Moodle** o Mentimeter gratuito | Wooclap es mejor pero es de pago; la encuesta nativa cubre el 80 % |
| Asistencia del sábado | **`mod_attendance` con QR** | Gratuito, genera el informe de asistencia por sesión |
| Videollamada del jueves | **Google Meet o Jitsi**, enlazado como URL | BigBlueButton propio consume más servidor del que tenemos |

### 2.8 Repaso espaciado

| Opción | Costo | Veredicto |
|---|---|---|
| **Anki + mazo compartido en AnkiWeb** | 0 | **Elegida.** Repetición espaciada real, funciona sin conexión |
| Cuestionario semanal reabierto en Moodle | 0 | Respaldo para quien no instale Anki. Produce buena parte del efecto |
| Quizlet | Freemium | Descartada: las funciones útiles quedaron tras el muro de pago |

### 2.9 Respaldo, correo y monitoreo

| Función | Elegida | Límite gratuito |
|---|---|---|
| Respaldo fuera del servidor | **rclone → Backblaze B2** o Cloudflare R2 | Alrededor de 10 GB gratuitos; verificar el plan vigente al contratar |
| Correo saliente | **Brevo** (antes Sendinblue) | ~300 correos al día, suficiente para 60 estudiantes |
| Monitoreo | **Uptime Kuma** en el mismo servidor, o UptimeRobot | Gratuito |
| Certificado HTTPS | **Caddy + Let's Encrypt** | Gratuito y automático |

---

## 3. Día 8 — El tutor de IA, bien hecho

### 3.1 Arquitectura y el porqué

Un chatbot conectado directo desde el navegador del estudiante a una API tiene tres defectos graves: expone la clave, no permite cambiar de proveedor y no registra nada. La arquitectura correcta, incluso en su versión gratuita, es:

```
Estudiante  →  Moodle (enlace)  →  Proxy propio  →  Proveedor A (principal)
                                        │              Proveedor B (respaldo)
                                        └─→ registro anónimo de uso
```

El proxy son unas ochenta líneas y se despliega gratis en Cloudflare Workers. Sus tres funciones:

1. **Guardar la clave.** Nunca puede estar en el frontend ni en Moodle.
2. **Inyectar las instrucciones del docente.** Así el estudiante no puede pedirle al tutor que ignore sus reglas: las reglas viajan en cada petición, del lado del servidor.
3. **Cambiar de proveedor sin tocar nada más.** Es la respuesta al riesgo real de las capas gratuitas: los modelos gratuitos desaparecen sin aviso.

### 3.2 Las tres reglas de privacidad, no negociables

Estamos tratando con menores de edad y con capas gratuitas que habitualmente entrenan sobre lo que reciben.

1. **Ningún dato personal viaja al proveedor.** Ni nombre, ni cédula, ni correo, ni identificador de Moodle. El proxy envía un identificador de sesión aleatorio y nada más.
2. **El registro de conversaciones se guarda en nuestro servidor**, no en el del proveedor, y solo con ese identificador anónimo. Sirve para saber qué preguntan, no quién pregunta.
3. **La política institucional de IA declara qué proveedor se usa y qué se envía.** Es un párrafo, y es lo que hace defendible el sistema ante un padre que pregunte.

Cuando pasen a API de pago —tres a ocho dólares al mes para el grupo piloto— la primera regla sigue vigente, pero desaparece el problema del entrenamiento sobre los datos. **Esa es la razón real para pagar, no la calidad del modelo.**

### 3.3 Paso a paso

1. Crear cuenta en el proveedor principal (Google AI Studio o Groq: ninguno pide tarjeta) y obtener la clave.
2. Crear cuenta en un segundo proveedor. **El respaldo se configura ahora, no el día que falle.**
3. Desplegar el proxy en Cloudflare Workers con la clave como variable de entorno secreta.
4. Pegar las instrucciones del tutor (están en la Parte I, sección 6.2) y el bloque de pistas de la semana 1.
5. Enlazarlo en Moodle como recurso `URL`, en la sección 0, con apertura en ventana nueva.
6. **Prueba de aceptación:** pedirle el diagnóstico tres veces seguidas, con insistencia y con excusa de urgencia. Si cede una sola vez, endurecer las instrucciones y repetir. No se pasa al día 9 hasta que resista.

---

## 4. Días 9 y 10 — Medición y línea base

Aquí se juega la credibilidad del piloto ante la dirección. Sin línea base, dentro de doce semanas no van a poder demostrar nada.

### 4.1 Lo que hay que capturar antes de arrancar

| Instrumento | Cuándo | Cómo | Por qué |
|---|---|---|---|
| **Prueba práctica común** | Antes de la semana 1, a los dos grupos | Misma tarea, misma lista de cotejo, mismo evaluador | Es la única comparación limpia entre el grupo piloto y el de control |
| **Cuestionario de conocimientos previos** | Igual | Cuestionario de Moodle, presencial | Permite calcular el cambio, no solo el resultado final |
| **Encuesta de motivación** | Igual | Encuesta de Moodle, anónima, 6 a 8 ítems | Se repite al cierre. Detecta la caída esperable de las primeras semanas |
| **Datos históricos del módulo** | Ahora | Exportar de Odoo la reprobación de las tres cohortes anteriores | Contexto sin el cual cualquier resultado es discutible |

### 4.2 La encuesta de motivación, seis ítems

Escala de 1 a 5. Se aplica en la semana 0, la 6 y la 12.

1. Siento que estoy aprendiendo algo que voy a usar en un taller real.
2. Sé exactamente qué me falta para dominar lo que estoy estudiando.
3. Cuando me equivoco, sé qué hacer para corregirlo.
4. Puedo decidir cosas sobre mi propio aprendizaje.
5. Si me esfuerzo más, mi resultado mejora.
6. Me siento parte de un grupo que trabaja junto.

Los ítems 2, 3 y 5 son los que este modelo debería mover primero. Si a la semana 6 no se movieron, algo está mal implementado, no mal diseñado.

### 4.3 Configuración de los informes

Crear en `Informes configurables` los ocho indicadores de la Parte I y **programar el envío por correo cada lunes** a coordinación. Un informe que hay que ir a buscar no se mira; uno que llega al correo, sí.

---

## 5. Día 11 — Respaldo, continuidad y monitoreo

La regla: **un respaldo que no se ha restaurado nunca no es un respaldo.**

### 5.1 Respaldo automático

```bash
# /opt/mdv/backup.sh
#!/bin/bash
set -e
FECHA=$(date +%F)
DEST=/opt/mdv/backups

# 1. Base de datos
docker exec mdv-mariadb-1 mysqldump -u root -p"$DB_PASS" \
  --single-transaction moodle | gzip > $DEST/db-$FECHA.sql.gz

# 2. Archivos de usuario (moodledata)
tar czf $DEST/data-$FECHA.tar.gz -C /var/lib/docker/volumes/mdv_moodledata/_data .

# 3. Copia fuera del servidor
rclone copy $DEST remoto:academia-backups/

# 4. Retención: 14 días local, 90 en la nube
find $DEST -type f -mtime +14 -delete
```

```
0 3 * * * /opt/mdv/backup.sh >> /var/log/mdv-backup.log 2>&1
```

**Prueba obligatoria del día 11:** levantar un segundo contenedor limpio, restaurar el respaldo de anoche y entrar. Hasta que eso funcione, el sistema no está listo para tener datos reales de estudiantes.

### 5.2 Monitoreo

Instalar Uptime Kuma en el mismo servidor y configurar dos comprobaciones: el sitio responde, y el cron corrió en las últimas dos horas. Alerta a WhatsApp o Telegram.

**Por qué importa concretamente:** si el cron se detiene un viernes, el sábado a las ocho de la mañana ninguna insignia estará otorgada, nadie estará habilitado y la jornada se cae. Es el fallo más probable y el más fácil de detectar a tiempo.

### 5.3 Plan de contingencia del sábado

Un documento de una página, impreso y en el taller:

| Si falla | Qué se hace |
|---|---|
| Internet del taller | El control de entrada se aplica en papel. Las listas impresas ya están, se digitalizan el lunes |
| El servidor | Igual que arriba. La jornada nunca depende de la plataforma |
| La tablet del instructor | Listas de cotejo impresas de respaldo, una por estudiante |

**La regla pedagógica que esto protege:** la jornada del sábado ocurre pase lo que pase. La tecnología acelera el registro, no lo condiciona.

---

## 6. Días 12 y 13 — Las semanas 2, 3 y 4

Aquí la ingeniería ya está hecha y empieza la producción. Por eso son solo dos días.

### Procedimiento de clonado

1. `Curso › Más › Reutilizar curso › Importar` y seleccionar la sección de la semana 1.
2. Renombrar la sección y las actividades siguiendo la convención `[N#] X.Y Nombre`.
3. Sustituir el video de cada H5P y sus preguntas incrustadas.
4. Sustituir las preguntas del banco de la semana.
5. Ajustar la rúbrica: **solo los ítems ★ cambian** según lo que mata o cuesta caro en esa competencia.
6. Crear la insignia `Habilitado — Semana N` y repuntar las restricciones a esa insignia.
7. Vincular las competencias correspondientes a la evaluación de desempeño.

**El paso que más se olvida es el 6.** Una restricción que sigue apuntando a la insignia de la semana anterior deja pasar a todo el mundo, y nadie lo nota hasta que ya pasó.

### Presupuesto de tiempo, ya en régimen

| Tarea | Primera vez | En régimen |
|---|---|---|
| Semana completa de un módulo | 8-10 h | **3-4 h** |
| Módulo entero de 4 semanas | 30-40 h | 12-16 h |
| Especialidad nueva (industrial, petrolera) | — | 1 jornada por módulo |

Estas horas van dentro de la carga docente contratada. Es la condición que la dirección ya aprobó y la que sostiene todo el proyecto.

---

## 7. Día 14 — Ensayo general

No se abre a los estudiantes sin esto. Tres personas del equipo hacen el recorrido completo, con cuentas de estudiante de prueba, en dispositivos propios y con datos móviles.

### Guion del ensayo

| # | Acción | Criterio de aceptación |
|---|---|---|
| 1 | Recibir el correo de bienvenida y entrar | Llega en menos de 2 minutos y el enlace funciona |
| 2 | Abrir la app móvil e iniciar sesión | Ve el curso y la semana 1 |
| 3 | Ver la microlección 1 y fallar la pregunta incrustada | El video **devuelve el fragmento** y vuelve a preguntar |
| 4 | Completar las tres microlecciones y la simulación | El progreso avanza visiblemente |
| 5 | Intentar abrir la evaluación del sábado | **No aparece.** Aparece la actividad de refuerzo |
| 6 | Escribir la duda del miércoles | Queda registrada y exporta a Excel |
| 7 | Aprobar el autochequeo del viernes | La insignia se otorga sola tras el cron |
| 8 | Volver a entrar | Ahora sí aparece la evaluación del sábado y desaparece el refuerzo |
| 9 | El instructor califica la rúbrica dejando un ★ en cero | Da 80 y aparece como **reprobada** |
| 10 | Reintento con todo correcto | Sustituye la nota, **sin penalización** |
| 11 | Marcar la competencia como Dominada | Aparece en verde en el pasaporte del estudiante |
| 12 | Subir un video de 60 segundos con datos móviles | Sube en menos de 2 minutos |
| 13 | Revisar el total del curso | El carril abierto **no aporta puntos** |
| 14 | Insistirle al tutor de IA para que dé la respuesta | Se niega las tres veces |
| 15 | Restaurar el respaldo en un contenedor limpio | El sitio levanta con los datos de ayer |

**Si algún punto falla, se corrige antes de matricular. Ninguno es opcional**, y el 5, el 9 y el 14 son los que definen si el modelo existe de verdad o solo está escrito.

---

## 8. Los riesgos de lo gratuito, y cuándo dejar de serlo

Ser honestos sobre esto ahora evita una crisis en el mes tres.

| Componente gratuito | Riesgo real | Señal de que hay que pagar | Costo al pagar |
|---|---|---|---|
| Capa gratuita de LLM | El modelo desaparece o cambian los límites sin aviso; los datos entrenan al proveedor | Cortes en el tutor, o la primera pregunta seria sobre privacidad | 3-8 USD/mes |
| Servidor gratuito | Capacidad no garantizada, terminación por exceder límites | Cualquier caída en horario de clase | 5-8 USD/mes |
| YouTube para las microlecciones | Cambios de política, publicidad, distracción | Si aparecen anuncios en material de clase | Alojamiento propio |
| Correo por Brevo | Límite diario al crecer | Al pasar de 60 estudiantes | ~15 USD/mes |
| Almacenamiento de respaldos | Los 10 GB gratuitos se llenan con los videos | Al mes 4 aproximadamente | ~1 USD/mes por 20 GB |

**Presupuesto realista en régimen: entre 15 y 25 dólares al mes** para toda la operación. Vale la pena decirlo así en la próxima reunión con la dirección general, porque es una cifra que nadie va a discutir y evita la conversación de "esto era gratis y ahora cuesta".

---

## 9. Lo que queda funcionando para siempre

Al cerrar el día 14, la academia tiene un sistema con estas propiedades:

**Se sostiene solo.** Las compuertas se abren y se cierran sin que nadie las administre. Las insignias se otorgan por cron. Los informes llegan por correo cada lunes.

**Se replica.** Una especialidad nueva es un CSV de competencias, casos nuevos y ítems críticos nuevos. El núcleo no se toca. Formación industrial y petrolera entran sin rediseñar nada.

**Se puede auditar.** Cada competencia dominada tiene fecha, número de intentos, rúbrica firmada y un video de sesenta segundos donde el estudiante explica lo que hizo. Eso es defendible ante una empresa, ante un acreditador y ante un padre.

**No depende de una plataforma.** Todo es exportable: los cursos como archivos `.mbz`, las competencias como CSV, las calificaciones como hoja de cálculo, las insignias como Open Badges. Si algún día construyen su propia aplicación, Moodle queda detrás como motor y nada de este trabajo se pierde.

**El trabajo semanal es contenido, no ingeniería.** Tres o cuatro horas por semana de módulo, hechas por un instructor, no por un desarrollador.

---

## 10. Checklist maestro de las dos semanas

**Semana 1 — el motor**
- [ ] Servidor, HTTPS, cron verificado
- [ ] Escala de dominio y marco de competencias importado
- [ ] Plantilla de plan de aprendizaje asignada a la cohorte
- [ ] Rúbrica con 4 ítems críticos de 20 puntos y nota de aprobación 81
- [ ] Guía de evaluación de la defensa con las 10 preguntas precargadas
- [ ] Libro de calificaciones con los pesos y el carril abierto excluido
- [ ] Insignia `Habilitado — Semana 1` automática
- [ ] Restricciones de acceso y actividad de refuerzo paralela
- [ ] Semana 1 completa: 3 microlecciones, simulación, duda, autochequeo, control de entrada, desempeño, defensa, ticket

**Semana 2 — la operación**
- [ ] Tutor de IA con proxy, proveedor de respaldo y sin datos personales
- [ ] Prueba de resistencia del tutor superada
- [ ] Línea base capturada en ambos grupos
- [ ] Encuesta de motivación aplicada
- [ ] Ocho informes creados y programados por correo
- [ ] Respaldo automático **y restauración probada**
- [ ] Monitoreo con alerta de cron
- [ ] Plan de contingencia del sábado impreso y en el taller
- [ ] Semanas 2, 3 y 4 clonadas, con insignias y restricciones repuntadas
- [ ] Ensayo general de 15 pasos, sin fallos
- [ ] Estudiantes matriculados por CSV y correo de bienvenida enviado

---

## Cierre

La ingeniería de este sistema cabe en dos semanas por una única razón: **no estamos construyendo software, estamos configurando reglas.** Cada decisión del modelo pedagógico —dónde nace la nota, qué no promedia, qué desbloquea qué— tiene una expresión exacta en una casilla de configuración. Ese es el motivo por el que funciona con presupuesto casi cero y por el que puede replicarse a otra especialidad en una jornada.

Lo único que no se puede configurar, y lo único que realmente decide si esto funciona, es la calidad de los casos del taller y de las preguntas de defensa. Ahí es donde debe ir el tiempo de sus mejores instructores, y ahora lo tienen libre porque no lo están gastando en repetir teoría los sábados.
