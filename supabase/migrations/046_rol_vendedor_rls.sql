-- =============================================================================
-- ZR APP · MIGRACIÓN 046 · Rol Vendedor (2/2 — datos y RLS)
-- =============================================================================
-- docs/17_PLAN_CONSOLIDADO_CURRICULUM_Y_COORDINADOR.md, Sprint 5.
-- =============================================================================

alter table public.students add column enrolled_by uuid references public.profiles(id);

comment on column public.students.enrolled_by is
  'Quién dio de alta a este estudiante (vendedor o admin). Null si se registró él mismo desde /registro.';

create or replace function public.is_vendedor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'vendedor', false);
$$;

create policy "vendedor: leer cohortes activas"
  on public.cohorts for select to authenticated
  using ((select public.is_vendedor()) and status = 'activa');

create policy "vendedor: leer estudiantes que inscribio"
  on public.students for select to authenticated
  using ((select public.is_vendedor()) and enrolled_by = auth.uid());

create policy "vendedor: leer perfiles que inscribio"
  on public.profiles for select to authenticated
  using (
    (select public.is_vendedor())
    and exists (select 1 from public.students s where s.id = profiles.id and s.enrolled_by = auth.uid())
  );
