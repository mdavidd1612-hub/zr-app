-- =============================================================================
-- ZR APP · MIGRACIÓN 151 · Profesor por módulo: solo la cohorte en uso
-- =============================================================================
-- Hallazgo al probar la 150 en staging: "programa" para la academia es la
-- COHORTE (PTMA 2026-II), pero los módulos pertenecen al programa PTMA, que lo
-- comparten 4 cohortes. Un profesor con un módulo asignado veía las sesiones,
-- los estudiantes y las notas de TODAS las cohortes de PTMA, no solo de la que
-- está en uso.
--
-- Ahora un módulo asignado solo cuenta para las cohortes que lo tienen en su
-- calendario de módulos (migración 137): así el acceso queda atado a
-- (cohorte + módulo), sin tabla nueva. Cohortes sin calendario conservan el
-- comportamiento anterior (profesor dueño de la cohorte).
-- =============================================================================

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
  ) and exists (
    select 1 from public.cohort_module_calendar k
    where k.cohort_id = p_cohort and k.module_id = p_module
  );
$$;

create or replace function public.programa_tiene_asignaciones(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cohort_module_calendar k
    join public.teacher_module_assignments a on a.module_id = k.module_id
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
      select 1
      from public.teacher_module_assignments a
      join public.cohort_module_calendar k on k.module_id = a.module_id and k.cohort_id = p_cohort
      where a.teacher_id = auth.uid()
    );
$$;
