-- =============================================================================
-- ZR APP · MIGRACIÓN 229 · Administración no cambia notas
-- =============================================================================
-- Decisión del coordinador (20-nov-2026, "No, quítaselo"): Administración es
-- el rol operativo del día a día (§2.3); las notas son de Dirección Académica
-- (y del profesor de cada módulo). Hasta ahora `admin` podía escribir notas por
-- varias vías: `admin_ve_cohorte` dentro de `teaches_cohort_module`, las
-- políticas con `is_admin_up()` o `is_staff()`, y la función `enviar_notas`.
--
-- Administración SIGUE pudiendo LEER todo (fichas, planillas, reportes).
-- Solo pierde la escritura de lo que es nota o evaluación.
--
-- De paso (hallazgo de la misma revisión): `enviar_notas` sumaba los % de las
-- evaluaciones del módulo de TODOS los cortes. Desde la migración 224 los % son
-- por corte, así que con dos cortes en el mismo módulo daba más de 100 y no
-- dejaba enviar. Ahora suma solo las del corte (o compartidas).
-- =============================================================================

-- Respuestas de examen (puntaje de redacciones)
drop policy if exists "personal: asignar puntaje" on public.exam_answers;
create policy "personal: asignar puntaje" on public.exam_answers for update to authenticated
  using ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exam_attempts a where a.id = exam_answers.attempt_id))
  with check ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exam_attempts a where a.id = exam_answers.attempt_id));

-- Intentos (nota total, estado)
drop policy if exists "personal: actualizar intentos" on public.exam_attempts;
create policy "personal: actualizar intentos" on public.exam_attempts for update to authenticated
  using ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id))
  with check ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id));

-- Intentos extra
drop policy if exists "personal: gestionar intentos extra" on public.intervention_grants;
create policy "personal: gestionar intentos extra" on public.intervention_grants for all to authenticated
  using ((select public.is_staff()) and (select public.auth_role()) <> 'admin')
  with check ((select public.is_staff()) and (select public.auth_role()) <> 'admin');
create policy "admin: leer intentos extra" on public.intervention_grants for select to authenticated
  using ((select public.is_admin_up()));

-- Evaluaciones (columnas de Notas y su %)
drop policy if exists "direccion: administra examenes manuales" on public.manual_exam_definitions;
create policy "direccion: administra examenes manuales" on public.manual_exam_definitions for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));
create policy "admin: leer evaluaciones" on public.manual_exam_definitions for select to authenticated
  using ((select public.is_admin_up()));

-- Notas manuales
drop policy if exists "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores;
create policy "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores for all to authenticated
  using ((select public.auth_role()) <> 'admin' and exists (
    select 1 from public.students s join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
     where s.id = manual_exam_scores.student_id
       and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
       and (d.cohort_id is null or d.cohort_id = s.cohort_id)))
  with check ((select public.auth_role()) <> 'admin' and exists (
    select 1 from public.students s join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
     where s.id = manual_exam_scores.student_id
       and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
       and (d.cohort_id is null or d.cohort_id = s.cohort_id)));

-- Nota del módulo (module_enrollments): se quita solo el UPDATE; el INSERT
-- (matricular) se deja igual porque lo usa el flujo de inscripción.
drop policy if exists "personal: actualizar notas de su cohorte" on public.module_enrollments;
create policy "personal: actualizar notas de su cohorte" on public.module_enrollments for update to authenticated
  using ((select public.auth_role()) <> 'admin' and (select public.teaches_cohort_module(module_enrollments.cohort_id, module_enrollments.module_id)))
  with check ((select public.auth_role()) <> 'admin' and (select public.teaches_cohort_module(module_enrollments.cohort_id, module_enrollments.module_id)));

-- Calificar tareas
drop policy if exists "personal: calificar entregas" on public.submissions;
create policy "personal: calificar entregas" on public.submissions for update to authenticated
  using ((select public.is_academico())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.assignments a join public.units u on u.id = a.unit_id
               where a.id = submissions.assignment_id and u.module_id in (select public.modulos_que_imparto()))))
  with check ((select public.is_academico())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.assignments a join public.units u on u.id = a.unit_id
               where a.id = submissions.assignment_id and u.module_id in (select public.modulos_que_imparto()))));

-- Enviar notas: sin admin, y la suma de % por corte.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.enviar_notas(uuid,uuid)'::regprocedure);
  d := replace(d, $a$('profesor', 'direccion_academica', 'super_admin', 'admin')$a$,
                  $a$('profesor', 'direccion_academica', 'super_admin')$a$);
  d := replace(d, 'from public.manual_exam_definitions where module_id = p_module;',
                  'from public.manual_exam_definitions where module_id = p_module and (cohort_id is null or cohort_id = p_cohort);');
  execute d;
end $$;
