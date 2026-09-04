-- =============================================================================
-- ZR APP · MIGRACIÓN 081 · Carpetas de material (tipo Classroom)
-- =============================================================================
-- A pedido explícito del coordinador: el material de un módulo se ve
-- organizado en carpetas, como Google Classroom, no una lista plana. Dirección
-- académica y super_admin pueden crear carpetas propias, como un explorador
-- de archivos — el resto de personal y los estudiantes solo navegan.
--
-- Una carpeta es de UN módulo (no cruza módulos) y puede tener carpetas
-- adentro (parent_folder_id). Los archivos existentes se quedan sin carpeta
-- (folder_id null) — aparecen "sueltos" en la raíz del módulo, nada se
-- pierde ni hay que migrarlos a mano.
-- =============================================================================

create table public.content_folders (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.modules(id) on delete cascade,
  parent_folder_id  uuid references public.content_folders(id) on delete cascade,
  name              text not null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_content_folders_module on public.content_folders (module_id, parent_folder_id);

alter table public.content_items add column folder_id uuid references public.content_folders(id) on delete set null;

alter table public.content_folders enable row level security;

create policy "estudiante: leer carpetas de su modulo"
  on public.content_folders for select to authenticated
  using (module_id = (select public.my_module_id()));

create policy "personal: leer todas las carpetas"
  on public.content_folders for select to authenticated
  using ((select public.is_staff()));

create policy "direccion: gestionar carpetas"
  on public.content_folders for all to authenticated
  using ((select public.is_academico())) with check ((select public.is_academico()));
