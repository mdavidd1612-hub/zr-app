-- =============================================================================
-- ZR APP · MIGRACIÓN 127 · El detalle por evaluación también espera la validación
-- =============================================================================
-- La migración 126 oculta module_enrollments hasta que Dirección Académica
-- valida. Pero el estudiante también podía leer directamente su fila de
-- manual_exam_scores (nota por evaluación) en cualquier momento, saltándose la
-- validación. Aquí se cierra ese hueco, y se le permite leer las definiciones
-- (título/tipo/escala) de los módulos ya validados para mostrar el detalle
-- en "Mis notas" (segundo nivel pedido en la reunión de sept. 2026).
-- =============================================================================

drop policy "estudiante: leer sus propias notas de examen manual" on public.manual_exam_scores;
create policy "estudiante: leer sus notas de examen validadas"
  on public.manual_exam_scores for select
  to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.manual_exam_definitions d
      join public.grade_submissions g on g.module_id = d.module_id
      where d.id = manual_exam_scores.definition_id
        and g.cohort_id = (select public.my_cohort_id())
        and g.status = 'validado'
    )
  );

create policy "estudiante: leer evaluaciones de modulos validados"
  on public.manual_exam_definitions for select
  to authenticated
  using (
    exists (
      select 1 from public.grade_submissions g
      where g.module_id = manual_exam_definitions.module_id
        and g.cohort_id = (select public.my_cohort_id())
        and g.status = 'validado'
    )
  );
