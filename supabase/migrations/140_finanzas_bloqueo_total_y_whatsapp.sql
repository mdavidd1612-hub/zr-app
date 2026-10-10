-- =============================================================================
-- ZR APP · MIGRACIÓN 140 · Finanzas: bloqueo total + contacto de administración (SOLO STAGING)
-- =============================================================================
-- Pedido del coordinador (10 oct. 2026): un estudiante 'no_solvente' queda
-- bloqueado en TODA la app salvo Perfil, y se le muestra cómo hablar con
-- administración.
--   1. El número de WhatsApp de administración vive en system_config (regla 5
--      de CLAUDE.md: ningún dato de negocio en el código) y es público para que
--      la pantalla del estudiante lo pueda leer.
--   2. Las notas también se ocultan al no solvente (Material ya se ocultaba en
--      la migración 128; asistencia y refrigerio se bloquean en las funciones
--      de servidor).
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values
  ('finanzas.whatsapp_administracion', '"584128217792"'::jsonb,
   'WhatsApp de administración, con código de país y sin signos (ej. 58412...). Se muestra al estudiante bloqueado por solvencia.',
   true)
on conflict (key) do nothing;

drop policy "estudiante: leer sus notas validadas" on public.module_enrollments;
create policy "estudiante: leer sus notas validadas"
  on public.module_enrollments for select
  to authenticated
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_submissions g
      where g.cohort_id = module_enrollments.cohort_id
        and g.module_id = module_enrollments.module_id
        and g.status = 'validado'
    )
  );

drop policy "estudiante: leer sus notas de examen validadas" on public.manual_exam_scores;
create policy "estudiante: leer sus notas de examen validadas"
  on public.manual_exam_scores for select
  to authenticated
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1
      from public.manual_exam_definitions d
      join public.grade_submissions g on g.module_id = d.module_id
      where d.id = manual_exam_scores.definition_id
        and g.cohort_id = (select public.my_cohort_id())
        and g.status = 'validado'
    )
  );

drop policy "estudiante: leer evaluaciones de modulos validados" on public.manual_exam_definitions;
create policy "estudiante: leer evaluaciones de modulos validados"
  on public.manual_exam_definitions for select
  to authenticated
  using (
    (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_submissions g
      where g.module_id = manual_exam_definitions.module_id
        and g.cohort_id = (select public.my_cohort_id())
        and g.status = 'validado'
    )
  );
