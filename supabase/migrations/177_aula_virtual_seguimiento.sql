-- =============================================================================
-- ZR APP · MIGRACIÓN 177 · Aula Virtual — Fase 4: seguimiento
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §6.3-6.4: mini-chequeo opcional al terminar un
-- material (content_items.check_quiz_id, agregado en la 175) y bloqueo de la
-- certificación de una unidad mientras falten materiales obligatorios.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Al aprobar el mini-chequeo, valida el material asociado
-- -----------------------------------------------------------------------------
-- No se edita fn_close_attempt_if_graded (007) ni fn_cap_attempt_score (176):
-- se agrega un disparador más sobre exam_attempts, que ya es donde esos dos
-- terminan de escribir status/total_score.
create or replace function public.fn_validate_material_on_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'calificado' and (old.status is distinct from 'calificado') then
    update public.material_progress mp
    set validated = true
    from public.content_items ci
    where ci.check_quiz_id = new.exam_id
      and mp.content_item_id = ci.id
      and mp.student_id = new.student_id
      and new.total_score >= (select e.passing_score from public.exams e where e.id = new.exam_id);
  end if;
  return new;
end;
$$;

create trigger trg_validate_material_on_pass
  after update of status on public.exam_attempts
  for each row execute function public.fn_validate_material_on_pass();

-- -----------------------------------------------------------------------------
-- 2. ¿Ya completó todos los materiales obligatorios de la unidad?
-- -----------------------------------------------------------------------------
-- Un material obligatorio sin mini-chequeo se considera completo con
-- material_progress.completed_at (el umbral de 90%, migración 175). Uno CON
-- mini-chequeo necesita además validated = true (el chequeo aprobado).
-- Misma guarda que unit_prerequisite_met (176): SECURITY DEFINER salta la
-- RLS de material_progress a propósito, así que sin esto cualquier
-- estudiante autenticado podría consultar el avance de OTRO en el material.
create or replace function public.fn_unit_required_complete(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_student_id = auth.uid() or public.is_staff()) and not exists (
    select 1
    from public.unit_items ui
    join public.content_items ci on ci.id = ui.content_item_id
    where ui.unit_id = p_unit_id
      and ui.type = 'material'
      and ui.required = true
      and not exists (
        select 1 from public.material_progress mp
        where mp.content_item_id = ci.id
          and mp.student_id = p_student_id
          and (
            (ci.check_quiz_id is null and mp.completed_at is not null)
            or (ci.check_quiz_id is not null and mp.validated = true)
          )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Bloquear el intento de certificación si faltan materiales obligatorios
-- -----------------------------------------------------------------------------
-- Se reemplaza fn_exam_attempt_prepare (176, todavía no vive en main/prod --
-- se puede seguir ampliando sin romper nada ya en uso real) agregando esta
-- validación al principio, antes de contar intentos previos.
create or replace function public.fn_exam_attempt_prepare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam         public.exams;
  v_previos      int;
  v_ultimo_envio timestamptz;
  v_extra        int;
begin
  select * into v_exam from public.exams where id = new.exam_id;

  if v_exam.kind = 'certificacion' and v_exam.unit_id is not null
     and not public.fn_unit_required_complete(v_exam.unit_id, new.student_id) then
    raise exception 'Todavía te faltan materiales obligatorios de esta unidad.';
  end if;

  select count(*), max(submitted_at)
    into v_previos, v_ultimo_envio
  from public.exam_attempts
  where exam_id = new.exam_id and student_id = new.student_id;

  select count(*) into v_extra
  from public.intervention_grants
  where exam_id = new.exam_id and student_id = new.student_id;

  if v_previos >= (v_exam.max_attempts + v_extra) then
    raise exception 'Ya agotaste tus intentos para este examen.';
  end if;

  if v_previos > 0 then
    if v_ultimo_envio is null then
      raise exception 'Todavía tienes un intento en progreso.';
    end if;
    if now() < v_ultimo_envio + make_interval(hours => v_exam.cooldown_hours) then
      raise exception 'Debes esperar % horas desde tu intento anterior.', v_exam.cooldown_hours;
    end if;
  end if;

  new.attempt_number := v_previos + 1;
  new.score_cap_applied := case
    when new.attempt_number <= 1 then public.cfg_num('aula.intento_cap_1', 100)
    else public.cfg_num('aula.intento_cap_2', 80)
  end;
  if v_exam.duration_minutes is not null then
    new.expires_at := now() + make_interval(mins => v_exam.duration_minutes);
  end if;

  return new;
end;
$$;
