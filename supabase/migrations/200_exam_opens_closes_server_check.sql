-- Pendiente de la reunión 7-nov-2026 (§8.12): el examen ya tenía opens_at/closes_at
-- en la base (alimentan el calendario, migr. 179) pero nunca se validaban al empezar
-- un intento -- un examen "sin fecha" dejaba presentar igual, sin bloquear nada.
-- Regla §6.2: nunca se valida esto solo en el cliente.
create or replace function public.fn_exam_attempt_prepare()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_exam         public.exams;
  v_previos      int;
  v_ultimo_envio timestamptz;
  v_extra        int;
begin
  select * into v_exam from public.exams where id = new.exam_id;

  if v_exam.opens_at is not null and now() < v_exam.opens_at then
    raise exception 'Este examen todavía no está disponible.';
  end if;
  if v_exam.closes_at is not null and now() > v_exam.closes_at then
    raise exception 'Ya pasó la fecha límite de este examen.';
  end if;

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
