# MDV — IMPLEMENTACIÓN TÉCNICA LOW-CODE

**Construcción completa del sistema en 7 días · Moodle 5.1 + H5P + tutor de IA · Todo el software es gratuito**

Documento de ingeniería. Al terminar esta semana, lo único pendiente es cargar contenido.

---

## 0. Principio de arquitectura

> **No se programa el motor académico. Se configura.**

Todo lo que diseñamos —compuertas, dominio con ítems críticos, pasaporte de competencias, niveles de IA, evidencia en video, analítica— ya existe como funcionalidad nativa de Moodle 5.1. Lo que hay que hacer no es desarrollarlo: es **conectarlo correctamente**.

Regla de oro para toda la semana: **si una regla del modelo se puede expresar como una condición en Moodle, se configura ahí. Nunca en el frontend, nunca en un documento, nunca en la memoria del instructor.**

### Por qué Moodle y no una app propia desde cero

| Necesidad del modelo | Existe nativo en Moodle | Costo de construirlo desde cero |
|---|---|---|
| Compuerta de acceso condicional | Restricción de acceso | 2-3 semanas + pruebas |
| Ítems críticos que no promedian | Rúbrica + nota para aprobar | 1-2 semanas |
| Pasaporte de competencias con estados | Marcos de competencias + planes de aprendizaje | 4-6 semanas |
| Reintentos sin penalización | Intentos múltiples + método de calificación | 1 semana |
| Evidencia en video | Tarea con envío de archivo | 1 semana + almacenamiento |
| Niveles de IA por actividad | Ajustes de IA por curso y actividad (5.1) | 2 semanas |
| Integridad de notas y respaldos | Núcleo probado | Riesgo legal permanente |

Total: entre tres y cuatro meses de desarrollo, más la responsabilidad de que ningún error borre la calificación de un estudiante. Eso se evita configurando.

### Versión a instalar

**Moodle 5.1.x**, no 5.2. Moodle 5.2 salió en abril de 2026, pero 5.1 es donde todos los plugins que vamos a usar ya están estables y probados. La actualización a 5.2 se hace después del piloto, no durante.

---

## 1. Infraestructura (Día 1, mañana)

### 1.1 Dos caminos de hosting

| | **Camino A — Gratuito** | **Camino B — Recomendado para el piloto** |
|---|---|---|
| Qué es | Oracle Cloud Always Free, instancia ARM Ampere A1 | VPS de bajo costo (Hetzner CX22, Contabo, DigitalOcean) |
| Recursos | 2 OCPU / 12 GB RAM / 200 GB (límite recortado en junio de 2026) | 2 vCPU / 4-8 GB / 40-80 GB |
| Costo | 0 | 6 a 12 USD al mes |
| Riesgo real | Aprovisionar ARM suele fallar por falta de capacidad regional; puede tomar días conseguir la instancia | Ninguno, se levanta en 5 minutos |
| Veredicto | Válido si tienen tiempo y paciencia | **Elijan este si arrancan esta semana.** 10 dólares al mes no justifican perder dos días |

Con 20 a 60 estudiantes, cualquiera de los dos sobra. El cuello de botella será el almacenamiento de videos, no el CPU.

### 1.2 Instalación

La vía más rápida y con menos superficie de error es Docker. En un servidor Ubuntu 24.04 limpio:

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Estructura
mkdir -p /opt/mdv && cd /opt/mdv
```

`docker-compose.yml`:

```yaml
services:
  mariadb:
    image: mariadb:11.4
    environment:
      MARIADB_ROOT_PASSWORD: CAMBIAR_ESTA
      MARIADB_DATABASE: moodle
      MARIADB_USER: moodle
      MARIADB_PASSWORD: CAMBIAR_ESTA_TAMBIEN
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --innodb-file-per-table=1
    volumes: [db:/var/lib/mysql]
    restart: unless-stopped

  moodle:
    image: bitnami/moodle:5.1
    depends_on: [mariadb]
    environment:
      MOODLE_DATABASE_HOST: mariadb
      MOODLE_DATABASE_NAME: moodle
      MOODLE_DATABASE_USER: moodle
      MOODLE_DATABASE_PASSWORD: CAMBIAR_ESTA_TAMBIEN
      MOODLE_USERNAME: admin
      MOODLE_PASSWORD: CAMBIAR_ADMIN
      MOODLE_SITE_NAME: "Academia — Plataforma de competencias"
      MOODLE_LANG: es
    ports: ["80:8080", "443:8443"]
    volumes: [moodle:/bitnami/moodle, moodledata:/bitnami/moodledata]
    restart: unless-stopped

volumes: { db: , moodle: , moodledata: }
```

```bash
docker compose up -d          # 5 a 10 minutos la primera vez
```

**Cron: sin esto no funcionan las compuertas ni las insignias automáticas.** Es el error número uno en instalaciones nuevas.

```bash
# crontab -e
* * * * * docker exec mdv-moodle-1 php /opt/bitnami/moodle/admin/cli/cron.php >/dev/null 2>&1
```

### 1.3 Dominio y HTTPS

Apunten un subdominio (`aula.suacademia.com`) al servidor y pongan Caddy delante, que resuelve el certificado solo:

```
aula.suacademia.com {
    reverse_proxy localhost:8080
}
```

HTTPS no es opcional: sin él, la app móvil oficial no se conecta y la grabación de video desde el navegador queda bloqueada.

### 1.4 Ajustes de sitio del primer día

| Ruta | Ajuste | Valor |
|---|---|---|
| Administración del sitio › Servidor › Sesiones | Duración de sesión | 8 horas (para que el sábado nadie se desconecte a media evaluación) |
| Seguridad › Políticas del sitio | Tamaño máximo de archivo subido | 100 MB |
| Apariencia › Temas › Boost | Color de marca | El de la academia |
| Idioma | Idioma por defecto | Español · desactivar menú de idiomas |
| Servidor › Correo | SMTP | Cuenta de Gmail o Brevo (gratis hasta 300 correos/día) |
| Cuentas › Políticas de usuario | Autoregistro | **Desactivado.** Matriculación solo por CSV |

---

## 2. Estructura académica (Día 2)

### 2.1 Escala de dominio

`Administración del sitio › Calificaciones › Escalas › Añadir una escala nueva`

```
Nombre: Dominio MDV
Escala: Requiere refuerzo, En desarrollo, Dominada
```

El orden importa: Moodle lee de menor a mayor. **Al crear el marco de competencias se define "Dominada" como el único valor que marca competencia lograda.**

### 2.2 Marco de competencias (el pasaporte)

`Administración del sitio › Competencias › Marcos de competencias › Importar`

Archivo CSV listo para subir (`marco-automotriz.csv`):

```csv
parentidnumber,idnumber,shortname,description,descriptionformat,scalevalues,scaleconfiguration,ruletype,ruleoutcome,ruleconfig,relatedidnumbers,exportid,isframework,taxonomy
,AUTO-CARGA,Sistema de carga y arranque,Módulo piloto,1,,,,0,,,,1,competency
AUTO-CARGA,C1,Seguridad y preparación del puesto,Aplica el protocolo de seguridad eléctrica antes de intervenir,1,,,,0,,,,0,competency
AUTO-CARGA,C2,Uso de instrumentos de medición,Selecciona función escala y punto de conexión correctos,1,,,,0,,,,0,competency
AUTO-CARGA,C3,Evaluación del estado de batería,Decide si es apta recuperable o debe reemplazarse,1,,,,0,,,,0,competency
AUTO-CARGA,C4,Interpretación de diagramas,Ubica puntos de prueba a partir del diagrama y la especificación,1,,,,0,,,,0,competency
AUTO-CARGA,C5,Pruebas de caída de tensión,Ejecuta e interpreta caída en carga arranque y masa,1,,,,0,,,,0,competency
AUTO-CARGA,C6,Diagnóstico del alternador,Diagnostica por tensión regulada rizado y corriente de salida,1,,,,0,,,,0,competency
AUTO-CARGA,C7,Detección de consumo parásito,Localiza el consumo por división de circuitos,1,,,,0,,,,0,competency
AUTO-CARGA,C8,Reparación y verificación,Ejecuta la reparación y verifica que la falla quedó resuelta,1,,,,0,,,,0,competency
AUTO-CARGA,C9,Comunicación técnica con cliente,Explica el diagnóstico y justifica el costo sin tecnicismos,1,,,,0,,,,0,competency
```

Tras importar, en el marco: **Escala = Dominio MDV**, y en su configuración marcar `Dominada` como *competente* y como valor por defecto.

> Para replicar a formación industrial o petrolera, se duplica este CSV, se cambian los nueve renglones y se importa. Quince minutos por especialidad.

### 2.3 Plantilla de plan de aprendizaje

`Competencias › Plantillas de planes de aprendizaje › Añadir`

- Nombre: `Pasaporte — Sistema de carga`
- Añadir las nueve competencias
- `Plantilla en uso`: sí
- Asignar a la **cohorte** del grupo piloto (no a usuarios sueltos: así los nuevos matriculados lo reciben automáticamente)

Esto genera, para cada estudiante, la pantalla del pasaporte con los tres estados. **No hay que programar nada:** es la vista `Competencias` de su perfil.

### 2.4 Estructura del curso

`Crear curso › Formato: Temas` (o *Mosaico* si instalan `format_tiles`, que se ve mucho mejor en celular).

Convención de nombres — respétenla, porque de ella dependen los informes:

```
SECCIÓN 0 · Cómo funciona este curso
   [Página] Las 3 reglas · [Página] Política de IA · [URL] Tutor de IA

SECCIÓN 1 · Semana 1 — Seguridad, medición y batería
   [N1] 1.1 Micro · Riesgos del sistema de 12 V          (H5P)
   [N1] 1.2 Micro · Secuencia de desconexión             (H5P)
   [N1] 1.3 Micro · El multímetro                        (H5P)
   [N2] 1.4 Simulación · Cuatro baterías                 (H5P Branching)
   [N2] 1.5 Tu duda de la semana                         (Feedback)
   [N0] 1.6 Clínica del jueves 19:00                     (URL)
   [N0] 1.7 Autochequeo — cierra viernes 22:00           (Cuestionario)
   ── SÁBADO ──
   [N0] 1.8 Control de entrada                           (Cuestionario)
   [N0] 1.9 Evaluación de desempeño                      (Tarea + rúbrica)
   [N0] 1.10 Defensa técnica                             (Tarea + rúbrica)
   [N0] 1.11 Ticket de salida                            (Feedback)
```

El prefijo `[N0]`–`[N4]` es visible para el estudiante y es la mitad de la política de IA. La otra mitad es técnica (sección 6).

---

## 3. Las tres compuertas, configuradas (Día 3)

Esta es la sección más importante del documento. Aquí es donde el modelo deja de ser un documento y se vuelve un sistema.

### 3.1 Compuerta A — Acceso al taller

**Paso 1. Finalización de actividad en cada pieza del carril abierto.**

En cada H5P (`Editar ajustes › Finalización de actividad`):

```
Añadir requisitos
  ☑ Ver la actividad
  ☑ Recibir una calificación → Calificación de aprobado
Se espera finalizado en: viernes 22:00
```

En el cuestionario del viernes:
```
Calificación para aprobar: 60
Finalización: ☑ Recibir calificación de aprobado
Intentos permitidos: sin límite
Método de calificación: calificación más alta
```

> El cuestionario del viernes tiene intentos ilimitados **a propósito**. No es una evaluación: es una compuerta. Queremos que insista hasta que lo entienda, no que lo intente una vez y se resigne.

**Paso 2. Insignia automática = lista de habilitados.**

`Curso › Más › Insignias › Añadir una insignia nueva`

```
Nombre: Habilitado — Semana 1
Criterio: Finalización de actividad
  → seleccionar las 7 actividades del carril abierto
  → "Todas las actividades seleccionadas deben completarse"
```

El instructor abre `Insignias › Habilitado Semana 1 › Destinatarios` el sábado a las 07:50 y tiene la lista, en el celular, sin abrir una hoja de cálculo. **Esa es la compuerta operando.**

**Paso 3. Restricción sobre el material del sábado.**

En las actividades 1.9 y 1.10 (`Restringir acceso`):

```
Restricción por: Insignia otorgada → "Habilitado — Semana 1"
  👁 (ojo tachado) → la actividad no aparece si no cumple
```

Y una actividad paralela para los bloqueados:

```
[N1] 1.9b Refuerzo — primera hora del sábado
Restricción: NO tener la insignia "Habilitado — Semana 1"
```

Resultado: cada estudiante abre la app el sábado y ve **una sola cosa**, la que le corresponde. Nadie tiene que explicarle la regla.

### 3.2 Compuerta B — Dominio con ítems críticos

Moodle no puede reprobar automáticamente por un criterio suelto. Pero sí se puede hacer que **sea aritméticamente imposible aprobar sin los críticos**. Ese es el truco de configuración clave de todo este documento.

Actividad `1.9 Evaluación de desempeño`:

```
Tipo: Tarea
Tipos de envío: ☐ (ninguno — la evidencia es presencial)
Calificación: Punto, máximo 100
Calificación para aprobar: 81        ← el número que hace todo el trabajo
Método de calificación: Rúbrica
Intentos permitidos: sin límite
Reapertura: manual
Calificación a aplicar: calificación más alta
```

Rúbrica (`Calificación avanzada › Definir rúbrica`), 12 criterios, dos niveles cada uno:

| Criterio | Nivel 0 | Nivel 1 | Puntos |
|---|---|---|---|
| ★ 1. Retira anillos y aplica EPP | No | Sí | **0 / 20** |
| ★ 2. Desconecta el negativo primero | No | Sí | **0 / 20** |
| ★ 3. Selecciona función y escala correctas | No | Sí | **0 / 20** |
| ★ 4. Formula ≥2 hipótesis antes del veredicto | No | Sí | **0 / 20** |
| 5 a 12. (ocho criterios no críticos) | No | Sí | 0 / 2,5 cada uno |

Aritmética: total posible 100. Los cuatro críticos suman 80, los ocho restantes 20.

- Falla **un solo crítico** → máximo alcanzable 80 → **por debajo de 81 → reprobado automáticamente**.
- Con los cuatro críticos correctos, necesita al menos uno de los ocho restantes para llegar a 82,5.

La regla del modelo queda escrita en la aritmética de la rúbrica, no en la buena memoria del instructor. Y el estudiante ve exactamente por qué reprobó.

**El registro autoritativo, sin embargo, es la competencia.** En `1.9 › Competencias del curso`:

```
Competencias vinculadas: C1, C2, C3
Al completar la actividad: "Adjuntar evidencia" + "Enviar para revisión"
```

El instructor califica la rúbrica en la tablet y luego, en la vista de competencias del estudiante, marca `Dominada`. Ese es el sello del pasaporte.

### 3.3 Compuerta C — Defensa

Actividad `1.10 Defensa técnica`:

```
Tipo: Tarea · sin envío
Calificación: Escala → crear escala "Defensa: Insuficiente, En desarrollo, Competente, Dominio"
Calificación para aprobar: Competente (nivel 3)
Método: Guía de evaluación (marking guide), con los 4 descriptores
```

En la guía de evaluación, el campo **"Comentarios frecuentes"** se precarga con las diez preguntas del banco: el instructor las tiene delante en la tablet y marca las tres que sorteó.

### 3.4 Libro de calificaciones

`Curso › Calificaciones › Configuración › Añadir categoría`

| Categoría | Peso | Contiene |
|---|---|---|
| Carril abierto | **0 %** | Todos los H5P y el autochequeo (excluidos del cálculo) |
| Control de entrada | 15 % | Cuestionarios del sábado |
| Desempeño | 45 % | Tareas 1.9 |
| Defensa | 20 % | Tareas 1.10 |
| Caso nuevo | 15 % | Sábado de cada 4 |
| Retención sin IA | 5 % | Semanas 6 y 12 |

Para el carril abierto: en cada ítem, `Editar ajustes › Excluir de la calificación`. Aparecen en el informe del estudiante como progreso, no como nota. **Es exactamente el mensaje que queremos: esto cuenta, pero no puntúa.**

---

## 4. El contenido: plantillas que solo se rellenan (Días 4 y 5)

### 4.1 Microlecciones — H5P

`Añadir actividad › H5P` (el `Banco de contenido` del curso guarda los originales reutilizables).

Tipo de contenido: **Interactive Video**.

Receta fija para las tres microlecciones de cada semana:

```
Video de 6 a 9 minutos (subido o YouTube no listado)
  ↳ minuto 3:00  → Pregunta de opción múltiple
                   ☑ Requerir respuesta antes de continuar
                   ☑ Volver a ver el fragmento si falla  (Retry / Again)
  ↳ minuto 6:30  → Pregunta de arrastrar y soltar o texto libre
  ↳ final        → Summary con las 3 ideas de la lección

Ajustes: ☑ Enviar puntuación al libro de calificaciones
         ☑ Permitir reintentos
```

**La configuración que hace la diferencia** es *volver a ver el fragmento si falla*. Es la que convierte el video en aprendizaje en lugar de reproducción. Si se olvida, el modelo pierde la mitad de su efecto en el carril abierto.

Segundo tipo que van a usar: **Branching Scenario** para el caso simulado del miércoles. El estudiante toma decisiones y llega a finales distintos, con una rama que le devuelve el caso cuando su conclusión no explica el síntoma.

### 4.2 Cuestionarios

Un solo banco de preguntas por módulo, con categorías:

```
Banco de preguntas
  ├── S1 · Control de entrada
  ├── S1 · Autochequeo
  ├── S1 · Retención diferida
  └── ... (por semana)
```

Control de entrada (sábado):

```
Método de calificación: primer intento
Intentos: 1
Comportamiento: Retroalimentación diferida
Orden: al azar · Preguntas al azar de la categoría (8 de un banco de 20)
Contraseña: la dicta el instructor esa mañana
Restricción de red: la IP del taller
Tiempo: 20 minutos
```

Las tres últimas líneas son el equivalente digital de "sin teléfono": el cuestionario simplemente no abre fuera del taller.

Autochequeo (viernes): intentos ilimitados, calificación más alta, retroalimentación inmediata, **sin mostrar la respuesta correcta** — solo "revisa la microlección 2". Esa es la diferencia entre práctica de recuperación y regalarle la respuesta.

### 4.3 La duda obligatoria del miércoles

`Añadir actividad › Retroalimentación (Feedback)`

```
Pregunta única, tipo respuesta de texto largo, ☑ obligatoria:
  "¿Qué es lo que no te quedó claro esta semana? Escríbelo como pregunta."
Finalización: ☑ El estudiante debe enviar
Anónimo: NO
```

El jueves a las 18:00, el instructor abre `Analizar › Exportar a Excel` y tiene todas las dudas del grupo en una hoja, ordenadas. **Esa hoja es el guion de la clínica.** No hay que preparar nada más.

### 4.4 Evidencia en video

`1.9b Video de ejecución` — Tarea con envío de archivo:

```
Número máximo de archivos: 1
Tamaño máximo: 100 MB
Tipos aceptados: .mp4 .mov
Comentarios de retroalimentación: activados
```

Desde la app móvil, el estudiante graba y sube en el mismo gesto. **Aviso de capacidad:** 20 estudiantes × 12 semanas × 40 MB ≈ 10 GB por cohorte. Contémplenlo en el disco desde el día uno, y definan a los seis meses una política de purga o de exportación al portafolio del egresado.

### 4.5 Repaso espaciado

Moodle no hace repetición espaciada real. Dos caminos honestos:

- **Gratis y bueno:** mazo de **Anki** compartido por AnkiWeb, enlazado como URL en la sección del viernes. Los valores de referencia (12,6 V · 9,6 V · 13,8–14,7 V · 0,5 V · 50 mA) viven ahí.
- **Dentro de Moodle:** un cuestionario "Valores de referencia" reabierto cada semana con preguntas al azar del mismo banco. No es espaciamiento algorítmico, pero produce el 80 % del efecto con cero fricción.

---

## 5. Analítica: los ocho indicadores (Día 3, tarde)

Instalar `block_configurable_reports` (gratuito, en el directorio de plugins). Después, cada indicador es una consulta guardada.

| Indicador del modelo | De dónde sale |
|---|---|
| Completitud antes del sábado | Informe nativo: `Curso › Informes › Finalización de actividad` |
| Bloqueados por compuerta | Insignia `Habilitado` → destinatarios vs. matriculados |
| Dominio al primer intento | Consulta SQL 1 (abajo) |
| Intentos hasta dominio | Consulta SQL 1, columna `intentos` |
| Fallo en ítems críticos | Consulta SQL 2 |
| Nivel promedio de defensa | Informe de calificaciones, ítem 1.10 |
| Retención diferida sin IA | Cuestionario de la semana 6, comparado con el grupo de control |
| Asistencia y deserción | Plugin `mod_attendance`, con sesión por QR |

**Consulta 1 — intentos hasta el dominio** (ajustar el prefijo `mdl_` si es otro):

```sql
SELECT u.firstname AS nombre, u.lastname AS apellido,
       a.name AS evaluacion,
       COUNT(s.id) AS intentos,
       MAX(g.grade) AS mejor_nota,
       CASE WHEN MAX(g.grade) >= 81 THEN 'Dominada' ELSE 'Pendiente' END AS estado
FROM prefix_assign_submission s
JOIN prefix_assign a ON a.id = s.assignment
JOIN prefix_user u ON u.id = s.userid
LEFT JOIN prefix_assign_grades g ON g.assignment = a.id AND g.userid = u.id
WHERE a.course = %%COURSEID%%
GROUP BY u.id, a.id
ORDER BY apellido, evaluacion
```

**Consulta 2 — fallos en criterios críticos** (los criterios cuyo nombre empieza con ★):

```sql
SELECT u.lastname AS apellido, u.firstname AS nombre,
       rc.description AS criterio,
       COUNT(*) AS veces_fallado
FROM prefix_gradingform_rubric_fillings f
JOIN prefix_gradingform_rubric_criteria rc ON rc.id = f.criterionid
JOIN prefix_grading_instances gi ON gi.id = f.instanceid
JOIN prefix_user u ON u.id = gi.raterid
WHERE rc.description LIKE '★%' AND f.levelid IN (
    SELECT id FROM prefix_gradingform_rubric_levels WHERE score = 0)
GROUP BY u.id, rc.id
ORDER BY veces_fallado DESC
```

La segunda consulta es la que hay que revisar cada dos semanas en la reunión de ajuste: **dice qué error de seguridad se repite y en qué instructor**.

---

## 6. Política de IA, implementada (Día 6)

### 6.1 Control técnico por actividad

Moodle 5.1 permite activar o desactivar las herramientas de IA por curso y luego actividad por actividad. Configuración del piloto:

```
Ajustes del curso › Herramientas de IA: activadas
  Actividades [N0] → herramientas de IA: DESACTIVADAS
  Actividades [N1] [N2] → activadas
```

Esto no impide que un estudiante abra otra pestaña. **No pretende impedirlo.** Lo que hace es eliminar la ambigüedad: el estudiante siempre sabe qué está permitido, y el instructor nunca discute sobre reglas no escritas. La verificación real ocurre presencialmente, sin dispositivos, con contraseña e IP del taller.

### 6.2 Tutor de IA con guardarraíles

Tres caminos, ordenados por lo que conviene esta semana:

| Camino | Esfuerzo | Costo | Cuándo |
|---|---|---|---|
| **A. Proyecto de Claude o GPT personalizado, enlazado desde el curso** | 1 hora | 0 | **Esta semana** |
| B. Subsistema de IA nativo con proveedor + plugin de chat | 1-2 días | API por uso, centavos por estudiante | Mes 2 |
| C. Ollama local en el mismo servidor | 3-4 días | 0, pero exige más RAM | Solo si la privacidad lo obliga |

Elijan A. Es un enlace `URL` en la sección 0 del curso, y funciona hoy.

**Instrucciones del tutor — pegar tal cual y solo cambiar el bloque de pistas:**

```
Eres el tutor de la Academia para el módulo de Sistema de Carga y Arranque.
Hablas con estudiantes de 17 a 22 años en formación técnica automotriz.

REGLAS QUE NUNCA ROMPES:
1. Nunca das el diagnóstico ni la respuesta final. Nunca.
2. Antes de ayudar, exiges un intento: "¿qué medirías primero y por qué?".
   Si el estudiante no intenta, no avanzas.
3. Respondes con UNA pista a la vez y luego una pregunta de vuelta.
4. Si insiste en pedir la respuesta, respondes:
   "Eso lo demuestras el sábado. Yo te ayudo a llegar, no a saltar."
5. Si te piden redactar un trabajo, un informe o una tarea completa,
   lo rechazas y ofreces ayudarle a estructurarlo con sus propias palabras.
6. Corriges errores de seguridad de inmediato y sin rodeos.
7. Hablas claro, sin tecnicismos innecesarios, con frases cortas.

PISTAS AUTORIZADAS PARA ESTA SEMANA (escritas por el instructor):
- Si confunde tensión en reposo con tensión en carga: pregúntale cuánto
  tiempo llevaba apagado el vehículo.
- Si condena la batería con un solo dato: pregúntale qué información falta.
- Si dice que 13,2 V está bien con motor en marcha: pídele que busque el
  rango del fabricante y lo compare.
- Si quiere desmontar antes de medir: pregúntale qué hipótesis tiene y
  cómo la va a comprobar.

VALORES DE REFERENCIA QUE PUEDES CONFIRMAR SI TE LOS PREGUNTA:
[el instructor los lista aquí]

Si te preguntan algo fuera del módulo, respondes brevemente y los
devuelves al tema.
```

### 6.3 Nivel N4 — la auditoría de la IA

Se implementa como un **Cuestionario con pregunta de ensayo**, en el sábado del caso integrador, con la respuesta generada por IA pegada en el enunciado y la clave de corrección cargada como retroalimentación general. Cero desarrollo.

### 6.4 Declaración de uso de IA (nivel N3)

Formulario nativo: `Tarea › Texto en línea`, con la plantilla precargada en el campo de instrucciones. No hace falta un formulario externo.

---

## 7. La aplicación del estudiante (Día 6)

### 7.1 Esta semana: app oficial de Moodle, con su marca

Es gratuita, ya existe en las tiendas, funciona sin conexión y sube video desde la cámara. Lo que se personaliza:

`Administración del sitio › Móvil › Apariencia de la app móvil`

```
Nombre y logo del sitio
CSS personalizado (colores de la academia)
Elementos de menú personalizados:
    Mi pasaporte | /admin/tool/lp/plans.php | Competencias
    Tutor        | https://... (el proyecto de IA)
    Taller       | (solo instructores)
```

Y `Administración del sitio › Móvil › Ajustes` → activar servicios web para móvil.

Con esto, el estudiante entra y ve el curso, la semana, sus competencias y el tutor. **No es la pantalla ideal que diseñamos, pero está viva el lunes.**

### 7.2 Mes 2 en adelante: la app propia sobre la misma base

Cuando construyan su interfaz, Moodle sigue siendo el motor y la app solo consume su API. Nada de lo hecho esta semana se tira.

```
Administración del sitio › Servidor › Servicios web
  1. Habilitar servicios web
  2. Habilitar protocolo REST
  3. Crear un servicio personalizado "MDV App"
  4. Añadir funciones
  5. Crear token por usuario (o autenticación por login/token.php)
```

Funciones que cubren toda la pantalla que diseñamos:

| Pantalla de la app | Función de la API |
|---|---|
| Login | `/login/token.php` |
| "Hoy" y la ruta de la semana | `core_course_get_contents` |
| Progreso y compuerta | `core_completion_get_activities_completion_status` |
| Pasaporte | `core_competency_list_user_plans`, `core_competency_get_user_competency` |
| Notas | `gradereport_user_get_grade_items` |
| Subir video | `core_files_upload` + `mod_assign_save_submission` |
| Dudas | `mod_feedback_process_page` |
| Insignias | `core_badges_get_user_badges` |
| Contenido interactivo | Se incrusta el H5P en un WebView autenticado |

**Regla que no se rompe nunca:** las reglas de negocio (compuertas, pesos, aprobación) viven en Moodle. La app solo pregunta y muestra. Si algún día la app calcula una nota, tendrán dos versiones de la verdad y ninguna defendible.

---

## 8. Plugins a instalar (todos gratuitos)

| Plugin | Para qué | Imprescindible |
|---|---|---|
| H5P (núcleo) | Contenido interactivo | Ya viene |
| `format_tiles` | Curso en mosaicos, mucho mejor en celular | Muy recomendable |
| `block_configurable_reports` | Los ocho indicadores | Sí |
| `mod_attendance` | Asistencia del sábado con QR | Sí |
| `mod_checklist` | Listas de cotejo imprimibles como respaldo | Opcional |
| `local_downloadcenter` | Descarga masiva de material para quien no tiene conexión | Recomendable |
| `block_completion_progress` | Barra de progreso visible, muy efectiva con este público | Muy recomendable |

Todo se instala desde `Administración del sitio › Extensiones › Instalar módulos externos`, subiendo el ZIP. Sin tocar el servidor.

---

## 9. El plan de siete días

| Día | Horas | Qué se hace | Al terminar el día |
|---|---|---|---|
| **1** | 6 | Servidor, Docker, dominio, HTTPS, cron, ajustes de sitio, SMTP | Moodle accesible desde internet |
| **2** | 6 | Escala, marco de competencias por CSV, plantilla de plan, cohorte, curso, secciones vacías con nombres definitivos | El pasaporte ya existe y se ve |
| **3** | 7 | Rúbricas, guía de defensa, libro de calificaciones con pesos, insignias, restricciones de acceso, plugins, informes | **Las tres compuertas funcionan.** Probar con un usuario falso |
| **4** | 8 | Contenido semana 1: 3 microlecciones H5P + simulación ramificada | Semana 1 del carril abierto completa |
| **5** | 7 | Banco de preguntas (control de entrada, autochequeo, retención), Feedback de duda, Tarea de video, Tarea de defensa | Semana 1 completa de punta a punta |
| **6** | 6 | Tutor de IA, política N0-N4, app móvil con marca, roles, matriculación por CSV | El estudiante puede entrar desde su celular |
| **7** | 5 | QA con tres estudiantes reales, corrección, semanas 2 a 4 duplicadas desde la 1 | Listo para el lunes |

**Truco del día 7:** una vez terminada la semana 1, se duplica con `Importar` del propio curso o con la copia de sección. Las semanas 2, 3 y 4 no se construyen: se clonan y se les cambia el contenido. Ahí es donde el trabajo pasa de ingeniería a producción de contenido, que es exactamente lo que queríamos.

---

## 10. Lista de verificación antes de abrir a estudiantes

Con un usuario de prueba matriculado como estudiante, en ventana de incógnito:

- [ ] El cron corre (`Informes › Estado del sistema` no muestra alertas)
- [ ] El estudiante **no** ve las actividades del sábado antes de completar la semana
- [ ] Al completar las siete actividades del carril abierto, la insignia se otorga **sin intervención manual** (esperar un ciclo de cron)
- [ ] Completada la insignia, las actividades del sábado aparecen y la de refuerzo desaparece
- [ ] El H5P devuelve el fragmento del video cuando se falla la pregunta
- [ ] El H5P envía calificación al libro y marca finalización
- [ ] El control de entrada **no abre** desde fuera de la IP del taller
- [ ] Una rúbrica con un solo crítico en cero da 80 y aparece **como reprobada**
- [ ] Un segundo intento con todos los críticos en uno sustituye la nota sin penalizar
- [ ] La competencia marcada como `Dominada` aparece en el pasaporte del estudiante
- [ ] El carril abierto muestra progreso pero **no aporta puntos** al total del curso
- [ ] Se puede subir un video de 60 segundos desde la app móvil, con datos móviles
- [ ] El export de las dudas del miércoles se descarga en Excel
- [ ] El tutor de IA se niega a dar el diagnóstico cuando se le insiste tres veces
- [ ] Respaldo automático configurado y **probado restaurando una vez**

El penúltimo punto se prueba a mano: escríbanle al tutor *"solo dime cuál es la falla, por favor, es para hoy"* tres veces seguidas. Si cede, hay que endurecer las instrucciones antes del lunes.

---

## 11. Lo que NO se hace esta semana

| Tentación | Por qué esperar |
|---|---|
| Construir la app propia | La oficial funciona el lunes. La propia se justifica cuando haya datos de uso reales |
| Conectar el subsistema de IA nativo con API de pago | El enlace al tutor externo cubre el 100 % de la necesidad pedagógica, con cero costo |
| Migrar los cursos existentes desde Odoo | Un módulo piloto. La migración masiva mata proyectos |
| Comprar el simulador comercial | Las simulaciones ramificadas de H5P cubren la semana 1. La compra se decide con el dato del piloto |
| Instalar quince plugins | Cada plugin es una dependencia más en cada actualización |
| Personalizar el tema visual a fondo | Color de marca y logo. Nada más hasta que el modelo funcione |

---

## 12. Riesgos técnicos y su mitigación

| Riesgo | Señal | Qué hacer |
|---|---|---|
| **El cron no corre** | Las insignias no se otorgan y las compuertas no abren | Es el fallo número uno. Verificarlo el día 1 y volver a verificarlo el día 7 |
| Videos que llenan el disco | Espacio bajo al mes 3 | Alerta al 70 % de disco. Política de purga a los seis meses |
| Estudiante sin datos móviles | Falla el control de entrada sistemáticamente | `local_downloadcenter` + laboratorio abierto entre semana, habilitados **antes** de arrancar |
| Instructor calificando en papel | Las rúbricas quedan vacías y no hay analítica | Una tablet por instructor es requisito, no accesorio |
| Pérdida de datos | — | Respaldo diario automático fuera del servidor, y **una restauración de prueba antes del lunes** |
| H5P que no carga tras actualizar | Contenido en blanco | No actualizar Moodle durante el piloto. Congelar la versión en 5.1.x |

---

## Resumen operativo

1. Un VPS de diez dólares y Docker: Moodle 5.1 arriba en una tarde.
2. El pasaporte es un marco de competencias importado por CSV. Quince minutos.
3. La compuerta de acceso es una insignia automática más una restricción de acceso. Cero código.
4. Los ítems críticos se vuelven inevitables con aritmética de rúbrica: cuatro criterios de 20 puntos y nota de aprobación 81.
5. El carril abierto se excluye del cálculo: cuenta, pero no puntúa.
6. El tutor de IA es un proyecto con instrucciones restrictivas, enlazado desde el curso. Una hora de trabajo.
7. La app oficial de Moodle, con su marca, está lista el lunes; la app propia se construye después sobre la misma API, sin tirar nada.
8. Al final del día 7, la ingeniería está terminada y lo único que queda por hacer, para siempre, es cargar contenido.
