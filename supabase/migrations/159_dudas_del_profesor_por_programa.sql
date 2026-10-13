-- Las dudas de los estudiantes las veía todo el personal, incluido un profesor de
-- OTRO programa. Ahora el profesor solo ve las de estudiantes de los programas
-- (cohortes) donde dicta; administración y Dirección siguen viéndolas todas.
drop policy if exists doubts_select_staff on public.doubts;

create policy doubts_select_staff on public.doubts
  for select using (
    (select auth_role()) in ('admin', 'super_admin', 'direccion_academica')
    or (
      (select auth_role()) = 'profesor'
      and exists (
        select 1 from public.students s
         where s.id = doubts.student_id
           and s.cohort_id in (select cohort_id from public.mis_asignaciones_docente())
      )
    )
  );
