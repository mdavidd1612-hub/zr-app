-- Reunión/cambios del coordinador (15-nov-2026):
--  1) Una certificación puede tener remedial (un segundo intento, con espera y tope
--     de nota según aula.intento_cap_2): el profesor fija los intentos. El mensaje de
--     "ya agotaste" distingue si nunca hubo remedial o si ya se usó.
--  2) Cuando un examen se entrega y queda con respuestas abiertas por corregir
--     (status 'entregado'), el profesor recibe una notificación. Si es solo opción
--     múltiple / verdadero-falso, el sistema ya lo califica solo (nada que avisar).

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible','profesor_pendiente',
  'material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio','notas_registradas','recordatorio_pago',
  'recordatorio_notas','duda_nueva','duda_respondida','tarea_nueva','tarea_calificada','material_aprobado',
  'material_rechazado','examen_por_corregir'
]::text[]));

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
    if v_exam.kind = 'certificacion' and (v_exam.max_attempts + v_extra) <= 1 then
      raise exception 'Ya has presentado este examen.';
    elsif v_exam.kind = 'certificacion' then
      raise exception 'Ya usaste tu intento y tu remedial en esta certificación.';
    else
      raise exception 'Ya agotaste tus intentos para este examen.';
    end if;
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

create or replace function public.fn_notify_examen_por_corregir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.exams;
  v_alumno text;
begin
  if new.status = 'entregado' and (tg_op = 'INSERT' or old.status is distinct from 'entregado') then
    select * into v_exam from public.exams where id = new.exam_id;
    if v_exam.teacher_id is null then
      return new;
    end if;
    select full_name into v_alumno from public.profiles where id = new.student_id;
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    values (
      v_exam.teacher_id,
      'examen_por_corregir',
      'Examen por corregir',
      coalesce(v_alumno, 'Un estudiante') || ' entregó "' || coalesce(v_exam.title, '') || '" y tiene respuestas abiertas esperando tu corrección.',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id, 'unit_id', v_exam.unit_id),
      'push'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_examen_por_corregir on public.exam_attempts;
create trigger trg_notify_examen_por_corregir
  after insert or update of status on public.exam_attempts
  for each row execute function public.fn_notify_examen_por_corregir();

revoke all on function public.fn_notify_examen_por_corregir() from public, anon, authenticated;
