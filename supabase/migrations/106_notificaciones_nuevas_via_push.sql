-- =============================================================================
-- ZR APP · MIGRACIÓN 106 · Los 4 tipos nuevos sí van por push, no solo in-app
-- =============================================================================
-- Corrige un detalle de la migración 105: `notifications.channel` por defecto
-- es 'in_app', y `send-push` (función 7) solo procesa channel = 'push'. Sin
-- esto, los 4 tipos nuevos quedarían silenciosos -- exactamente lo contrario
-- de lo que pidieron los estudiantes ("que suene como WhatsApp"). Se
-- redefinen las 4 funciones para insertar con channel = 'push' explícito.
-- =============================================================================

create or replace function public.fn_notify_material_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published = true and old.is_published is distinct from true then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'material_nuevo',
           'Nuevo material: ' || new.title,
           'Tu profesor subió material nuevo. Entra a la app para verlo.',
           jsonb_build_object('content_item_id', new.id),
           'push'
    from public.students s
    join public.cohorts c on c.id = s.cohort_id
    where c.current_module_id = new.module_id
      and c.status = 'activa';
  end if;
  return new;
end;
$$;

create or replace function public.fn_notify_modulo_cambiado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_modulo text;
begin
  if new.current_module_id is distinct from old.current_module_id then
    select name into v_nombre_modulo from public.modules where id = new.current_module_id;

    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'modulo_cambiado',
           'Pasaste de módulo',
           'Ya estás en "' || coalesce(v_nombre_modulo, 'un nuevo módulo') || '".',
           jsonb_build_object('module_id', new.current_module_id),
           'push'
    from public.students s
    where s.cohort_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.fn_notify_hora_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'abierta' and old.status is distinct from 'abierta' then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'hora_clase',
           'Ya puedes entrar a clase',
           'Se abrió la asistencia de hoy. Muestra tu QR al profesor.',
           jsonb_build_object('session_id', new.id),
           'push'
    from public.students s
    where s.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

create or replace function public.fn_notify_hora_refrigerio()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora_inicio text;
  v_hora_actual text;
begin
  select value #>> '{}' into v_hora_inicio
  from public.system_config where key = 'attendance.refrigerio_hora_inicio';

  v_hora_actual := to_char(now() at time zone 'America/Caracas', 'HH24:MI');

  if v_hora_inicio is not null
     and v_hora_actual >= v_hora_inicio
     and v_hora_actual < to_char((v_hora_inicio || ':00')::time + interval '5 minutes', 'HH24:MI')
     and not exists (
       select 1 from public.daily_notification_log
       where type = 'hora_refrigerio' and sent_on = current_date
     )
  then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select distinct s.id,
           'hora_refrigerio',
           'Ya puedes pasar por tu refrigerio',
           'La cantina ya está entregando refrigerios. Muestra tu QR ahí.',
           '{}'::jsonb,
           'push'
    from public.students s
    join public.attendance_events a on a.student_id = s.id
    join public.class_sessions cs on cs.id = a.session_id
    where cs.session_date = current_date;

    insert into public.daily_notification_log (type) values ('hora_refrigerio');
  end if;
end;
$$;
