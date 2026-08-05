# ROADMAP POR FASES — ZR APP

## FASE 0 — SPIKES DE VALIDACIÓN (matriz confirmada por la Junta, Julio 2026)
Objetivo: reducir el riesgo de los módulos más inciertos antes de comprometer tiempo de
desarrollo. La Junta ya definió hito, responsable y plazo para cada spike — esto reemplaza la
versión genérica anterior de esta sección.

| Hito / Entregable | Área responsable | Plazo | Qué implica |
|---|---|---|---|
| Entrega de Guías Físicas | Coordinación Académica | Semana 1 | Digitalizar el plan semanal de los 13 módulos (Guías de Aprendizaje) para poblar el mapa de dominio desde la base de datos inicial. |
| Spike de Producción de Video | Profesores y Contenido | 1-2 semanas | Definir quién lidera la edición de los micro-videos curriculares de 30s (verticales, formato TikTok/Reels); validar costos de equipo y/o contratación de terceros. |
| Esquema de Base de Datos (`04_ESQUEMA_BASE_DATOS.md`) | Arquitectura de Software / TI | Semana 2 | Construir el diagrama relacional incorporando las reglas ya confirmadas: escala de 20 puntos, aprobación de evaluaciones con 10, de módulos con 12 (módulo 1 con 10), estructura unificada de QR para asistencia+refrigerios. **Ya entregado — ver el archivo.** |
| Validación de Cobertura de Red | TI & Infraestructura | Semana 1 | Auditar e instalar repetidores de conectividad en los talleres de San Antonio de los Altos para asegurar escaneo QR estable. |
| Spike Legal/Financiero | Legal + Coordinación Administrativa/Financiera | Antes de programar reglas de cuotas | Formalizar el contrato de adhesión de servicios educativos con pagos parciales (no instrumento de crédito) y el tratamiento fiscal del descuento de puntos. Ver `02_MODULO_FINANCIAMIENTO.md` secciones 3 y 12. |
| Spike de Moderación (Fase 3) | Dirección Académica | Antes de activar Fase 3 | Definir quién modera contenido UGC — sigue sin resolverse, ver `07_REGISTRO_DE_CAMBIOS_Y_GAPS_ABIERTOS.md`. |
| Decisión de integración Google Classroom | Arquitectura de Software / TI | Antes de construir Evaluaciones/E-learning | Definir si el bloqueo de mora y el contenido digital se ejecutan vía API de Google Classroom o vía repositorio propio — ver `02_MODULO_FINANCIAMIENTO.md` sección 9 y `01_STACK_TECNICO_LOWCODE.md`. **Sigue abierto, no asumir una respuesta.** |

**Nota de alcance:** "Atención crítica" declarada formalmente por la Junta — no se debe
programar ninguna regla de backend referente a cuotas o conversión de moneda hasta que el
Spike Legal/Financiero resuelva los tres puntos de la sección 12 de
`02_MODULO_FINANCIAMIENTO.md`.

## FASE 1 — MVP OPERATIVO (6-10 semanas)
Objetivo: resolver el dolor operativo diario real de la academia.
- Autenticación y Perfil
- Carnet Estudiantil Digital (versión básica, sin portafolio público aún)
- Asistencia vía QR dinámico
- Evaluaciones Digitales (opción múltiple, V/F, redacción abierta)
- Repositorio E-learning (PDFs, presentaciones, con zoom)
- Feedback micro por clase (máximo 3 preguntas)
- Dashboard de profesor (Retool): habilitar exámenes, calificar redacciones, ver feedback
- Dashboard de administración (Retool): gestión de estudiantes, módulos, reportes básicos
- **Consentimiento parental en el onboarding** para estudiantes de 15-17 años — confirmado
  como requisito de Fase 1, no de Fase 3 (ver `03_MODULO_SOCIAL_VIDEO.md`, sección 2). Esto es
  un cambio de alcance respecto al roadmap original: el flujo de registro de Fase 1 ya no es
  "solo nombre, cédula y contraseña", incluye este paso de cumplimiento legal.

**Criterio de salida de Fase 1:** la academia puede operar el día a día (asistencia, exámenes,
contenido) completamente sin planillas físicas ni WhatsApp para materiales, y el registro de
menores de edad cumple LOPNNA desde el primer día.

## FASE 2 — RETENCIÓN E INGRESOS (6-8 semanas, tras validar Fase 1 en uso real)
- Módulo de Financiamiento completo (según `02_MODULO_FINANCIAMIENTO.md`)
- Progreso y Dominio Visible con Video Micro-learning (Flujo A de `03_MODULO_SOCIAL_VIDEO.md`,
  sección 3.10 de `00_CONTEXTO_MAESTRO_AGENTE.md`)
- Refrigerios (reutilizando el QR de asistencia, sin infraestructura nueva)
- Feedback macro por módulo + emisión de insignias

**Criterio de salida de Fase 2:** la academia reduce medible mente el tiempo de cobranza manual
y mide retención real vía % de sub-competencias dominadas y tasa de finalización de
micro-learning por módulo (dato real, no estimado) — no vía días de racha consecutiva.

## FASE 3 — DIFERENCIADOR DE MARCA (sujeto a validación de tracción de Fase 2)
- Red social interna UGC (Flujo B de `03_MODULO_SOCIAL_VIDEO.md`) — **solo si el spike de
  moderación de Fase 0 sigue vigente y cubierto**
- Portafolio profesional público + Certificación oficial con QR compartible
- Roles de especialización dinámicos avanzados (cuestionarios adaptativos)
- Simulador Visual interactivo — **requiere spike técnico y de costo independiente antes de
  comprometerse a fecha**, dado que es el módulo más caro y con el ROI más incierto de todo
  el proyecto.

## REGLA GENERAL DE AVANCE ENTRE FASES
Ninguna fase inicia solo porque "ya se terminó la anterior en el calendario". Cada fase tiene
un criterio de salida basado en uso real (no solo en que el código esté desplegado). Si la
Fase 1 no logra que la academia deje de usar sus métodos manuales actuales, no tiene sentido
construir Fase 2 encima de un problema no resuelto.
