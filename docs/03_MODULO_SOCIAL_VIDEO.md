# MÓDULO DE VIDEO MICRO-LEARNING Y RED SOCIAL INTERNA (UGC)
> Reemplaza el sistema de "5 preguntas diarias estilo Duolingo" por un formato de video corto
> (30 segundos), más afín al público de 15-25 años, y añade una capa social de contenido
> generado por los propios estudiantes (mecánica, autos, carreras).

## 1. DOS FLUJOS DE CONTENIDO DISTINTOS (no deben mezclarse en el modelo de datos)

### 1.1 Flujo A — Micro-learning curado y mapa de dominio (no es un sistema de racha)
> Fundamento: un meta-análisis reciente sobre gamificación educativa encuentra efecto pequeño
> a moderado sobre motivación (Hedges' g entre 0.26 y 0.65 según el estudio) y, sobre todo,
> encuentra que la gamificación mejora percepción de autonomía y pertenencia pero tiene impacto
> mínimo en percepción de competencia — justo la variable que más predice motivación sostenida.
> Por eso este flujo prioriza mostrar dominio verificable, no premiar constancia diaria.

- Video de **30 segundos máximo**, producido o curado por profesores/admin, ligado al módulo
  académico activo del estudiante y a una **sub-competencia específica** (no solo "al módulo").
- **Confirmado:** las sub-competencias por módulo/semana ya existen como **Guías de
  Aprendizaje** físicas (investigación previa + práctica de taller el sábado). El video de
  30s debe ligarse 1:1 al objetivo de la guía de esa semana — el mapa de dominio se llena
  "sábado a sábado" siguiendo esa estructura ya existente, no una taxonomía nueva de
  sub-competencias inventada por el equipo de producto.
- Al terminar el video, aparece **1 pregunta corta** (opción múltiple o V/F) sobre el contenido.
- Responder correctamente avanza el indicador de dominio de esa sub-competencia en el carnet
  digital (ver `00_CONTEXTO_MAESTRO_AGENTE.md`, sección 3.10) y suma puntos redimibles.
- Una racha diaria puede mostrarse como dato secundario de actividad, pero **no es el mecanismo
  de retención principal ni el KPI de éxito del módulo** — el KPI real es % de sub-competencias
  dominadas y tasa de finalización de micro-learning por módulo (ver `06_FLUJOS_USUARIO_AGENTE.md`).
- Este contenido **no es público ni editable por estudiantes** — es curricular, sale del
  dashboard de profesor/admin (Retool), igual que las evaluaciones.
- Objetivo de producto: sustituir el "quiz de texto" por algo audiovisual, más parecido a
  TikTok/Reels que a un formulario, para el público objetivo — el formato es lo que se toma de
  apps de consumo masivo, no el mecanismo de enganche.

### 1.2 Flujo B — Red social interna de UGC (contenido generado por estudiantes)
- Estudiantes pueden subir sus propios videos cortos: mecánica, autos, carreras, proyectos
  personales de taller, etc.
- Interacciones sociales básicas: like, comentario, contador de vistas.
- Objetivo de producto: generar retención por comunidad (no solo por obligación académica) y
  reforzar identidad de marca ("mecánicos jóvenes mostrando su pasión").
- Este contenido **es independiente del sistema de puntos académicos** — no debe otorgar puntos
  de gamificación directamente, para no incentivar spam de videos solo por farmear puntos.
  (Opcional a evaluar en Fase 3: un sistema de reconocimiento social separado, tipo "video
  destacado de la semana" elegido por admin, sin impacto en el sistema de pagos/descuentos).

## 2. CONSIDERACIONES DE SEGURIDAD Y MODERACIÓN (no negociables dado el público)
El público objetivo incluye **menores de edad (15-17 años)**. Cualquier función tipo "red
social" con subida de video y comentarios abiertos debe diseñarse con estas reglas desde el
esquema de datos, no como un parche posterior:

**Marco legal confirmado (ya no es una suposición de producto):** el proyecto opera bajo la
**Ley Orgánica para la Protección de Niños, Niñas y Adolescentes (LOPNNA)**, que limita
rigurosamente la exhibición pública de información personal e imágenes de menores. Esto no
es opcional ni configurable por Dirección Académica — es un piso legal.

**Consentimiento parental — confirmado y con alcance ampliado respecto a la V1 de este
documento:** para estudiantes de 15 a 17 años se exige un paso de **declaración y
consentimiento parental obligatorio dentro del flujo de registro (onboarding)**, es decir,
**desde la Fase 1**, no solo antes de habilitar UGC en Fase 3 como se asumía originalmente.
El representante legal debe firmar un consentimiento (físico o digitalizado) que autorice:
(a) la creación de la cuenta académica del menor (Fase 1, obligatorio para todos), y
(b) específicamente, el uso y publicación de contenido multimedia generado por el estudiante
(Fase 3, solo si/cuando se habilite UGC). El agente de código debe modelar estos dos
consentimientos como **campos o registros separados**, no como un único checkbox genérico,
porque tienen alcance y momento de exigibilidad distintos.

1. **Sin mensajería privada (DM) entre usuarios en la v1.** Reduce significativamente el riesgo
   de contacto no supervisado entre menores y adultos dentro de la plataforma. Toda interacción
   social debe ser pública y moderable (comentarios visibles, no chats 1 a 1).
2. **Cola de moderación previa a publicación** para todo video UGC — un video no debe ser
   visible públicamente hasta pasar por revisión de admin o un filtro automatizado + revisión
   humana para casos ambiguos.
3. **Sistema de reporte visible** en cada video/comentario, con acción rápida de admin
   (ocultar, eliminar, advertir cuenta).
4. **Perfiles públicos limitados:** el perfil social no debe exponer datos sensibles (cédula,
   ubicación exacta, horario de clases) — solo nombre, avatar, videos publicados.
5. **Distinción clara entre menores y adultos en el sistema**, aunque no se segmente la vista
   pública, para que Dirección Académica pueda aplicar políticas diferenciadas si es necesario
   (ej. supervisión adicional en cuentas de menores).
6. Este módulo se recomienda como **Fase 3, no v1**, precisamente porque requiere resolver
   moderación y seguridad antes de habilitar interacción social abierta — lanzarlo apurado es
   el mayor riesgo reputacional de todo el proyecto.

## 3. MODELO DE DATOS (resumen)
- `learning_videos` (Flujo A: video curricular, módulo asociado, pregunta ligada, guía de
  aprendizaje de origen)
- `learning_video_responses` (respuesta del estudiante, correcto/incorrecto, puntos otorgados)
- `ugc_videos` (Flujo B: autor, url de video, estado de moderación, contador de likes/vistas)
- `ugc_video_comments` (comentarios, con relación a moderación)
- `ugc_reports` (reportes de usuarios sobre contenido, con estado de resolución)
- `moderation_log` (auditoría de acciones de moderación: quién, qué, cuándo)
- `parental_consents` (nuevo — confirmado en sección 2: consentimiento de cuenta (Fase 1,
  obligatorio para 15-17 años) y consentimiento de UGC (Fase 3), como registros separados con
  su propio timestamp, representante legal y método de firma)

## 4. INFRAESTRUCTURA TÉCNICA
- Hosting/streaming de video: Cloudflare Stream o Mux (ver `01_STACK_TECNICO_LOWCODE.md`) —
  nunca servir video pesado directo desde el storage genérico de Supabase.
- Compresión y formato vertical (9:16) obligatorio para ambos flujos, pensado para consumo
  100% móvil.
- Duración máxima técnica configurable (30s para Flujo A; sugerido 60s máximo para Flujo B
  para no convertir la app en una plataforma de video general).

## 5. MÉTRICAS DE ÉXITO A DEFINIR ANTES DE LANZAR
- % de estudiantes que completan el micro-learning diario (Flujo A).
- Retención de racha a 7 y 30 días.
- Para Flujo B (si se activa en Fase 3): ratio de videos reportados/aprobados, tiempo promedio
  de moderación, % de estudiantes que suben al menos un video al mes.

## 6. RIESGOS EXPLÍCITOS A VALIDAR ANTES DE CONSTRUIR
1. **Producción de contenido Flujo A — parcialmente resuelto:** el contenido curricular base
   (sub-competencias) ya existe vía las Guías de Aprendizaje (sección 1.1). Lo que **sigue
   sin resolver** es quién filma/edita los videos verticales de 30s a partir de esas guías —
   la Junta asignó un **Spike de Producción de Video (1-2 semanas, Profesores y Contenido)**
   para definir responsable y validar costos de equipo o contratación de terceros (ver
   `05_ROADMAP_FASES.md`). No asumir que esto ya está resuelto solo porque el contenido base
   sí lo está.
2. **Moderación Flujo B:** requiere persona(s) asignada(s) o herramienta de moderación
   automática (ej. detección de contenido inapropiado) — no puede depender solo de buena
   voluntad de revisión manual esporádica.
3. **Costo de hosting de video:** a diferencia de texto/imágenes, el video escala en costo con
   el número de usuarios activos; debe presupuestarse desde el inicio, no como sorpresa post-
   lanzamiento.
