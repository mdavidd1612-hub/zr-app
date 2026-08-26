-- =============================================================================
-- ZR APP · MIGRACIÓN 041 · Aprobación de material subido por el profesor
-- =============================================================================
-- Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint E): cuando el profesor sube
-- material, queda pendiente hasta que administración lo revise y lo
-- apruebe (o lo rechace con un mensaje). El material que sube
-- administración se aprueba solo — ya es quien decide qué se publica.
--
-- Nota: NO se agrega un tipo nuevo a `notifications` (009_notifications.sql
-- deja escrito "catálogo cerrado, no agregues otros sin aprobación"). El
-- aviso al profesor se resuelve mostrando el estado directo en su pantalla
-- de Material, no con push — se revisita si administración lo pide.
-- =============================================================================

create type public.content_approval_status as enum ('aprobado', 'pendiente', 'rechazado');

alter table public.content_items
  add column approval_status public.content_approval_status not null default 'aprobado',
  add column review_message  text,
  add column reviewed_by     uuid references public.profiles(id),
  add column reviewed_at     timestamptz;
