-- El profesor solo trabaja con los módulos vigentes de su programa: no ve ni sube
-- material de un módulo que aún no empieza; al llegar su fecha en el calendario
-- se habilita solo. Subir además exige que el módulo no haya terminado.
create or replace function public.profesor_ve_material(p_cohort uuid, p_module uuid, p_uploaded_by uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_cohort is not null
     and exists (
           select 1 from public.mis_asignaciones_docente() x
            where x.module_id = p_module and x.cohort_id = p_cohort
         )
     and public.estado_modulo_cohorte(p_cohort, p_module) <> 'no_empezo'
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
         )
     and public.estado_modulo_cohorte(p_cohort, p_module) in ('en_curso', 'sin_calendario');
$$;
