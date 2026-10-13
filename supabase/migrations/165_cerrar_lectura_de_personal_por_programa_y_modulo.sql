-- 165: auditoría tras el hallazgo de las dudas (13 oct. 2026). Varias políticas seguían
-- abiertas a TODO el personal con is_staff(), o sea a cualquier profesor de cualquier
-- programa y módulo: evaluaciones del módulo, exámenes (con sus preguntas, intentos y
-- respuestas), vistas de material y la lista de asignaciones. Ahora el profesor solo ve
-- lo de su programa + módulo; administración y Dirección siguen viendo todo.

-- Evaluaciones: la política del profesor ya limita por módulo; la general las abría todas.
drop policy if exists "staff: leer examenes manuales" on public.manual_exam_definitions;

-- Exámenes
drop policy if exists "personal: leer examenes" on public.exams;
create policy "personal: leer examenes" on public.exams
  for select to authenticated using (
    (select is_admin_up())
    or (select auth_role()) = 'profesor' and (
      teacher_id = (select auth.uid())
      or (cohort_id is not null and (select public.teaches_cohort_module(cohort_id, module_id)))
      or (cohort_id is null and module_id in (select public.modulos_que_imparto()))
    )
  );

drop policy if exists "personal: escribir examenes" on public.exams;
create policy "personal: escribir examenes" on public.exams
  for insert to authenticated with check (
    (select is_admin_up())
    or (select auth_role()) = 'profesor' and (
      (cohort_id is not null and (select public.teaches_cohort_module(cohort_id, module_id)))
      or (cohort_id is null and module_id in (select public.modulos_que_imparto()))
    )
  );

drop policy if exists "personal: actualizar examenes" on public.exams;
create policy "personal: actualizar examenes" on public.exams
  for update to authenticated using (
    (select is_admin_up())
    or (select auth_role()) = 'profesor' and (
      teacher_id = (select auth.uid())
      or (cohort_id is not null and (select public.teaches_cohort_module(cohort_id, module_id)))
      or (cohort_id is null and module_id in (select public.modulos_que_imparto()))
    )
  ) with check (
    (select is_admin_up())
    or (select auth_role()) = 'profesor' and (
      (cohort_id is not null and (select public.teaches_cohort_module(cohort_id, module_id)))
      or (cohort_id is null and module_id in (select public.modulos_que_imparto()))
    )
  );

-- Preguntas, intentos y respuestas: solo los de un examen que el personal puede ver.
drop policy if exists "personal: gestionar preguntas" on public.exam_questions;
create policy "personal: gestionar preguntas" on public.exam_questions
  for all to authenticated
  using ((select is_staff()) and exists (select 1 from public.exams e where e.id = exam_questions.exam_id))
  with check ((select is_staff()) and exists (select 1 from public.exams e where e.id = exam_questions.exam_id));

drop policy if exists "personal: leer intentos" on public.exam_attempts;
create policy "personal: leer intentos" on public.exam_attempts
  for select to authenticated
  using ((select is_staff()) and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id));

drop policy if exists "personal: actualizar intentos" on public.exam_attempts;
create policy "personal: actualizar intentos" on public.exam_attempts
  for update to authenticated
  using ((select is_staff()) and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id))
  with check ((select is_staff()) and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id));

drop policy if exists "personal: leer y calificar respuestas" on public.exam_answers;
create policy "personal: leer y calificar respuestas" on public.exam_answers
  for select to authenticated
  using ((select is_staff()) and exists (select 1 from public.exam_attempts a where a.id = exam_answers.attempt_id));

drop policy if exists "personal: asignar puntaje" on public.exam_answers;
create policy "personal: asignar puntaje" on public.exam_answers
  for update to authenticated
  using ((select is_staff()) and exists (select 1 from public.exam_attempts a where a.id = exam_answers.attempt_id))
  with check ((select is_staff()) and exists (select 1 from public.exam_attempts a where a.id = exam_answers.attempt_id));

-- Quién vio qué material: solo de material que el personal puede ver.
drop policy if exists "personal: leer vistas" on public.content_views;
create policy "personal: leer vistas" on public.content_views
  for select to authenticated using (
    (select is_admin_up())
    or (select auth_role()) = 'profesor'
       and exists (select 1 from public.content_items i where i.id = content_views.content_item_id)
  );

-- Asignaciones: el profesor solo ve las suyas.
drop policy if exists "personal: leer asignaciones" on public.teacher_module_assignments;
create policy "personal: leer asignaciones" on public.teacher_module_assignments
  for select to authenticated using (
    (select is_admin_up()) or teacher_id = (select auth.uid())
  );
