-- =============================================================================
-- ZR APP · MIGRACIÓN 001 · Extensiones y tipos enumerados
-- =============================================================================
-- NO EDITAR este archivo una vez aplicado. Si necesitas un cambio, crea una
-- migración nueva con el número siguiente.
--
-- Los valores de los enums están en español porque son reglas de negocio de la
-- academia y aparecen en la interfaz. Los nombres de tabla y columna van en
-- inglés. Esta mezcla es deliberada.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Roles del sistema. Un usuario tiene exactamente uno.
create type public.user_role as enum (
  'estudiante',
  'profesor',
  'admin',
  'super_admin'
);

create type public.profile_status as enum (
  'activo',
  'suspendido',
  'egresado',
  'retirado'
);

create type public.onboarding_status as enum (
  'en_curso',
  'completo'
);

-- Dos consentimientos distintos, con momento de exigibilidad distinto.
-- 'account_creation' es obligatorio en Fase 1 para menores de 18.
-- 'ugc_publication'  es de Fase 3. Se declara ahora para no migrar después.
create type public.consent_type as enum (
  'account_creation',
  'ugc_publication'
);

create type public.consent_method as enum (
  'fisico',
  'digital'
);

create type public.cohort_status as enum (
  'activa',
  'finalizada',
  'suspendida'
);

-- Una sesión es un sábado concreto de una cohorte.
-- Solo se acepta asistencia cuando está en 'abierta'.
create type public.session_status as enum (
  'programada',
  'abierta',
  'cerrada',
  'reprogramada',
  'cancelada'
);

create type public.enrollment_status as enum (
  'en_curso',
  'aprobado',
  'reprobado',
  'retirado'
);

-- Estados del examen. Ojo: 'en_progreso' y 'entregado' pertenecen al INTENTO
-- del estudiante (attempt_status), no al examen.
create type public.exam_status as enum (
  'oculto',
  'habilitado',
  'cerrado',
  'calificado'
);

create type public.question_type as enum (
  'opcion_multiple',
  'verdadero_falso',
  'redaccion_abierta'
);

create type public.attempt_status as enum (
  'en_progreso',
  'entregado',
  'calificado'
);

create type public.attendance_method as enum (
  'qr',
  'manual'
);

create type public.content_type as enum (
  'pdf',
  'presentacion',
  'imagen',
  'enlace',
  'documento'
);

create type public.notification_channel as enum (
  'push',
  'email',
  'in_app'
);
