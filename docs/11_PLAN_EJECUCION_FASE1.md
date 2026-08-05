# PLAN DE EJECUCIÓN — FASE 1
> **Objetivo:** ZR App operando en producción con la matrícula real el **sábado 5 de
> septiembre de 2026**.
> **Emitido:** 30 de julio de 2026 · **Ventana:** 37 días · **Equipo:** 2 técnicos + agente de
> código + apoyo de la academia.
>
> Este documento es ejecutable: cada paso tiene responsable, fecha y criterio de terminación
> verificable. Si un paso no se puede marcar como hecho de forma objetiva, está mal escrito y
> hay que reescribirlo, no interpretarlo con optimismo.

---

## 0. CÓMO LEER ESTE PLAN

### 0.1 El calendario real manda
El proyecto no se organiza por semanas de calendario sino por **sábados de clase**, porque el
sistema entero existe para que un sábado funcione mejor. Entre hoy y la entrega hay seis:

| Sábado | Papel en el plan |
|---|---|
| **1 de agosto** | Recolección de realidad. Cero código. Medición de línea base, prueba de señal, fotografía de guías, censo de cohortes. |
| **8 de agosto** | Primera prueba con usuarios: registro y consentimiento con 5 estudiantes reales. |
| **15 de agosto** | Piloto de asistencia por escaneo en una cohorte real. |
| **22 de agosto** | Primer examen digital real en una cohorte. |
| **29 de agosto** | Operación completa de una cohorte: asistencia + examen + contenido + feedback. |
| **5 de septiembre** | **Entrega. Toda la matrícula, en producción.** |

Cada sábado es una prueba de fuego con usuarios reales, no un hito de calendario. Un módulo
que no sobrevivió a un sábado real no está terminado, aunque el código funcione en la máquina
de quien lo escribió.

### 0.2 Responsables (asignar nombres antes del 1 de agosto)

| Código | Rol | Nombre | Responsabilidad |
|---|---|---|---|
| **DP** | Dueño de producto / decisor único | *por asignar* | Responde cualquier duda de negocio en menos de 24 h. Autoridad delegada por la Junta. |
| **T1** | Técnico 1 | *por asignar* | Backend, base de datos, Edge Functions, despliegue |
| **T2** | Técnico 2 | *por asignar* | Frontend, PWA, paneles internos |
| **IA** | Agente de código | Claude | Escribe, revisa y prueba código bajo dirección de T1/T2 |
| **CA** | Coordinación Académica | *por asignar* | Guías de Aprendizaje, ADR-007, catálogo de módulos |
| **ADM** | Administración | *por asignar* | Datos de estudiantes y profesores, pruebas del panel admin |
| **LEG** | Legal | *por asignar* | Política de privacidad, consentimiento parental, términos |

> Un plan con responsables sin nombre propio es un documento de intenciones. **Este es el paso
> 1 y no es negociable.**

### 0.3 Definición de Hecho (aplica a toda tarea de desarrollo)
Una tarea está hecha cuando cumple **las siete**:
1. El código está en `main` y desplegado en el entorno de pruebas.
2. Tiene RLS definida y probada si toca una tabla nueva.
3. Tiene al menos una prueba automatizada del camino feliz y una del camino de error.
4. La prueba de acceso cruzado (estudiante A no ve datos de estudiante B) sigue pasando.
5. Funciona en un teléfono real, no solo en el navegador de escritorio con vista móvil.
6. Un miembro del equipo distinto a quien la construyó la usó y la aprobó.
7. Si toca el esquema, la migración está versionada en `supabase/migrations/`.

### 0.4 Reglas de trabajo permanentes
- **Congelamiento de alcance desde el 3 de agosto.** Toda idea nueva va al backlog de Fase 1.5.
  Filtro de admisión (`00_` §0): si no quita trabajo a alguien, no entra.
- **Ninguna migración sin RLS en el mismo archivo.**
- **Ningún parámetro de negocio codificado en duro.** Va a `system_config`.
- **Ningún cálculo de nota, aprobación o puntaje en el cliente.** Solo en Edge Functions.
- **Revisión diaria de 15 minutos**, a la misma hora, con tres preguntas: qué se hizo, qué
  sigue, qué bloquea. Un bloqueo que dura más de 24 h escala a DP el mismo día.
- **El viernes no se despliega a producción.** Si algo se rompe, se rompe con la academia
  operando el sábado. Corte de despliegue: jueves.

---

# SPRINT 0 — FUNDACIONES
**Jueves 30 de julio → domingo 2 de agosto (4 días)**
**Objetivo:** tener el esqueleto completo del sistema —esquema, seguridad, entornos, despliegue—
antes de escribir una sola pantalla. Y traer del terreno los datos que faltan.

## Paso 1 — Cerrar el gobierno del proyecto `DP` · **30-31 de julio**
1.1 Asignar los siete nombres de la tabla 0.2 y comunicarlos por escrito.
1.2 Designar formalmente al decisor único, con autoridad delegada por la Junta para responder
    en 24 horas.
1.3 Crear el tablero de Trello desde `12_TABLERO_TRELLO.md` e importar `trello_import.csv`.
1.4 Fijar la hora de la revisión diaria de 15 minutos.
**Hecho cuando:** existe un mensaje escrito con los siete nombres y la hora de la reunión.

## Paso 2 — Aprobar las decisiones arquitectónicas `DP` + `CA` · **31 de julio – 3 de agosto**
2.1 Leer `09_DECISIONES_ARQUITECTONICAS.md` completo.
2.2 Aprobar u objetar ADR-005 (escaneo invertido), ADR-006 (sin conexión) y ADR-009 (cohortes)
    antes del 3 de agosto. Silencio = aprobación.
2.3 Escalar ADR-007 a Coordinación Académica: **la regla 50% + 50% + 5% = 105% no cierra.**
    Enviar con la Opción A ya redactada para que solo tengan que aprobarla. Límite: 7 de agosto.
2.4 Registrar cada aprobación en la tabla final de `09_`.
**Hecho cuando:** la tabla de aprobación de `09_` no tiene filas vacías con fecha vencida.

## Paso 3 — Infraestructura y entornos `T1` · **30-31 de julio**
3.1 Crear el repositorio Git (privado) con esta estructura:
```
zr-app/
├── app/                    # Next.js App Router
│   ├── (estudiante)/
│   ├── (profesor)/
│   ├── (admin)/
│   └── api/
├── components/
├── lib/                    # cliente Supabase, utilidades, tipos
├── supabase/
│   ├── migrations/         # SQL versionado (única fuente de verdad del esquema)
│   ├── functions/          # Edge Functions
│   └── seed/               # datos ficticios y datos reales
├── tests/
│   ├── e2e/
│   └── rls/                # pruebas de acceso cruzado — bloquean el despliegue
├── docs/                   # copia de los documentos 00_ a 12_
└── .github/workflows/
```
3.2 Crear **dos** proyectos de Supabase: `zr-dev` y `zr-prod`. Nunca desarrollar contra
    producción.
3.3 Conectar el repositorio a Vercel: `main` → producción, cada rama → vista previa.
3.4 Configurar variables de entorno. **La clave `service_role` solo existe del lado servidor.**
3.5 Registrar el dominio y verificar HTTPS (requisito para cámara y para instalar la PWA).
**Hecho cuando:** una página vacía en el dominio real carga por HTTPS y hay dos bases separadas.

## Paso 4 — Esquema y seguridad `T1` + `IA` · **31 de julio – 2 de agosto**
4.1 Escribir las migraciones 001 a 011 según `10_ESQUEMA_BASE_DATOS_V2.md` §8.
4.2 Escribir las políticas de RLS de la matriz §7. **Ninguna tabla sin política.**
4.3 Escribir las pruebas de acceso cruzado en `tests/rls/`: para cada tabla sensible, un
    estudiante intenta leer datos de otro y debe fallar.
4.4 Generar datos ficticios: 1 programa, 13 módulos, 3 cohortes, 20 guías, 5 profesores,
    30 estudiantes (10 de ellos menores de edad), 4 sesiones de clase.
4.5 Ejecutar todo contra `zr-dev` desde cero, dos veces, para verificar que las migraciones son
    reproducibles.
**Hecho cuando:** `supabase db reset` reconstruye la base completa desde cero y las pruebas de
RLS pasan en verde.

## Paso 5 — Integración continua `T1` · **2 de agosto**
5.1 Flujo de trabajo de GitHub Actions: comprobación de tipos, linter, pruebas unitarias,
    pruebas de RLS.
5.2 **Las pruebas de RLS bloquean el despliegue.** Si fallan, no se publica. Sin excepciones.
5.3 Verificación automática de que las migraciones aplican limpio sobre una base vacía.
**Hecho cuando:** un pull request abierto ejecuta la comprobación completa y bloquea la fusión
si algo falla.

## Paso 6 — Respaldo y recuperación `T1` · **2 de agosto**
6.1 Activar respaldos automáticos diarios en `zr-prod`.
6.2 **Ejecutar una restauración de prueba** a una base descartable. Un respaldo no probado no
    es un respaldo.
6.3 Documentar en `docs/OPERACION.md`: cómo restaurar, cuánto se pierde en el peor caso
    (objetivo: máximo 24 h) y cuánto tarda volver a operar (objetivo: máximo 4 h).
**Hecho cuando:** existe evidencia escrita de una restauración exitosa con su duración medida.

## Paso 7 — SÁBADO 1 DE AGOSTO: recolección de realidad `T1` + `T2` + `DP` · **en la sede**
> Este sábado no se escribe código. Se recoge lo que ningún documento tiene y sin lo cual el
> sistema se construye a ciegas.

7.1 **Medir la línea base** (cierra el hueco G-10, sin el cual el criterio de salida de Fase 1
    es inevaluable):
   - Minutos que toma pasar lista hoy, cronometrados.
   - Minutos de calificación manual por examen.
   - Minutos de reparto y control de refrigerios.
   - Cuántas personas intervienen en cada tarea.
7.2 **Probar la señal** en cada taller y aula: medir velocidad y estabilidad. Documentar qué
    espacios sirven para aplicar exámenes (ADR-006).
7.3 **Censar las cohortes reales**: cuántos grupos activos, qué módulo cursa cada uno, qué
    profesor, qué espacio, cuántos estudiantes. **Este dato no existe en ningún documento y es
    estructural** (ADR-009).
7.4 **Fotografiar las Guías de Aprendizaje** de al menos 2 módulos completos, para poder
    empezar a digitalizar sin esperar la entrega formal.
7.5 **Inventariar dispositivos**: qué teléfonos y tablets tiene la academia disponibles para
    ser escáner, y con qué versión de navegador. Probar `getUserMedia` en cada uno.
7.6 Entrevistar 15 minutos a un profesor y a una persona de administración: qué les molesta
    hoy, en sus palabras.
**Hecho cuando:** existe un documento `docs/LINEA_BASE.md` con las cinco mediciones y el censo
de cohortes cargado en `zr-dev`.

## Paso 8 — Trámites legales en paralelo `LEG` · **arranca el 30 de julio**
8.1 Redactar la política de privacidad y los términos de uso (requisito LOPNNA y requisito para
    instalar una PWA que pide cámara).
8.2 Redactar el formato de consentimiento parental para 15-17 años, en versión física y digital.
8.3 Definir el período de conservación de datos y el procedimiento de eliminación a solicitud.
**Hecho cuando:** los tres documentos están aprobados y publicables. **Límite: 14 de agosto.**

### Criterio de salida del Sprint 0
- [ ] Siete responsables con nombre propio.
- [ ] ADR 005, 006 y 009 aprobadas.
- [ ] Base de datos completa, reproducible desde cero, con RLS y pruebas en verde.
- [ ] Dos entornos separados, despliegue automático, HTTPS.
- [ ] Restauración de respaldo probada y documentada.
- [ ] `docs/LINEA_BASE.md` con mediciones reales.
- [ ] Cohortes reales cargadas.

---

# SPRINT 1 — IDENTIDAD, CONSENTIMIENTO Y CARNET
**Lunes 3 → domingo 9 de agosto** · Prueba en campo: **sábado 8 de agosto**
**Objetivo:** que un estudiante real pueda registrarse, cumplir LOPNNA si es menor, y ver su
carnet digital.

| # | Tarea | Resp. | Detalle |
|---|---|---|---|
| 1.1 | Registro e inicio de sesión con cédula | T2+IA | Cédula mapeada a correo sintético (ADR-001). Objetivo de `00_` §3.1: menos de 60 s para un mayor de edad. |
| 1.2 | Correo de contacto obligatorio | T2 | Para menores, es el del representante legal. Sirve de canal de recuperación y de vínculo LOPNNA. |
| 1.3 | Recuperación de contraseña | T2 | Por el correo de contacto. |
| 1.4 | Bifurcación por edad en el registro | T2+IA | Si `age_years < 18` → paso de consentimiento parental obligatorio; si no, salta directo. |
| 1.5 | Captura de consentimiento parental | T2+T1 | Datos del representante, método (físico o digital), carga del documento firmado a bucket privado. |
| 1.6 | Bloqueo por consentimiento faltante | T1 | Disparador + RLS: sin consentimiento, `onboarding_status` no pasa a completo y no hay acceso a contenido ni exámenes. **Verificado por prueba automatizada.** |
| 1.7 | Aprovisionamiento del secreto QR | T1 | Se genera al completar el onboarding, se entrega una sola vez vía Edge Function y se guarda cifrado en el dispositivo. |
| 1.8 | Carnet digital | T2 | Nombre, foto, cédula, programa, cohorte, módulo actual, historial de módulos aprobados, y el QR rotatorio de 30 s. **Debe funcionar sin conexión.** |
| 1.9 | Esqueleto de la PWA | T2 | Manifiesto, trabajador de servicio, íconos, instalable desde el navegador. Probado en Android y iOS reales. |
| 1.10 | Panel admin: alta de estudiantes | T2 | Alta individual y carga masiva por CSV; asignación a cohorte. |
| 1.11 | Panel admin: verificación de consentimientos | T2 | Cola de consentimientos físicos por validar. |

**Sábado 8 de agosto — prueba en campo:** registrar a 5 estudiantes reales, **al menos 2
menores de edad**, con un miembro del equipo presente. Cronometrar el registro. Anotar cada
punto donde alguien duda o se detiene.
**Criterio de salida:** los 5 quedan registrados sin ayuda técnica, los menores con
consentimiento capturado, y todos ven su carnet en su propio teléfono.

---

# SPRINT 2 — ASISTENCIA Y OPERACIÓN DEL SÁBADO
**Lunes 10 → domingo 16 de agosto** · Prueba en campo: **sábado 15 de agosto**
**Objetivo:** eliminar la planilla de papel. Es el corazón del proyecto.

| # | Tarea | Resp. | Detalle |
|---|---|---|---|
| 2.1 | Gestión de sesiones de clase | T2 | Crear, abrir, cerrar y reprogramar sesiones por cohorte. |
| 2.2 | Vista de escáner del profesor | T2+IA | Cámara vía `getUserMedia`, escaneo continuo, retroalimentación grande y sonora: verde y nombre del estudiante, rojo y motivo. Diseñada para usarse de pie, con guantes, con una sola mano. |
| 2.3 | Validación del código en servidor | T1+IA | Edge Function: ventana de 30 s con tolerancia de desfase, sesión abierta, estudiante en la cohorte, sin duplicado. |
| 2.4 | Cola sin conexión | T2+IA | `IndexedDB` + trabajador de servicio. Contador visible de pendientes. Sincronización idempotente por `unique(session_id, student_id)`. |
| 2.5 | Respaldo manual por cédula | T2 | Búsqueda y marcado manual, con motivo obligatorio y registro de quién lo hizo. Auditado. |
| 2.6 | Marcado de refrigerio | T2 | Segundo escaneo del mismo estudiante en el día marca `snack_claimed_at`. Rechaza el segundo intento. |
| 2.7 | Vista de asistencia para el estudiante | T2 | Historial propio: sábados asistidos por módulo. |
| 2.8 | Reporte de asistencia | T2 | Por cohorte, por sesión, por estudiante. Exportable a CSV. |
| 2.9 | Panel admin: cohortes y módulos | T2 | Crear cohortes, asignar profesor, avanzar de módulo. |
| 2.10 | Prueba de carga | T1 | Simular 100 escaneos en 10 minutos contra `zr-dev`. |

**Sábado 15 de agosto — piloto real:** una cohorte completa pasa lista **solo con la app**,
con la planilla de papel presente como respaldo pero sin usarla salvo emergencia.
**Criterio de salida:** el 100% de los presentes queda registrado, el tiempo total es **menor
que la línea base medida el 1 de agosto**, y el sistema aguantó al menos un corte de señal.

---

# SPRINT 3 — EVALUACIONES
**Lunes 17 → domingo 23 de agosto** · Prueba en campo: **sábado 22 de agosto**
**Objetivo:** eliminar la calificación manual de las preguntas objetivas.
**Dependencia dura:** ADR-007 aprobada por Coordinación Académica antes del 7 de agosto.

| # | Tarea | Resp. | Detalle |
|---|---|---|---|
| 3.1 | Constructor de exámenes | T2 | Crear examen, agregar preguntas de los tres tipos, asignar puntaje. Validación: la suma de puntos debe igualar el máximo. |
| 3.2 | Banco de preguntas reutilizable | T2 | Duplicar un examen o importar preguntas de otro. Ahorra horas a los profesores. |
| 3.3 | Publicar examen | T1 | `oculto` → `habilitado`, con notificación a la cohorte. |
| 3.4 | Presentación del examen | T2 | Mobile-first, una pregunta por pantalla, guardado automático de cada respuesta, temporizador si aplica. |
| 3.5 | Blindaje de respuestas correctas | T1 | Vista `v_exam_questions_student` sin `correct_answer` + política de RLS. **Prueba automatizada que verifica que la respuesta no viaja al cliente.** |
| 3.6 | Autocalificación | T1+IA | Edge Function `grade-attempt` al entregar. Opción múltiple y verdadero/falso al instante. |
| 3.7 | Cola de calificación de redacciones | T2 | Vista del profesor con la rúbrica al lado, asignación de puntaje y comentario. Contador de pendientes y antigüedad. |
| 3.8 | Cierre del intento | T1 | Cuando ninguna respuesta queda sin puntaje, el intento pasa a `calificado` y se notifica. |
| 3.9 | Registro de notas del módulo | T2+T1 | El profesor carga teoría, práctica y participación; el peso de participación es suyo (mínimo 5%); `final_score` lo calcula el servidor con `calc_final_score`. |
| 3.10 | Vista de notas del estudiante | T2 | Notas por evaluación y por módulo, con el umbral de aprobación visible. |
| 3.11 | Auditoría de calificaciones | T1 | Todo cambio de nota queda en `audit_log`, con estado anterior y posterior. |

**Sábado 22 de agosto — prueba real:** una cohorte presenta un examen digital real, con al
menos una pregunta de cada tipo. Papel disponible como respaldo.
**Criterio de salida:** todos entregan, las objetivas se califican solas y correctamente, y el
profesor califica las redacciones desde su panel.

---

# SPRINT 4 — CONTENIDO, FEEDBACK Y VISIBILIDAD
**Lunes 24 → domingo 30 de agosto** · Prueba en campo: **sábado 29 de agosto**
**Objetivo:** cerrar el ciclo completo de un sábado y dar visibilidad a la administración.

| # | Tarea | Resp. | Detalle |
|---|---|---|---|
| 4.1 | Carga de contenido | T2 | Subida de PDF, presentaciones e imágenes a bucket privado, organizados por módulo y semana. Publicación programada. |
| 4.2 | Repositorio del estudiante | T2 | Navegación programa → módulo → semana. Visor de PDF con zoom (`00_` §3.6). Descarga como respaldo. |
| 4.3 | Registro de visualizaciones | T1 | `content_views` para el reporte de uso. |
| 4.4 | Feedback micro | T2 | Máximo 3 preguntas de selección, menos de 20 segundos. Aparece automáticamente al cerrar la sesión de clase. |
| 4.5 | Agregado de feedback para el profesor | T1 | **Solo agregado, nunca individual**, y solo con 3 o más respuestas. Es lo que hace que el feedback sea sincero. |
| 4.6 | Notificaciones Web Push | T1+T2 | Catálogo cerrado de Fase 1: examen habilitado, nota publicada, consentimiento pendiente, feedback disponible. **Nada más.** |
| 4.7 | Reportes de administración | T2 | Asistencia por cohorte, avance por módulo, uso de e-learning, exámenes pendientes de calificar con antigüedad. Todo exportable a CSV. |
| 4.8 | Panel de configuración | T2 | Edición de `system_config` por Super Admin, con historial de cambios visible. |
| 4.9 | Accesibilidad de taller | T2 | Revisión de toda la app: botones grandes, contraste alto, poco texto, uso con una mano (`00_` §4.2). No es cosmético: es requisito de contexto. |

**Sábado 29 de agosto — ensayo general:** una cohorte opera el sábado completo solo con la app:
asistencia, contenido, examen, feedback, refrigerio. **Sin respaldo de papel.**
**Criterio de salida:** el sábado transcurre sin intervención del equipo técnico.

---

# SPRINT 5 — ENDURECIMIENTO, CAPACITACIÓN Y ENTREGA
**Lunes 31 de agosto → sábado 5 de septiembre**
**Objetivo:** que el 5 de septiembre no haya sorpresas.
**Congelamiento de funciones: lunes 31 de agosto.** A partir de ahí solo se corrigen errores.

| # | Tarea | Resp. | Fecha |
|---|---|---|---|
| 5.1 | Aplicar la línea de corte de ADR-008 si algo no llegó | DP+T1 | Lunes 31 |
| 5.2 | Auditoría de seguridad: repasar la matriz de RLS tabla por tabla contra el código | T1 | Lunes 31 |
| 5.3 | Prueba de penetración básica: intentar leer datos ajenos con un token de estudiante real | T1 | Lunes 31 |
| 5.4 | Prueba de carga: 100 usuarios concurrentes | T1 | Martes 1 |
| 5.5 | Segunda restauración de respaldo, cronometrada | T1 | Martes 1 |
| 5.6 | Migración de datos reales: matrícula completa, profesores, cohortes, guías | ADM+T1 | Martes 1 – miércoles 2 |
| 5.7 | Capacitación de profesores: 90 minutos, práctica con sus propios teléfonos | T2+DP | Miércoles 2 |
| 5.8 | Capacitación de administración: 90 minutos | T2+DP | Miércoles 2 |
| 5.9 | Guía rápida de 1 página por rol, impresa y pegada en la pared | T2 | Miércoles 2 |
| 5.10 | **Despliegue a producción** | T1 | **Jueves 3** (nunca viernes) |
| 5.11 | Verificación en producción: registro real, escaneo real, examen de prueba | T1+T2 | Jueves 3 |
| 5.12 | Plan de contingencia impreso: qué hacer si falla la señal, la cámara o el sistema | T1 | Jueves 3 |
| 5.13 | Canal de soporte activo, con horario y responsable de guardia el sábado | DP | Jueves 3 |
| 5.14 | Día de reserva para imprevistos | Todos | Viernes 4 |
| 5.15 | **ENTREGA — operación en producción con toda la matrícula** | Todos | **Sábado 5** |
| 5.16 | Retrospectiva y medición contra la línea base del 1 de agosto | Todos | Domingo 6 |

### Criterio de aceptación de la Fase 1
La Fase 1 se declara entregada cuando, el sábado 5 de septiembre:
1. Toda la matrícula activa pasa asistencia por la app, sin planilla de papel.
2. Ningún estudiante menor de edad tiene cuenta activa sin consentimiento parental registrado.
3. Al menos un examen digital se aplicó y calificó parcialmente de forma automática.
4. El contenido del módulo en curso está disponible en la app.
5. El personal opera el sistema sin intervención del equipo técnico.
6. La prueba de acceso cruzado pasa en producción.
7. Existe un respaldo de menos de 24 horas con restauración probada.
8. El tiempo de pase de lista es **medible y menor** que la línea base del 1 de agosto.

Los puntos 2, 6 y 7 son **eliminatorios**: si alguno falla, la Fase 1 no se entrega, aunque
todo lo demás funcione.

---

## PLAN DE CONTINGENCIA

| Si ocurre esto | Entonces |
|---|---|
| Las guías no llegan el 14 de agosto | Se entrega con los módulos cargados pero sin sub-competencias. El mapa de dominio es Fase 2, así que no bloquea la entrega — pero sí bloquea los exámenes ligados a competencias. Se escala a la Junta el 15 de agosto. |
| ADR-007 no se aprueba antes del 7 de agosto | Se construye con la Opción A parametrizada en `system_config`. Cambiarla después es editar un valor, no reescribir código. |
| El sábado 15 falla el piloto de asistencia | Se dedica el Sprint 3 completo a arreglar asistencia y las evaluaciones se corren a Fase 1.5. **La asistencia es innegociable; las evaluaciones no.** |
| Cae la señal el 5 de septiembre | La cola sin conexión absorbe los escaneos (ADR-006). Respaldo del respaldo: planilla impresa con los nombres, cargada por el panel admin el lunes. |
| Un técnico se ausenta | Todo está en git y documentado. Se aplica la línea de corte de ADR-008 un nivel más abajo. |
| Aparece un error crítico el viernes 4 | Se revierte al despliegue del jueves 3. Por eso no se despliega en viernes. |

---

## LO QUE **NO** SE HACE EN ESTE PLAN
Escrito para que nadie lo pida en la semana 4:

- Cualquier pantalla de pagos, cuotas, saldos o estado de cuenta. **Fase 2.**
- Micro-learning en video, mapa de dominio con puntos, insignias. **Fase 2.**
- Contabilidad del fondo de refrigerios. **Fase 2** (y bloqueada por el defecto D-11).
- Red social, portafolio público, simulador, roles de especialización. **Fase 3.**
- Integración con la API de Google Classroom. **Descartada** (ADR-004).
- Publicación en App Store o Play Store. **Descartada en Fase 1** (ADR-003).
- Aplicación nativa. **Descartada en Fase 1** (ADR-003).

---

## DESPUÉS DEL 5 DE SEPTIEMBRE

**Fase 1.5 (septiembre – octubre):** lo recortado por la línea de corte, correcciones surgidas
del uso real, y la retirada progresiva de Google Classroom.

**Fase 2 (octubre – diciembre):** módulo de financiamiento completo. **Requisitos previos
que deben resolverse durante septiembre, no en octubre:**
- Spike Legal/Financiero cerrado: contrato de adhesión redactado y tratamiento fiscal definido.
- Reglas de progresión entre niveles Cash & Carry (gap #2 de `07_`).
- Base de cálculo del "30% del excedente" del fondo de refrigerios (defecto D-11).
- Fuente confiable para la tasa BCV y política de qué hacer cuando falle (defecto D-9).

**Fase 3:** no se planifica hasta tener datos reales de uso de la Fase 2.
