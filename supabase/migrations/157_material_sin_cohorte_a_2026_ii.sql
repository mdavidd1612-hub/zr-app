-- 157: el material que existía antes de 155 (sin programa) era de PTMA-2026-II,
-- la cohorte en curso. Se le asigna ese programa, y el profesor ya no ve material
-- "general": solo el de su programa + módulo.
update public.content_items
   set cohort_id = (select id from public.cohorts where name = 'PTMA-2026-II' limit 1)
 where cohort_id is null;
update public.content_folders
   set cohort_id = (select id from public.cohorts where name = 'PTMA-2026-II' limit 1)
 where cohort_id is null;

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
