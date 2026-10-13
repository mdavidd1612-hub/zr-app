-- El respaldo por cohorte antigua (cohorts.teacher_id / sesiones) solo vale si esa
-- cohorte aún no tiene asignaciones por módulo; si no, filtraba material ajeno.
create or replace function public.mis_asignaciones_docente()
returns table (cohort_id uuid, module_id uuid)
language sql stable security definer set search_path = public as $$
  select a.cohort_id, a.module_id
    from public.teacher_module_assignments a
   where a.teacher_id = auth.uid() and a.cohort_id is not null
  union
  select c.id, a.module_id
    from public.teacher_module_assignments a
    join public.modules m on m.id = a.module_id
    join public.cohorts c on c.program_id = m.program_id
   where a.teacher_id = auth.uid() and a.cohort_id is null
  union
  select c.id, c.current_module_id
    from public.cohorts c
   where c.teacher_id = auth.uid() and c.current_module_id is not null
     and not public.programa_tiene_asignaciones(c.id)
  union
  select s.cohort_id, s.module_id
    from public.class_sessions s
   where s.teacher_id = auth.uid() and s.module_id is not null
     and not public.programa_tiene_asignaciones(s.cohort_id);
$$;
