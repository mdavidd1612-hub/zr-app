-- =============================================================================
-- ZR APP · MIGRACIÓN 171 · Vista de recorrido: profesor, cualquier programa
-- =============================================================================
-- Bug reportado por el coordinador (audio, oct. 2026): Dirección Académica y
-- super_admin, al entrar a "Vista de Profesor" (lib/vista-recorrido.ts,
-- app/(admin)/panel/page.tsx), no son profesores de ningún módulo real, así
-- que mis_asignaciones_docente() les devolvía 0 filas y ContextoDocente
-- (componente que ya usan /temario-docente, /notas-docente, /contenido-docente,
-- /dudas-docente y /feedback-modulo-docente para elegir programa y módulo
-- antes de entrar) los mandaba siempre a "Sin programa asignado" -- nunca
-- podían elegir qué programa/módulo revisar.
--
-- La función sigue siendo la misma: solo se le agrega una quinta opción, SOLO
-- para esos dos roles, que ofrece TODAS las cohortes activas con módulo
-- vigente como si fueran "asignaciones" -- así ContextoDocente les muestra el
-- selector real de programa y módulo, igual que a un profesor de verdad, sin
-- tocar ninguna asignación real de ningún profesor.
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
  -- cualquier programa/módulo activo para recorrer la vista de profesor.
  select c.id, c.current_module_id
    from public.cohorts c
   where c.current_module_id is not null
     and c.status = 'activa'
     and exists (
       select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('direccion_academica', 'super_admin')
     );
$$;
