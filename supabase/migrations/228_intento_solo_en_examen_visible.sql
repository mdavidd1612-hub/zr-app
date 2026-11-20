-- =============================================================================
-- ZR APP · MIGRACIÓN 228 · Un estudiante solo inicia intentos en exámenes que puede ver
-- =============================================================================
-- Hallazgo de la prueba de escenarios del 20-nov-2026: la política de INSERT de
-- `exam_attempts` solo exigía `student_id = auth.uid()`. Un estudiante de
-- PTMA-2026-II pudo crear un intento en un examen de PTMA-2026-III (que ni
-- siquiera ve), y por la misma vía en un examen oculto (borrador). El trigger
-- `fn_exam_attempt_prepare` revisa fechas, intentos y materiales, pero no si el
-- examen es suyo.
--
-- Ahora además exige que el examen exista PARA ÉL: la subconsulta a `exams`
-- corre con su RLS ("estudiante: leer examenes habilitados": publicado y de su
-- corte, o compartido de un módulo que cursa).
-- =============================================================================

drop policy if exists "estudiante: iniciar su intento" on public.exam_attempts;
create policy "estudiante: iniciar su intento" on public.exam_attempts for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from public.exams e where e.id = exam_attempts.exam_id)
  );
