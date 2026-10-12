-- =============================================================================
-- ZR APP · MIGRACIÓN 154 · Cada cohorte (programa) tiene sus propios profesores
-- =============================================================================
-- Corrección del coordinador (12 oct. 2026): PTMA-2026-II, PTMA-2026-I,
-- PTMA-2025-II… son programas DISTINTOS aunque compartan el mismo plan de
-- módulos, y cada uno puede tener un profesor diferente en el mismo módulo.
-- "Cobertura de módulos" mostraba y escribía un solo profesor por módulo para
-- todas las cohortes de PTMA.
--
-- 1. Las asignaciones anteriores (sin cohorte) se convierten en asignaciones
--    EXPLÍCITAS por cohorte: para las cohortes con calendario que tengan ese
--    módulo; si ninguna lo tiene, para las cohortes activas de ese programa.
-- 2. Una asignación con cohorte da acceso a ESA cohorte aunque aún no tenga
--    calendario de módulos (el calendario ya no es requisito).
-- =============================================================================

-- 1. Convertir las asignaciones sin cohorte
insert into public.teacher_module_assignments (teacher_id, module_id, cohort_id, assigned_by, assigned_at)
select a.teacher_id, a.module_id, c.id, a.assigned_by, a.assigned_at
from public.teacher_module_assignments a
join public.modules m on m.id = a.module_id
join public.cohorts c on c.program_id = m.program_id and c.status = 'activa'
where a.cohort_id is null
  and (
    exists (select 1 from public.cohort_module_calendar k where k.cohort_id = c.id and k.module_id = a.module_id)
    or not exists (
      select 1 from public.cohort_module_calendar k
      join public.cohorts c2 on c2.id = k.cohort_id
      where c2.program_id = m.program_id and k.module_id = a.module_id
    )
  )
on conflict do nothing;

delete from public.teacher_module_assignments where cohort_id is null;

-- 2. Acceso por asignación explícita (con cohorte) sin exigir calendario
create or replace function public.tengo_modulo_asignado(p_cohort uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_module_assignments a
    where a.teacher_id = auth.uid() and a.module_id = p_module
      and (
        a.cohort_id = p_cohort
        or (a.cohort_id is null and exists (
          select 1 from public.cohort_module_calendar k
          where k.cohort_id = p_cohort and k.module_id = p_module))
      )
  );
$$;

create or replace function public.programa_tiene_asignaciones(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.teacher_module_assignments a where a.cohort_id = p_cohort)
      or exists (
        select 1
        from public.cohort_module_calendar k
        join public.teacher_module_assignments a on a.module_id = k.module_id and a.cohort_id is null
        where k.cohort_id = p_cohort
      );
$$;

create or replace function public.teaches_cohort(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.admin_ve_cohorte(p_cohort)
    or public.profesor_de_cohorte_antiguo(p_cohort)
    or exists (
      select 1 from public.teacher_module_assignments a
      where a.teacher_id = auth.uid() and a.cohort_id = p_cohort
    )
    or exists (
      select 1
      from public.teacher_module_assignments a
      join public.cohort_module_calendar k on k.module_id = a.module_id and k.cohort_id = p_cohort
      where a.teacher_id = auth.uid() and a.cohort_id is null
    );
$$;
