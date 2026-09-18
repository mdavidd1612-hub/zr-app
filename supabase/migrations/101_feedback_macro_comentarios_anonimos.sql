-- =============================================================================
-- ZR APP · MIGRACIÓN 101 · Leer las respuestas de redacción, de forma anónima
-- =============================================================================
-- Pedido del coordinador (sept. 2026): sin resumen con IA, Dirección Académica
-- necesita poder leer lo que los estudiantes escribieron -- sin ver quién.
--
-- Mismo patrón que `v_feedback_macro_summary` (migración 097): vista SIN
-- security_invoker, porque nadie tiene RLS de lectura sobre `feedback_macro`;
-- el control de acceso vive en el WHERE. La vista NO expone `student_id` ni
-- ninguna columna que permita rastrear al autor, y solo devuelve filas cuando
-- la cohorte+módulo ya tiene al menos `feedback.min_responses_to_show`
-- estudiantes que respondieron (con 1 o 2 respuestas en total, cualquier
-- comentario sería atribuible por descarte).
--
-- Solo Dirección Académica / super_admin (`is_academico()`). El profesor no
-- lo ve: AGENTS.md §9 le reserva únicamente el promedio del grupo.
-- =============================================================================

create view public.v_feedback_macro_comments
as
select
  s.cohort_id,
  fm.module_id,
  oa ->> 'q' as question,
  oa ->> 'a' as comment
from public.feedback_macro fm
join public.students s on s.id = fm.student_id
cross join lateral jsonb_array_elements(fm.open_answers) as oa
where
  (select public.is_academico())
  and coalesce(trim(oa ->> 'a'), '') <> ''
  and (
    select count(distinct fm2.student_id)
    from public.feedback_macro fm2
    join public.students s2 on s2.id = fm2.student_id
    where fm2.module_id = fm.module_id and s2.cohort_id = s.cohort_id
  ) >= public.cfg_int('feedback.min_responses_to_show', 3);

grant select on public.v_feedback_macro_comments to authenticated;
