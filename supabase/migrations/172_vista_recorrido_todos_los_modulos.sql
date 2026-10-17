-- =============================================================================
-- ZR APP · MIGRACIÓN 172 · Vista de recorrido: también por módulo
-- =============================================================================
-- Pedido explícito del coordinador (oct. 2026): en la vista de recorrido ya se
-- podía elegir el PROGRAMA (migración 171), pero el selector de profesor
-- (ContextoDocente, usado por /temario-docente, /notas-docente,
-- /contenido-docente, /dudas-docente y /feedback-modulo-docente) solo ofrecía
-- el módulo VIGENTE de cada cohorte -- Dirección Académica y super_admin no
-- podían revisar un módulo ya cursado ni uno futuro de ese mismo programa.
--
-- Se cambia la quinta rama de mis_asignaciones_docente() (la de vista de
-- recorrido, agregada en la 171) para que ofrezca TODOS los módulos del
-- programa de cada cohorte activa, no solo el módulo actual.
-- =============================================================================

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
     and not public.programa_tiene_asignaciones(s.cohort_id)
  union
  -- Vista de recorrido: Dirección Académica y super_admin pueden elegir
  -- cualquier módulo del programa de cualquier cohorte activa (antes, solo el
  -- módulo vigente).
  select c.id, m.id
    from public.cohorts c
    join public.modules m on m.program_id = c.program_id
   where c.status = 'activa'
     and exists (
       select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('direccion_academica', 'super_admin')
     );
$$;
