-- =============================================================================
-- ZR APP · MIGRACIÓN 038 · Asistencia sin paso de "abrir clase"
-- =============================================================================
-- Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste): administración ya no abre
-- ni cierra sesiones a mano — el QR y el registro manual deben funcionar
-- con que la sesión de hoy simplemente EXISTA. Se relaja la validación
-- original de 006_attendance.sql, que exigía status = 'abierta'.
-- Solo se sigue bloqueando una clase cancelada.
-- =============================================================================

create or replace function public.fn_attendance_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_status public.session_status;
  v_session_cohort uuid;
  v_student_cohort uuid;
begin
  select status, cohort_id into v_session_status, v_session_cohort
  from public.class_sessions where id = new.session_id;

  if v_session_status is null then
    raise exception 'La sesión de clase no existe.';
  end if;

  if v_session_status = 'cancelada' then
    raise exception 'La sesión fue cancelada.';
  end if;

  select cohort_id into v_student_cohort from public.students where id = new.student_id;

  if v_student_cohort is distinct from v_session_cohort then
    raise exception 'El estudiante no pertenece a la cohorte de esta sesión.';
  end if;

  return new;
end;
$$;
