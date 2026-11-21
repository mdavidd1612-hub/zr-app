-- 240 · Corrige 2 funciones que fallaban en producción (hallado en el ensayo del 21-nov-2026).
--
-- En un `select distinct ... 'push'` Postgres toma 'push' como text y no lo convierte solo al
-- enum notification_channel:
--   column "channel" is of type notification_channel but expression is of type text
-- Efecto real:
--   * fn_notify_hora_refrigerio (cron cada 5 min): el aviso "Ya puedes pasar por tu refrigerio"
--     nunca llegaba (41 corridas fallidas en zr-prod al 20-nov-2026).
--   * devolver_notas (botón "Devolver notas" de Dirección Académica): fallaba siempre.
-- Arreglo: 'push'::public.notification_channel. Nada más cambia.

create or replace function public.fn_notify_hora_refrigerio()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
           'push'::public.notification_channel
    from public.students s
    join public.attendance_events a on a.student_id = s.id
    join public.class_sessions cs on cs.id = a.session_id
    where cs.session_date = current_date;

    insert into public.daily_notification_log (type) values ('hora_refrigerio');
  end if;
end;
$function$;

create or replace function public.devolver_notas(p_cohort uuid, p_module uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_envio uuid;
  v_cohorte text;
  v_modulo text;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede devolver notas.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribe el motivo de la devolución para que el profesor sepa qué corregir.';
  end if;

  update public.grade_submissions
  set status = 'devuelto', return_reason = btrim(p_motivo), returned_at = now(), returned_by = auth.uid(),
      validated_by = null, validated_at = null
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado'
  returning submitted_by into v_envio;

  if not found then
    raise exception 'No hay notas enviadas por validar para devolver.';
  end if;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select distinct t.profile_id,
         'notas_registradas',
         'Te devolvieron unas notas ✍️',
         'Dirección Académica devolvió las notas de ' || coalesce(v_cohorte, 'tu cohorte') || ' · ' || coalesce(v_modulo, 'módulo') || ': ' || btrim(p_motivo),
         jsonb_build_object('cohort_id', p_cohort, 'module_id', p_module),
         'push'::public.notification_channel
  from (
    select v_envio as profile_id
    union
    select tma.teacher_id from public.teacher_module_assignments tma
    where tma.module_id = p_module
  ) t
  where t.profile_id is not null;
end;
$function$;
