# MÓDULO DE FINANCIAMIENTO — "ESTILO CASHEA" (V2 — CONFIRMADO CON DIRECCIÓN)
> **Estado: reglas de negocio confirmadas por Junta/Coordinación Administrativa y Financiera,
> Julio 2026.** Este documento reemplaza los valores "sugeridos por defecto" de la V1 por
> las cifras y políticas oficiales acordadas. Donde algo sigue pendiente, queda marcado
> explícitamente como `[PENDIENTE]`.

## 0. PRECIOS Y ESTRUCTURA CONFIRMADOS

| Concepto | Monto | Regla de negocio |
|---|---|---|
| Inscripción | **US$150** (pago único) | Obligatorio antes del primer día de clases. **No reembolsable** bajo ninguna circunstancia. |
| Mensualidad / Módulo | **US$150** por módulo | Valor estándar de un módulo (de los 13 que componen el programa completo, ver `00_CONTEXTO_MAESTRO_AGENTE.md`). Admite financiamiento fraccionado sabatino. |
| Descuento por pronto pago | **US$130** (en vez de $150) | Si el estudiante paga el módulo completo de contado, en efectivo y en divisas, el primer sábado. Reduce exposición cambiaria de la institución. |
| Incentivo académico | **10% de descuento** sobre la cuota del sistema | Aplica a estudiantes con rendimiento en quizzes/micro-learning superior a **18 puntos** (sobre 20). Ver vínculo con gamificación en sección 3. |

## 1. FRACCIONAMIENTO — MÓDULO 1 (estructura fija, no varía por nivel de confianza)
El primer módulo tiene una estructura de pago **fija e igual para todos los estudiantes**,
precisamente porque todavía no existe historial de pago que permita diferenciar niveles:

| Pago | Monto | Momento |
|---|---|---|
| Inicial | US$60 (40%) | Sábado 1 (primer día de clases del módulo) |
| Cuota 2 | US$30 (20%) | Sábado 2 |
| Cuota 3 | US$30 (20%) | Sábado 3 |
| Cuota 4 | US$30 (20%) | Sábado 4 |

**Total módulo 1: US$150 (US$60 + 3×US$30).**

## 2. NIVELES "CASH & CARRY" — A PARTIR DEL MÓDULO 2
Desde el módulo 2 en adelante se activa el sistema de niveles de confianza estilo Cashea.
A diferencia de la V1 de este documento (que asumía que el nivel inicial era el más barato),
la regla confirmada es la inversa: **el estudiante entra al nivel 1 con el inicial más alto
del sistema de niveles, y lo va reduciendo a medida que construye historial de pago puntual**:

| Nivel | % Inicial exigido | Cómo se alcanza |
|---|---|---|
| Nivel 1 (por defecto desde módulo 2) | **60%** | Estudiante que aún no tiene historial de pago puntual acumulado. |
| Nivel 2 | **50%** | Historial de pago puntual demostrado (regla exacta de "cuántos módulos puntuales" → `[PENDIENTE]`, ver sección 7). |
| Nivel 3 | **40%** | Mejor historial de pago puntual sostenido. |

**Importante para el esquema de datos:** el nivel de confianza es una propiedad que aplica
*a partir del módulo 2*; el módulo 1 nunca consulta `student_trust_level`, siempre usa la
estructura fija de la sección 1. El campo `trust_level` debe inicializarse en `NULL` o
`"no_aplica"` hasta que el estudiante complete el módulo 1.

`[PENDIENTE]` — falta definir con Dirección Académica: (a) el número exacto de pagos puntuales
consecutivos necesarios para subir de Nivel 1 → 2 → 3, y (b) si un solo pago tardío degrada el
nivel inmediatamente o si hay un margen de tolerancia. Se recomienda documentarlo como
configuración editable (no hardcodeada), consistente con `01_STACK_TECNICO_LOWCODE.md`.

## 3. VÍNCULO CON GAMIFICACIÓN (puntos → dinero) — CONFIRMADO
- El incentivo académico del 10% (sección 0) y cualquier canje de puntos del mapa de dominio
  (ver `03_MODULO_SOCIAL_VIDEO.md`) **nunca se aplican como una simple resta visual** en el
  cobro.
- Fiscal y contablemente, se registran como **un descuento formal sobre factura/servicio o
  como un movimiento contable de pasivo financiero de la academia** — decisión confirmada,
  ya no es una opción abierta. Esto garantiza que la contabilidad coincida con los ingresos
  reales reportados y sea auditable ante revisión fiscal externa.
- Tabla `points_redemptions` (ver sección 8) debe registrar cada canje como una transacción
  con su propio timestamp y motivo, nunca como un `UPDATE` directo sobre un balance de puntos.

## 4. MONEDA Y TASA DE CAMBIO — CONFIRMADO
- El USD es la moneda de anclaje de precios (inscripción y módulos en USD).
- Para pagos en bolívares, se usa **la tasa oficial de referencia del Banco Central de
  Venezuela (BCV)**, sincronizada automáticamente en la plataforma **de forma diaria**.
- Cada pago registra la tasa vigente el día de la transacción — nunca una tasa fija global —
  para evitar disputas (esto ya estaba correctamente anticipado en la V1 y se confirma).
- El incentivo de pago de contado en divisas ($130, sección 0) es la herramienta principal
  para reducir la exposición cambiaria de la academia, más que la conciliación diaria en sí.

## 5. MÉTODOS DE PAGO Y FLUJO DE VALIDACIÓN — CONFIRMADO 100% MANUAL EN FASE 1
Métodos soportados: **Binance, Pago Móvil, Transferencia Bancaria**, más pago en efectivo en
divisas (para el descuento de pronto pago). **Se confirma explícitamente que para el MVP de
Fase 1 el proceso será 100% manual, comprobante por comprobante**, sin pasarela de pago ni
integraciones automáticas nacionales o internacionales — decisión deliberada para evitar
sobrecostos, comisiones y retrasos en el ciclo de desarrollo, no una limitación técnica temporal
con fecha de resolución. Cualquier automatización de conciliación queda fuera de alcance de
Fase 1 y 2, y debe re-evaluarse como iniciativa aparte si el volumen lo justifica.

```
Estudiante sube comprobante (imagen/referencia) o paga en efectivo en caja
        ↓
Estado: PENDIENTE_REVISION
        ↓
Admin revisa en cola (Retool) — compara monto, referencia, fecha
        ↓
   ┌────┴────┐
APROBADO   RECHAZADO
   ↓            ↓
Se actualiza   Notificación al estudiante con motivo,
saldo/cuota    puede volver a subir comprobante
   ↓
Notificación push de confirmación
```

### 5.1 Volumen esperado (dimensionamiento de la cola, Fase 1)
Con ~100 estudiantes activos semanales (cifra derivada de la logística de 100 refrigerios,
ver `00_CONTEXTO_MAESTRO_AGENTE.md`) y hasta 4 transacciones mensuales por estudiante en el
esquema de módulo 1, se estima un volumen de **300 a 400 comprobantes mensuales** a procesar
manualmente en Fase 1. Este número debe usarse para dimensionar personal administrativo y
como línea base del reporte de SLA de cobranza.

### 5.2 Reglas de la cola (sin cambios respecto a V1, ya validadas)
- **SLA de revisión:** máximo sugerido de 24h hábiles.
- Cada comprobante queda **inmutable** una vez aprobado o rechazado (no se edita, se crea un
  nuevo registro si hay corrección).
- Un pago rechazado debe indicar motivo estructurado (monto no coincide, referencia inválida,
  comprobante duplicado, etc.), no solo texto libre.

## 6. ESTADO DE CUENTA (vista del estudiante) — sin cambios
Debe mostrar, sin ambigüedad:
- Costo total del programa/módulo activo.
- Monto ya pagado.
- Saldo pendiente.
- Próxima cuota: monto y fecha de corte.
- Descuento disponible por puntos de gamificación o incentivo académico (10%), si aplica.
- Historial de pagos con estado (aprobado/rechazado/pendiente).

## 7. CONSECUENCIAS DE MORA — CONFIRMADO (ya no es una opción abierta)
**Decisión formal de la Junta:** la política de mora es **estrictamente digital**:
- **Se bloquea:** acceso al contenido digital y a las asignaciones académicas a través de la
  plataforma virtual utilizada por la academia (**Google Classroom**, ver alerta técnica en
  la sección 9 y en `01_STACK_TECNICO_LOWCODE.md`).
- **No se bloquea bajo ninguna circunstancia:** el acceso físico a las aulas, talleres o
  exámenes presenciales sabatinos — normativa del Ministerio de Educación de la región de
  operación prohíbe categóricamente restringir el acceso físico por mora.
- Esta regla es ahora un requisito de cumplimiento normativo, no una preferencia de producto:
  el sistema **nunca** debe exponer, sugerir o implementar un bloqueo de acceso físico, ni
  siquiera como opción configurable por Dirección Académica.

## 8. POLÍTICA DE ABANDONO / RETIRO — CONFIRMADO (nuevo, no estaba en V1)
- La inscripción de US$150 es un pago de entrada único y **estrictamente no reembolsable**.
- Si un estudiante se retira a mitad de un módulo, **simplemente deja de pagar** las cuotas
  semanales y pierde el acceso al contenido de la plataforma inmediatamente (mismo mecanismo
  que la mora, sección 7 — desde el punto de vista de datos, un retiro y una mora prolongada
  son el mismo estado hasta que se defina lo contrario).
- **No existen reembolsos parciales** de cuotas ya pagadas ni del inicial de $60.
- Mejora aprobada (ver `06_FLUJOS_USUARIO_AGENTE.md`): al retirarse, el estudiante puede
  solicitar una **certificación de notas parcial** (constancia descargable de los módulos
  cursados y aprobados hasta ese punto) — no es un certificado oficial de técnico, pero sirve
  como aval parcial de currículum. Este documento es independiente del estado de pago.

## 9. ⚠️ ALERTA TÉCNICA — INTEGRACIÓN CON GOOGLE CLASSROOM (nuevo hallazgo, no resuelto)
La política de mora (sección 7) asume que el bloqueo de "contenido digital y asignaciones" se
ejecuta sobre **Google Classroom**, no sobre un repositorio construido internamente en
Supabase Storage como asumía `01_STACK_TECNICO_LOWCODE.md` en su versión original. Esto abre
una pregunta arquitectónica que **no puede resolver este documento por sí solo**:

- ¿El bloqueo de mora se ejecuta llamando a la **Google Classroom API** para suspender o
  remover al estudiante del curso correspondiente, y reincorporarlo automáticamente al
  regularizar su pago?
- ¿O ZR App simplemente **oculta el enlace/acceso** a Classroom dentro de la propia app sin
  tocar los permisos reales de Google Workspace for Education (en cuyo caso el estudiante
  técnicamente podría seguir entrando a Classroom directo si tiene el enlace guardado)?
- ¿La cuenta de Google Workspace for Education de cada estudiante la administra la academia
  (permitiendo automatizar altas/bajas) o es una cuenta personal del estudiante añadida
  manualmente a cada curso?

Esta pregunta se traslada formalmente a Arquitectura de Software/TI — ver
`05_ROADMAP_FASES.md` y el nuevo documento `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md`.

## 10. RESERVA DE REFRIGERIOS (nuevo, vínculo financiero confirmado)
La Junta acordó vincular la política de refrigerios al flujo de caja: se **separa
sistemáticamente el 30% del excedente del pago inicial de $60 del primer sábado** de cada
módulo para solventar los 100 refrigerios semanales del programa. Esto implica que el
esquema de datos financiero necesita una tabla o regla de reserva contable ligada al pago
inicial (ver `04_ESQUEMA_BASE_DATOS.md`, sección 6, tabla `snack_fund_ledger`), no solo el registro de pagos de
matrícula — el refrigerio deja de ser un costo operativo genérico y pasa a ser un
apartado presupuestario formal con origen de fondos trazable.

## 11. MODELO DE DATOS DEL MÓDULO (resumen — ver `04_ESQUEMA_BASE_DATOS.md` para detalle completo)
- `financing_plans` (plan de financiamiento por módulo: estructura fija de módulo 1 vs.
  niveles Cash & Carry desde módulo 2)
- `student_trust_level` (nivel de confianza actual del estudiante desde módulo 2, historial
  de cambios, `NULL` durante módulo 1)
- `installments` (cuotas individuales: monto, fecha de corte —sábado correspondiente—, estado)
- `payments` (pagos individuales: método, monto, tasa BCV del día, comprobante, estado, revisor)
- `points_redemptions` / `academic_incentive_redemptions` (canjes de puntos o del 10% por
  rendimiento académico, registrados como movimiento contable, nunca como resta simple)
- `snack_fund_ledger` (nuevo — registro del 30% reservado del inicial de cada módulo 1,
  origen de fondos para los refrigerios semanales)

## 12. RIESGOS EXPLÍCITOS — ACTUALIZADO
1. **Legal — en spike, no cerrado:** el modelo se estructurará como **contrato de adhesión de
   servicios educativos con pagos parciales** (no como instrumento de crédito financiero), para
   evitar quedar encuadrado en regulaciones de instituciones financieras. Redacción de contrato
   es tarea del Spike Legal/Financiero de Fase 0 — ver `05_ROADMAP_FASES.md`.
2. **Fraude:** comprobantes duplicados o falsificados — mitigar con validación de número de
   referencia único por transacción y cruce contra base de datos histórica.
3. **Cambiario:** mitigado por tasa BCV diaria + incentivo de pago de contado en divisas
   (sección 0 y 4) — riesgo reducido pero no eliminado, sigue siendo el punto de mayor
   exposición financiera del proyecto.
4. **Contable:** confirmado que puntos e incentivo académico se registran como pasivo
   financiero formal (sección 3) — pendiente que el Spike Legal/Financiero determine el
   tratamiento fiscal exacto ante el ente tributario correspondiente.
5. **Arquitectónico (nuevo):** la integración con Google Classroom para ejecutar el bloqueo de
   mora (sección 9) es un riesgo técnico no resuelto que puede invalidar el supuesto original
   de "repositorio E-learning propio en Supabase" — requiere decisión de TI antes de construir
   el módulo de evaluaciones/contenido.
