# REGISTRO DE CAMBIOS Y GAPS ABIERTOS — ZR APP
> Este documento existe para que un agente de código (o una persona) entienda, sin releer todo
> el historial de mesas de trabajo, qué cambió en esta actualización (Julio 2026), qué quedó
> confirmado como regla de negocio definitiva, y qué preguntas siguen genuinamente abiertas.
> Fuente: respuestas formales de las Coordinaciones Administrativa/Financiera y Legal, más la
> transcripción de la mesa técnica con Coordinación Académica.

## 1. QUÉ SE CONFIRMÓ (ya no son valores por defecto sugeridos — son reglas de negocio)

| Tema | Antes (V1) | Ahora (confirmado) |
|---|---|---|
| Precio de inscripción | No definido | US$150, pago único, no reembolsable |
| Precio de módulo | No definido | US$150 |
| Estructura módulo 1 | "30-40% inicial, sugerido" | Fijo: $60 (40%) inicial + 3×$30 sábados 2-4 |
| Niveles de confianza | "Nivel 1 = más barato, sugerido" | Al revés: Nivel 1 = 60% inicial (el más caro), baja a 50% y 40% con historial puntual, aplica desde módulo 2 |
| Descuento por rendimiento académico | No definido | 10% si rendimiento en quizzes > 18/20 |
| Descuento por pronto pago | No definido | $130 si se paga de contado en divisas |
| Tasa de cambio | "A definir" | BCV oficial, sincronización diaria |
| Política de mora | Opción A/B abiertas | Confirmada Opción A: bloqueo solo digital (Google Classroom/contenido app), nunca acceso físico |
| Reembolsos por retiro | No definido | No hay reembolsos parciales; inscripción y cuotas pagadas no se devuelven |
| Volumen de comprobantes | No definido | 300-400 mensuales estimados en Fase 1 |
| Integraciones de pago | No definido | 100% manual en Fase 1, sin pasarela ni Binance API |
| Contabilización de descuentos | "A definir" | Descuento formal sobre factura o pasivo financiero formal, auditable |
| Modelo legal del financiamiento | "A validar" | Contrato de adhesión de servicios educativos con pagos parciales (no instrumento de crédito) |
| Marco legal de menores | "A validar" | LOPNNA aplica; consentimiento parental **desde Fase 1** (no solo Fase 3) |
| Certificación | No definido | Solo certificado final (13 módulos), sin certificado por módulo individual; INCES homologa 4 módulos específicos |
| Sub-competencias del mapa de dominio | "A definir con Academia" | Ya existen como Guías de Aprendizaje físicas — solo falta digitalizarlas |
| Escala de evaluación | No definido | Sobre 20; evaluación individual aprueba con 10; módulo aprueba con 12 (10 en el módulo 1) |
| Política de asistencia | No definido | Flexible — sin baja automática por conteo de faltas |
| Volumen de programa | No definido | 13 módulos, ~4 semanas c/u (excepciones de 3 y 8), 13 meses totales |
| Roles de especialización | Idea sin validar | Validada como buena idea, confirmada como Fase 3, sin owner académico asignado |

## 2. HALLAZGO NUEVO NO ANTICIPADO — INTEGRACIÓN CON GOOGLE CLASSROOM
Ningún documento anterior mencionaba Google Classroom. Al formalizar la política de mora,
la Coordinación Administrativa reveló que el "contenido digital y asignaciones" que se bloquea
vive hoy en Google Classroom, no en un repositorio que la academia vaya a construir desde cero.
**Esto es el hallazgo más importante de esta actualización** porque afecta directamente el
alcance de `01_STACK_TECNICO_LOWCODE.md` y el módulo de E-learning de `00_`. Ver detalle y
las tres preguntas concretas en `02_MODULO_FINANCIAMIENTO.md` sección 9.

## 3. GAPS QUE SIGUEN GENUINAMENTE ABIERTOS (no resueltos por esta ronda de respuestas)

| # | Gap | Por qué sigue abierto | Dónde está documentado |
|---|---|---|---|
| 1 | Integración con Google Classroom (API vs. repositorio propio) | No fue parte de las preguntas originales — es un hallazgo nuevo que requiere decisión de TI | `02_MODULO_FINANCIAMIENTO.md` §9, `01_STACK_TECNICO_LOWCODE.md` |
| 2 | Reglas exactas de progresión entre niveles Cash & Carry (cuántos pagos puntuales para subir de nivel, y si un pago tardío degrada el nivel de inmediato) | La respuesta confirmó los porcentajes pero no el mecanismo de transición | `02_MODULO_FINANCIAMIENTO.md` §2 |
| 3 | Quién filma/edita los micro-videos curriculares de 30s | El contenido base (guías) ya existe, pero la producción audiovisual en sí sigue sin responsable asignado — Spike de Producción de Video en curso (1-2 semanas) | `03_MODULO_SOCIAL_VIDEO.md` §6, `05_ROADMAP_FASES.md` |
| 4 | Quién modera contenido UGC (Fase 3) | Sigue sin resolverse; no se activa Fase 3 sin esto | `03_MODULO_SOCIAL_VIDEO.md` §2, `05_ROADMAP_FASES.md` |
| 5 | Quién diseña los cuestionarios de "roles de especialización" (Fase 3) | Confirmado como buena idea, pero no hay departamento/persona asignada | `00_CONTEXTO_MAESTRO_AGENTE.md` §3.2, `04_ESQUEMA_BASE_DATOS.md` §9 |
| 6 | Tratamiento fiscal exacto del descuento de puntos ante el ente tributario | Se confirmó el principio contable (pasivo formal), falta la ejecución fiscal específica — tarea del Spike Legal/Financiero | `02_MODULO_FINANCIAMIENTO.md` §12 |
| 7 | Redacción final del contrato de adhesión de servicios educativos | Se confirmó el enfoque legal, falta el documento contractual en sí | `02_MODULO_FINANCIAMIENTO.md` §12, `05_ROADMAP_FASES.md` |

## 4. CAMBIOS DE ALCANCE QUE UN AGENTE DE CÓDIGO DEBE NOTAR (no son solo datos, son decisiones de diseño)
1. **El registro de Fase 1 ya no es trivial para menores de edad.** El flujo de "menos de 60
   segundos" sigue siendo la meta para estudiantes mayores de edad, pero un estudiante de
   15-17 años necesariamente pasa por el paso de consentimiento parental — esto es un cambio
   de alcance del MVP de Fase 1, no un detalle de Fase 3.
2. **El nivel de confianza no es simétrico con la V1.** La lógica "empiezas caro y mejoras" es
   la inversa de lo que asumía el documento original ("empiezas con lo más barato"). Cualquier
   código o mockup ya construido basado en la V1 debe revisarse.
3. **La certificación no es incremental por módulo.** Un agente no debe asumir que cada módulo
   completado genera automáticamente un certificado individual — solo el programa completo
   (13 módulos) genera el certificado oficial; los módulos INCES son la única excepción.
4. **El mapa de dominio no es un feature de producto nuevo — es la digitalización de algo que
   ya existe.** Esto cambia la naturaleza del trabajo de Fase 0/1: no es "diseñar
   sub-competencias", es "estructurar datos ya existentes en las Guías de Aprendizaje".

## 5. DOCUMENTOS ACTUALIZADOS EN ESTA RONDA
- `00_CONTEXTO_MAESTRO_AGENTE.md` — estructura de programa, certificación, evaluaciones,
  alerta de Google Classroom, refrigerios.
- `01_STACK_TECNICO_LOWCODE.md` — fila de Google Classroom pendiente, ajuste de automatizaciones.
- `02_MODULO_FINANCIAMIENTO.md` — reescrito casi completo con precios y reglas reales.
- `03_MODULO_SOCIAL_VIDEO.md` — origen real de sub-competencias, LOPNNA, consentimiento parental.
- `05_ROADMAP_FASES.md` — matriz de hitos de Fase 0 con responsables y plazos reales.
- `06_FLUJOS_USUARIO_AGENTE.md` — estados de examen/módulo, diagramas actualizados, entidades.
- `04_ESQUEMA_BASE_DATOS.md` — **nuevo**, no existía.
- `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md` — **este documento, nuevo**.
- `contexto_zr_app.md` — marcado como histórico/superado, no como fuente de verdad.

## 6. NOTA SOBRE CONTENIDO EXCLUIDO DE ESTA ACTUALIZACIÓN
El dossier de alineación entregado incluye una transcripción de audio de la mesa técnica. Esa
transcripción contiene, junto con la información de negocio, conversación personal entre los
asistentes sin relación con el proyecto (incluyendo información sensible sobre terceros ajenos
a ZR Mecademy). Esa parte de la transcripción **no se referenció ni se incorporó** a ningún
documento técnico — solo se extrajo la información de negocio relevante (evaluaciones,
certificación, estructura de módulos, etc.), consistente con mantener esta documentación como
un artefacto técnico y no como una minuta literal de reunión.
