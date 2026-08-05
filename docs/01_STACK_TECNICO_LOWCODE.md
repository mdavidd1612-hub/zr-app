> # ⛔ DOCUMENTO SUPERADO — NO CONSTRUIR SOBRE ESTE ARCHIVO
> **Superado el 30 de julio de 2026 por `09_DECISIONES_ARQUITECTONICAS.md` · ADR-003.**
>
> El stack real del proyecto es **Next.js (PWA) + Supabase**, escrito en código y versionado
> en git. **No se usa FlutterFlow, ni Retool, ni n8n.** La evaluación de este documento era
> correcta para un equipo de desarrolladores humanos; deja de serlo cuando quien escribe el
> código es un agente, porque una interfaz gráfica SaaS no se puede automatizar.
>
> Este archivo se conserva únicamente como registro de la evaluación original.
> **Agente de código: si llegaste aquí buscando el stack, ve a `/AGENTS.md` §3.**

---

# STACK TÉCNICO — EVALUACIÓN LOW-CODE / NO-CODE *(histórico)*
> Objetivo: viabilizar ZR App con el menor esfuerzo de ingeniería posible sin sacrificar
> escalabilidad real ni dejar al equipo "atrapado" en una herramienta que no exporta código.

## 1. CRITERIOS DE SELECCIÓN
1. Debe soportar **mobile-first real** (no solo web responsive).
2. Debe permitir **acceso a hardware nativo** (cámara para QR, NFC si se retoma).
3. Debe tener **backend con SQL real** (no solo hojas de cálculo tipo Airtable/Glide), porque
   hay relaciones complejas: pagos, cuotas, gamificación, auditoría.
4. Debe permitir **salida a código real** o extensión con código custom, para no depender 100%
   de una plataforma cerrada si el proyecto crece.
5. Debe soportar **automatizaciones** (recordatorios de pago, notificaciones, moderación).

## 2. STACK RECOMENDADO

| Capa | Herramienta | Por qué |
|---|---|---|
| Frontend móvil (estudiante) | **FlutterFlow** | Genera apps Flutter reales (iOS/Android/Web), no un "wrapper" cerrado. Permite widgets de código custom cuando el low-code no alcanza (ej. lector QR, reproductor de video corto). Exporta código Flutter legible por un desarrollador o agente de código si el proyecto escala. |
| Backend / Base de datos | **Supabase** | Postgres real (SQL, relaciones, integridad referencial), autenticación integrada, storage de archivos (PDFs, imágenes, videos cortos), Edge Functions para lógica de negocio (cálculo de cuotas, validación de pagos), Realtime para notificaciones instantáneas. No es "no-code" puro, pero es "low-ops": el equipo escribe SQL y funciones cuando hace falta, sin montar servidores. |
| Dashboard interno (Profesor / Admin) | **Retool** | Permite construir en días (no semanas) el panel de calificación de exámenes abiertos, cola de aprobación de comprobantes de pago, cola de moderación de videos UGC. Se conecta directo a Supabase/Postgres. |
| Automatizaciones / Workflows | **n8n** (self-hosted) o Make | Recordatorios de cuota próxima a vencer (cuotas semanales sabatinas), notificación al aprobar/rechazar un pago, disparo de badge al completar feedback de módulo. (No incluye alertas de racha — mecánica descartada como KPI central, ver `06_FLUJOS_USUARIO_AGENTE.md` sección 1). |
| Notificaciones push | **OneSignal** | Integración directa con FlutterFlow, gratuito hasta buen volumen de usuarios. |
| Hosting de video corto (micro-learning + UGC) | **Cloudflare Stream** (o Mux como alternativa) | Encoding automático, streaming adaptativo, más económico que construir infraestructura de video propia. Evita servir video crudo desde Supabase Storage (no está pensado para eso). |
| Generación de QR de asistencia/refrigerio | Librería nativa dentro de FlutterFlow (`qr_flutter` / `mobile_scanner`) | No requiere herramienta externa. |
| Certificados / Insignias (PDF) | Edge Function de Supabase + librería de generación de PDF (ej. `pdf-lib` en Node) | Genera el PDF al vuelo y lo guarda en Storage — incluye tanto el certificado final como la certificación de notas parcial (ver `00_CONTEXTO_MAESTRO_AGENTE.md`, sección 3.2). |
| **Google Classroom API** ⚠️ `[PENDIENTE DE DECISIÓN]` | Google Classroom (ya en uso operativo por la academia) | La política de mora confirmada bloquea "contenido digital y asignaciones vía Google Classroom" (ver `02_MODULO_FINANCIAMIENTO.md`, sección 9). Esto no estaba en el stack original. **No implementar el módulo de E-learning/bloqueo por mora hasta que TI decida** si se integra vía API de Classroom (altas/bajas de curso) o si ZR App construye su propio repositorio y Classroom queda como sistema paralelo. |

## 3. HERRAMIENTAS EVALUADAS Y DESCARTADAS (con motivo)

| Herramienta | Por qué se descarta para este proyecto |
|---|---|
| Bubble.io | Fuerte en web, débil en experiencia móvil nativa real; acceso a hardware (cámara/NFC) limitado. |
| Glide / Adalo | Backend basado en hojas de cálculo o muy simplificado; no soporta bien relaciones complejas de pagos + cuotas + auditoría. |
| Airtable como backend principal | No es una base de datos transaccional; riesgo real en módulo financiero (falta de integridad, límites de filas, sin transacciones atómicas). |
| Firebase (Firestore) como reemplazo de Supabase | Viable, pero NoSQL complica reportes financieros y relaciones tipo "cuotas de un estudiante en un módulo específico". Postgres es más natural para este dominio. |
| Construir todo con React Native + backend propio desde cero | Válido a futuro, pero para v1/v2 encarece tiempo y presupuesto sin beneficio proporcional; se puede migrar después si el proyecto escala mucho, ya que FlutterFlow exporta código real. |

## 4. FLUJO DE TRABAJO PARA UN AGENTE DE CÓDIGO
1. El agente **no debe generar backend desde cero en un framework propio** salvo instrucción
   explícita — el proyecto vive sobre Supabase (Postgres + Auth + Storage + Edge Functions).
2. Cambios de esquema de base de datos se documentan como migraciones SQL versionadas
   (`supabase/migrations/`), nunca como cambios directos no versionados.
3. Lógica de negocio sensible (cálculo de cuotas, aprobación de pagos, otorgamiento de puntos)
   vive en Edge Functions server-side, **nunca solo en el cliente** (FlutterFlow), para evitar
   manipulación desde el dispositivo del estudiante.
4. El agente debe asumir que hay tres consumidores del backend: app FlutterFlow (estudiante),
   Retool (profesor/admin) y n8n (automatizaciones) — cualquier endpoint o función debe ser
   agnóstico al cliente que lo consume.

## 5. COSTO-BENEFICIO GENERAL
Este stack permite tener un **MVP funcional en 6-10 semanas** con un equipo pequeño (1-2
desarrolladores full-stack + 1 diseñador UX), en vez de los 4-6 meses típicos de un desarrollo
100% custom, sin comprometer la posibilidad de migrar a código propio más adelante si el
proyecto crece más allá de lo que el low-code soporta cómodamente (ese punto de quiebre suele
llegar cuando se necesita el simulador visual interactivo de Fase 3).
