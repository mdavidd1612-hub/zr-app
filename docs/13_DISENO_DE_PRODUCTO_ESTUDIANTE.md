# DISEÑO DE PRODUCTO: ¿QUÉ CAMBIA DE VERDAD PARA EL ESTUDIANTE?
> **Fecha:** 30 de julio de 2026
> **Pregunta que responde:** el 5 de septiembre, cuando un estudiante de 17 años abra ZR App
> por primera vez, ¿qué gana él? No la academia. Él.
>
> Fuentes analizadas: los ocho documentos de `docs/`, la Propuesta Ejecutiva y el documento
> del Piloto de Microlearning.

---

## 1. EL HALLAZGO INCÓMODO

Auditamos la Fase 1 módulo por módulo preguntando *"¿esto le quita trabajo al estudiante o se
lo quita a la academia?"*. El resultado:

| Módulo de Fase 1 | Gana la academia | Gana el estudiante |
|---|---|---|
| Asistencia por escaneo | **Mucho.** Elimina la planilla y el vaciado manual | **Nada.** Antes firmaba, ahora muestra el teléfono |
| Consentimiento parental | **Mucho.** Cumplimiento legal | Nada (es un trámite más) |
| Feedback micro por clase | **Mucho.** Datos que hoy no existen | **Nada.** Responde y no recibe nada a cambio |
| Panel de profesor | Mucho | Nada |
| Panel de administración | Mucho | Nada |
| Carnet digital | Poco | **Poco.** Sustituye un carnet que quizá ni usaba |
| Exámenes digitales | Mucho (se acaba la corrección manual) | **Regular.** Escribir en un teléfono es *peor* que en papel… salvo por una cosa: la nota al instante |
| Repositorio de contenido | Regular | **Bien.** Si hoy pierde las guías o las busca en WhatsApp, esto sí resuelve algo |
| Ver sus notas | Poco | **Bien.** Saber dónde está parado sin tener que preguntar |

**Conclusión:** la Fase 1, tal como está planificada, es aproximadamente **80% valor
institucional y 20% valor para el estudiante**. Y las tres cosas que sí le sirven —nota al
instante, material siempre disponible, saber dónde va— son ganancias **silenciosas**: pasan
sin que él las note, porque nada en la aplicación se las señala.

Esto no es un defecto del plan. Es la consecuencia lógica y correcta de que la Fase 1 se
diseñó, con razón, para resolver el dolor operativo de la academia. Pero si la pregunta es
*"¿el estudiante va a sentir el cambio?"*, la respuesta honesta hoy es **no lo suficiente**.

---

## 2. CUÁL ES EL DOLOR REAL DEL ESTUDIANTE

Está escrito, con todas sus letras, en el documento del Piloto de Microlearning que la propia
academia produjo:

> *"Entre una clase y la siguiente, el alumno no tiene ningún punto de contacto con el
> contenido del curso."*

**Seis días de silencio entre sábado y sábado.** Ese es el problema del estudiante. No la
asistencia, no los exámenes, no el carnet.

Y hay un segundo dato en la misma documentación que casi nadie está conectando con el primero.
El modelo pedagógico de la academia **ya contempla** esos seis días: cada Guía de Aprendizaje
tiene una **investigación previa entre semana**, antes de la práctica del sábado.

Es decir: **la academia ya diseñó el trabajo entre semana. Lo que falla es la entrega.** Hoy esa
asignación se transmite de palabra al final de la clase, cuando todo el mundo está recogiendo
sus cosas, y se pierde.

Eso cambia por completo la naturaleza del problema. No hay que inventar contenido para llenar
la semana. **Hay que entregar el contenido que ya existe.**

---

## 3. TRES AÑADIDOS QUE VOLTEAN LA ECUACIÓN

Ordenados por relación valor/costo. Los tres son opcionales: son una recomendación, no un
cambio de alcance que yo pueda tomar por mi cuenta.

### 3.1 · «Lo que viene el próximo sábado» — **medio día de trabajo**

Una tarjeta en la pantalla de inicio del estudiante, siempre visible:

```
┌──────────────────────────────────────────┐
│  PRÓXIMO SÁBADO · 15 de agosto           │
│  Semana 2 · Diagnóstico de batería       │
│                                          │
│  Para llegar preparado:                  │
│  Investiga los tipos de batería y cómo   │
│  se mide su densidad.                    │
│                                          │
│  📄 Ver la guía completa                 │
└──────────────────────────────────────────┘
```

**El dato ya existe:** `learning_guides.pre_practice_description`. Es un campo que de todos
modos hay que cargar. La tarjeta no requiere ninguna tabla nueva, ninguna Edge Function y
ninguna decisión de negocio.

**Por qué es lo mejor del lote:** ataca directamente los seis días de silencio con **cero
infraestructura nueva**. Convierte una asignación que hoy se transmite de palabra y se olvida
en algo que el estudiante tiene en el bolsillo toda la semana. Y llega el 5 de septiembre, no
en Fase 2.

> Es, con diferencia, el punto de mayor retorno de todo el proyecto. Y no es una función
> nueva: es hacer visible algo que la academia ya hace.

### 3.2 · «Mi progreso» — mapa de dominio del módulo — **dos días**

```
MÓDULO 3 · ELECTRICIDAD AUTOMOTRIZ

✅ Ley de Ohm aplicada              dominada
✅ Diagnóstico de batería           dominada
🔄 Sistema de carga: alternador     en progreso
⬜ Lectura de diagramas eléctricos  pendiente

Dominas 2 de 4 competencias de este módulo.
```

**Por qué importa más de lo que parece:** el propio análisis de la academia (`docs/06_` §1)
concluye que el factor que más predice motivación sostenida es la **percepción de competencia**,
y que la gamificación tradicional falla justo en esa variable. Esta pantalla es la única cosa
del sistema que ataca esa variable directamente.

Un estudiante de mecánica no quiere puntos. Quiere saber que ya sabe hacer algo.

**Costo:** una tabla (`mastery_map`, ya diseñada para Fase 2), un botón en el panel del
profesor para marcar competencias tras la práctica de taller, y una pantalla.

**Advertencia honesta:** depende de que las Guías de Aprendizaje estén digitalizadas antes del
14 de agosto. Sin ellas, la pantalla sale vacía. Es la misma dependencia que ya tiene todo lo
demás, pero aquí se nota más.

### 3.3 · «Constancia de notas» descargable — **un día**

Un botón que genera un PDF con los módulos cursados y aprobados, con código QR de
verificación. Sin ir a la oficina, sin esperar, sin pedirle el favor a nadie.

**Por qué en Venezuela esto pesa:** un estudiante que consigue una oportunidad en un taller el
martes necesita el papel el miércoles. Hoy eso es un trámite presencial con espera. Convertirlo
en un botón es de las pocas cosas que un usuario cuenta a otro.

Ya está modelado como `partial_transcripts` (`docs/10_` §6) y estaba previsto para Fase 3. Es
barato y no depende de nada pendiente.

---

## 4. LO QUE **NO** HAY QUE AGREGAR

Tan importante como lo anterior. «Innovador pero no complicado» significa, sobre todo, decir
que no.

| Tentación | Por qué no |
|---|---|
| **Rachas y notificaciones diarias** | Ya está descartado con fundamento en `docs/06_` §1. Compite con la motivación real del estudiante en vez de reforzarla. No lo reabras. |
| **Chat o mensajería en la app** | Prohibido por seguridad de menores (`docs/03_` §2). Y competiría con WhatsApp, que ya funciona. Perderías. |
| **Ranking o tabla de posiciones** | En un grupo de 25 personas que se ven la cara todos los sábados, un ranking público humilla al último. El daño supera a la motivación. |
| **Muro social, likes, comentarios** | Fase 3, y solo si hay moderador asignado. Hoy no lo hay. |
| **Simulador visual** | El módulo más caro del proyecto y el de retorno más incierto. No antes de un spike propio. |
| **Inteligencia artificial en la app** | La IA sirve para *producir* el contenido (ver §5), no para ponerle un chatbot a la aplicación. Un asistente que da un torque equivocado es un riesgo de seguridad física en un taller. |

**El criterio que ya tienes escrito y que funciona** (`docs/00_` §0): *si una función no le quita
trabajo a alguien, no entra.* Aplícalo a cada idea nueva, incluidas las tres de arriba.

---

## 5. LA JUGADA QUE NO CUESTA NADA AL EQUIPO TÉCNICO

La academia ya tiene escrito un **Piloto de Microlearning** completo: videos de 30-60 segundos
generados con IA a partir del material que los instructores ya tienen, distribuidos por
**WhatsApp o Telegram**, sin desarrollar ninguna aplicación.

**Recomendación: arranquen ese piloto en agosto, en paralelo, sin tocar el equipo de
desarrollo.**

Lo que consigues, sin gastar una hora de programación:

1. **Los estudiantes reciben contacto entre semana desde ya**, meses antes de que ZR App tenga
   el módulo de video.
2. **Se mide cuántas horas humanas cuesta producir un módulo de contenido.** Ese número es hoy
   el mayor supuesto sin validar de toda la Fase 2. Si resulta que producir un módulo cuesta 40
   horas, la Fase 2 hay que replantearla — y es mejor saberlo en agosto que en octubre.
3. **Se prueba la reacción al avatar de IA** antes de invertir en la infraestructura de video.
4. **Cuando la Fase 2 llegue, el banco de contenido ya existe.**

El equipo que lo ejecuta es el de contenido, no el técnico: un instructor, un guionista y un
revisor. **Cero impacto en la fecha del 5 de septiembre.**

Es, en la práctica, ejecutar la Fase 0 de contenido mientras corre la Fase 1 de software. Los
dos caminos son independientes y se encuentran en octubre.

---

## 6. DÓNDE ESTÁ LA INNOVACIÓN REAL DE ESTE PROYECTO

Vale la pena decirlo claro, porque no está donde la gente suele buscarla. Aquí no hay ninguna
función deslumbrante. Lo que hay son cuatro decisiones de ingeniería que la mayoría de
plataformas educativas no toma:

1. **El profesor escanea al estudiante, no al revés.** Invierte la dirección obvia y con eso
   elimina el fraude por reenvío, reduce de 100 a 1 los dispositivos que necesitan señal, y
   hace posible el modo sin conexión. Una decisión, tres problemas resueltos.
2. **Funciona sin internet donde importa.** Casi ningún sistema educativo asume que el aula no
   tiene señal. Este sí, porque el taller de San Antonio de los Altos no la tiene.
3. **Dominio verificable en lugar de rachas.** Es una postura de producto argumentada con
   evidencia, no una omisión. Va a contracorriente de todo el mercado.
4. **Un escaneo, dos usos.** Asistencia y refrigerio en el mismo evento, en vez de dos módulos
   y dos infraestructuras.

Nada de eso se ve en una captura de pantalla. Todo eso se siente el sábado a las ocho de la
mañana, cuando el pase de lista de 100 personas toma cuatro minutos en vez de veinte y funciona
aunque no haya señal.

**Esa es la innovación: que funcione en las condiciones reales de esta academia**, no en las
condiciones ideales de una demostración.

---

## 7. RECOMENDACIÓN

**Agregar 3.1 sí o sí.** Medio día de trabajo, dato que de todos modos hay que cargar, y ataca
el único dolor que el estudiante realmente tiene. No agregarlo sería difícil de justificar.

**Agregar 3.2 y 3.3 si el sprint 4 llega holgado.** Entran como tareas opcionales al final del
Sprint 4, después de que todo lo obligatorio esté probado. Si el proyecto va apretado, se caen
sin drama y entran en Fase 1.5 a mediados de septiembre.

**Arrancar el piloto de WhatsApp en agosto.** No cuesta nada al equipo técnico y desactiva el
mayor riesgo de la Fase 2.

**Costo total de las tres, en el peor caso: 3,5 días.** Contra un plan de 5 semanas, es
aproximadamente el 12% del tiempo — a cambio de convertir un sistema administrativo en algo
que el estudiante quiere abrir.

---

## 8. SOBRE EL FINANCIAMIENTO EN FASE 1
> Añadido el 30/07/2026, respondiendo a la pregunta de si el módulo de financiamiento podía
> entrar en la entrega de septiembre.

### 8.1 · Por qué el módulo completo no cabe
No es un problema de tiempo de programación. Son **cuatro decisiones de negocio sin cerrar**,
y una de ellas es una prohibición explícita de la propia Junta:

| # | Qué falta | Dónde está documentado |
|---|---|---|
| 1 | El **Spike Legal/Financiero** no está cerrado: falta el contrato de adhesión de servicios educativos y el tratamiento fiscal del descuento por puntos | `docs/02_` §12 |
| 2 | Las **reglas de progresión entre niveles Cash & Carry**: cuántos pagos puntuales suben de nivel, y si un pago tardío degrada de inmediato | `docs/07_` gap #2 |
| 3 | La **fuente confiable de la tasa BCV** y qué hacer cuando falle. El BCV no publica una API oficial estable, y el sábado es el día de mayor volumen de pagos | `docs/08_` defecto D-9 |
| 4 | La base de cálculo del **«30% del excedente»** del fondo de refrigerios. Sin una cifra, no es implementable | `docs/08_` defecto D-11 |

Y sobre todo esto:

> **`docs/05_ROADMAP_FASES.md`, nota de alcance:** *"Atención crítica declarada formalmente por
> la Junta — no se debe programar ninguna regla de backend referente a cuotas o conversión de
> moneda hasta que el Spike Legal/Financiero resuelva los tres puntos de la sección 12."*

Construir el módulo ahora sería desobedecer una instrucción escrita de la Junta, en el módulo
que la propia documentación clasifica como **el de mayor riesgo financiero y legal del
proyecto**. No es prudencia excesiva: es que un error ahí no se arregla con un despliegue.

Súmale que faltan tres piezas de esquema (facturas, pagos parciales de una cuota, y la tabla
de tasas de cambio) y que la revisión manual de 300-400 comprobantes mensuales exige una
decisión de personal que nadie ha tomado. Son **entre 2 y 3 semanas** de construcción sobre un
plazo de 5, encima de todo lo demás.

### 8.2 · Lo que sí cabe: «Estado de cuenta» de solo lectura — **2 días**

Hay una versión que entrega el 80% del valor percibido sin tocar ninguna de las cuatro
decisiones pendientes.

**Qué hace:** la administración carga —por CSV o a mano— cuánto debe cada estudiante y qué ha
pagado. El estudiante lo **ve** en su teléfono.

```
┌──────────────────────────────────────────┐
│ 💳 MI ESTADO DE CUENTA                   │
│ Módulo 3 · Electricidad Automotriz       │
│                                          │
│ Costo del módulo          US$ 150,00     │
│ Pagado                    US$  90,00     │
│ ─────────────────────────────────────    │
│ Pendiente                 US$  60,00     │
│                                          │
│ Próxima cuota: US$ 30 · sáb 22 ago       │
│                                          │
│ Actualizado: 20 ago · 4:15 pm            │
└──────────────────────────────────────────┘
```

**Qué NO hace, y por eso es seguro:**
- No calcula cuotas ni porcentajes de inicial → no toca la decisión legal.
- No convierte a bolívares → no necesita la tasa BCV.
- No recibe comprobantes ni aprueba pagos → no crea cola de revisión ni exposición de fraude.
- No aplica descuentos ni puntos → no toca el tratamiento fiscal.
- No bloquea nada por mora → no toca la política de mora ni la normativa educativa.

Es **un espejo de lo que la academia ya lleva**, puesto en el bolsillo del estudiante.

**Por qué vale la pena:** *"¿cuánto debo?"* es probablemente la pregunta que más veces se le
hace a la administración cada sábado. Responderla sin que nadie tenga que preguntar le quita
trabajo a la oficina y le quita ansiedad al estudiante. Cumple el criterio de `docs/00_` §0 por
los dos lados.

**Y prepara la Fase 2:** las tablas `installments` y `payments` quedan creadas y con datos
reales cargados. Cuando el Spike Legal cierre, la Fase 2 no arranca de cero: arranca con
historial.

### 8.3 · La condición que decide si conviene

**Solo tiene sentido si la academia ya lleva ese dato en algún lado** (una hoja de cálculo, un
cuaderno, lo que sea) y alguien lo mantiene al día.

Si no existe ese registro hoy, esta pantalla **crea trabajo nuevo** para la administración a
cambio de una comodidad para el estudiante — y eso viola directamente el principio rector del
proyecto: *si un módulo agrega trabajo sin quitar trabajo en otro lado, se cuestiona antes de
construirse.* En ese caso, no se hace.

**La pregunta concreta para Coordinación Administrativa:**
*"¿Existe hoy una hoja de cálculo, o algo equivalente, donde se lleve cuánto ha pagado cada
estudiante? ¿Quién la actualiza y cada cuánto?"*

Si la respuesta es sí → entra como tarea opcional al final del Sprint 4, con la misma regla de
corte que las demás.
Si la respuesta es no → queda para Fase 2, junto con el módulo completo.

---

## 9. UNA ÚLTIMA COSA SOBRE LA PRIMERA IMPRESIÓN

El 5 de septiembre, cien estudiantes van a abrir esta aplicación por primera vez, casi todos al
mismo tiempo, de pie, en un taller. Esa primera pantalla decide si la aplicación se percibe como
*"otra cosa que me obligan a usar"* o como *"algo mío"*.

Por eso la pantalla de inicio del estudiante **no debe ser el carnet a secas**. Debe ser, en
este orden:

1. **Lo que viene el próximo sábado** (§3.1) — porque es lo único accionable.
2. **Mi progreso en el módulo** (§3.2) — porque es lo que da orgullo.
3. **El carnet con el QR** — porque es lo que necesita en la puerta.

El carnet es una herramienta de la academia para identificarlo. Las otras dos son suyas. **Un
sistema se adopta por lo que le da al usuario en los primeros diez segundos**, y ahí el orden de
las tarjetas importa más que cualquier función que construyamos después.
