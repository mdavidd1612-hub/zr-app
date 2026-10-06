-- =============================================================================
-- ZR APP · MIGRACIÓN 120 · Material: nombre original + métricas de uso
-- =============================================================================
-- 1) original_name: nombre EXACTO del archivo tal como lo subió la persona
--    (con tildes, espacios, mayúsculas). storage_path lleva el nombre
--    "limpiado" y un UUID delante, así que no sirve para mostrarlo ni para
--    descargar con el nombre que el usuario espera.
-- 2) mime_type: tipo real reportado al subir (ayuda a diagnosticar visores).
-- 3) content_access_events: bitácora de "Ver"/"Descargar" con dispositivo y
--    resultado, para medir objetivamente si el material se abre (pedido de
--    la coordinación: métricas para evaluar si las funciones hacen el trabajo).
--    Sin datos de contenido de la persona: solo id, evento, resultado y UA.
-- =============================================================================

alter table public.content_items
  add column original_name text,
  add column mime_type     text;

-- Relleno de lo ya subido: storage_path = '<module_id>/<uuid>-<nombre_limpio>'.
-- Lo mejor que se puede recuperar es el nombre limpio (sin UUID).
update public.content_items
set original_name = regexp_replace(storage_path, '^[^/]+/[0-9a-fA-F-]{36}-', '')
where storage_path is not null and original_name is null;

create table public.content_access_events (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references public.content_items(id) on delete set null,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  event       text not null check (event in ('ver', 'descargar')),
  outcome     text not null check (outcome in ('abierto', 'error_url', 'visor_fallo')),
  viewer      text check (viewer in ('pdfjs', 'office', 'nativo', 'descarga')),
  file_type   text,
  size_bytes  bigint,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_content_access_events_content on public.content_access_events (content_id);
create index idx_content_access_events_created on public.content_access_events (created_at desc);

alter table public.content_access_events enable row level security;

create policy "usuario: registra su propio evento"
  on public.content_access_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "direccion/admin: lee eventos"
  on public.content_access_events for select
  to authenticated
  using ((select public.is_admin_up()));
