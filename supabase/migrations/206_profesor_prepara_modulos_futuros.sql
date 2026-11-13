-- Decisión del 13-nov-2026: el profesor puede preparar material y exámenes de
-- módulos que aún no empiezan (siempre dentro de sus asignaciones). Se quita
-- la restricción de estado que puso la migración 158/162.
create or replace function public.profesor_ve_material(p_cohort uuid, p_module uuid, p_uploaded_by uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_cohort is not null
     and exists (
           select 1 from public.mis_asignaciones_docente() x
            where x.module_id = p_module and x.cohort_id = p_cohort
         )
     and (
           p_uploaded_by = auth.uid()
           or exists (
                select 1 from public.profiles p
                 where p.id = p_uploaded_by
                   and p.role in ('direccion_academica', 'super_admin', 'admin')
              )
         );
$$;

create or replace function public.profesor_dicta(p_cohort uuid, p_module uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_cohort is not null
     and exists (
           select 1 from public.mis_asignaciones_docente() x
            where x.module_id = p_module and x.cohort_id = p_cohort
         );
$$;
