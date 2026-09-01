-- =============================================================================
-- ZR APP · MIGRACIÓN 056 · Asignación profesor ↔ módulo (C-2)
-- =============================================================================
-- especificacion-funcional-zrm-academy.md §7 (Módulo 5) asume que un profesor
-- es "dueño" de uno o varios módulos. El cliente confirmó que ese es el
-- modelo que quiere (docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md, C-2).
--
-- IMPORTANTE — alcance de esta migración: agrega la tabla y la pantalla de
-- asignación. NO reemplaza `cohorts.teacher_id` ni `class_sessions.teacher_id`
-- — esos siguen siendo los que de verdad controlan asistencia, notas y
-- exámenes (teaches_cohort()). Cambiar esos flujos para que dependan del
-- módulo en vez de la cohorte es trabajo aparte, más grande, y no se hace
-- aquí para no romper lo que ya funciona el 5 de septiembre.
-- =============================================================================

create table public.teacher_module_assignments (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers(id) on delete cascade,
  module_id    uuid not null references public.modules(id) on delete cascade,
  assigned_by  uuid references public.profiles(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  unique (teacher_id, module_id)
);

create index idx_tma_teacher on public.teacher_module_assignments (teacher_id);
create index idx_tma_module  on public.teacher_module_assignments (module_id);

alter table public.teacher_module_assignments enable row level security;

create policy "profesor: leer sus modulos asignados"
  on public.teacher_module_assignments for select to authenticated
  using (teacher_id = auth.uid());

create policy "personal: leer asignaciones"
  on public.teacher_module_assignments for select to authenticated
  using ((select public.is_staff()));

create policy "direccion: gestionar asignaciones"
  on public.teacher_module_assignments for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
