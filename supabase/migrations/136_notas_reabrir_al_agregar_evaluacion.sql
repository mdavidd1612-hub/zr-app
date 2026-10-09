-- =============================================================================
-- ZR APP · MIGRACIÓN 136 · Notas: volver a enviar cuando cambia algo (SOLO STAGING)
-- =============================================================================
-- Prueba del 9 oct. 2026: el profesor envió las notas del examen; luego
-- Dirección registró una práctica y el profesor ya no podía ponerle notas
-- porque "ya estaba enviado". Reglas nuevas:
--
--   1. Si Dirección registra una evaluación NUEVA en un módulo con notas
--      'enviado' (aún sin validar), el envío se reabre solo: el profesor
--      puede cargar la nota nueva y volver a enviar todo.
--   2. Si el profesor cambia una nota cuando ya estaba 'validado', el envío
--      se reabre (el estudiante deja de ver las notas hasta que Dirección
--      vuelva a validar): así nunca ve una nota que nadie validó.
--   3. Si está 'enviado' y esperando validación, sigue bloqueado para el
--      profesor, salvo que Dirección lo devuelva o se registre algo nuevo.
-- Al volver a enviar y validar, las notas del estudiante se refrescan solas
-- (teoría, práctica y nota final siempre se recalculan en el servidor).
-- =============================================================================

create or replace function public.fn_reabrir_envios_nueva_evaluacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.grade_submissions
  where module_id = new.module_id and status = 'enviado';
  return new;
end;
$$;

revoke execute on function public.fn_reabrir_envios_nueva_evaluacion() from public, anon, authenticated;

create trigger trg_reabrir_envios_nueva_evaluacion
  after insert on public.manual_exam_definitions
  for each row execute function public.fn_reabrir_envios_nueva_evaluacion();

create or replace function public.fn_bloquear_notas_enviadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_status text;
begin
  if (select public.auth_role()) <> 'profesor' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'manual_exam_scores' then
    v_student := coalesce(new.student_id, old.student_id);
    select module_id into v_module from public.manual_exam_definitions
      where id = coalesce(new.definition_id, old.definition_id);
  else
    v_student := coalesce(new.student_id, old.student_id);
    v_module := coalesce(new.module_id, old.module_id);
  end if;
  select cohort_id into v_cohort from public.students where id = v_student;

  select status into v_status from public.grade_submissions
  where cohort_id = v_cohort and module_id = v_module;

  if v_status = 'enviado' then
    raise exception 'Las notas están enviadas y esperan la validación de Dirección Académica. Pide que te las devuelvan para corregir.';
  elsif v_status = 'validado' then
    -- Cambio después de validar: se reabre para volver a enviar y validar.
    delete from public.grade_submissions where cohort_id = v_cohort and module_id = v_module;
  end if;
  return coalesce(new, old);
end;
$$;
