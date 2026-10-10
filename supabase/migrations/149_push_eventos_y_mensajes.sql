-- 149_push_eventos_y_mensajes.sql
-- Pedido del coordinador (11 oct. 2026): que lleguen por PUSH (no solo in-app)
-- los eventos que ya existían, con mensajes "chulos", y dos avisos nuevos de
-- clase (es hora de entrar / vas tarde). Además, permitir descartar (borrar)
-- notificaciones desde la campanita.
-- Idéntica en los dos entornos.

-- 1. Descartar notificaciones propias (la campanita ya marca leídas; esto deja borrarlas)
drop policy if exists "propias: borrar notificaciones" on public.notifications;
create policy "propias: borrar notificaciones"
  on public.notifications for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- 2. Nota validada -> PUSH + mensaje chulo (lo que el estudiante más espera)
create or replace function public.validar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_modulo text;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede validar notas.';
  end if;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';

  if not found then
    raise exception 'No hay notas enviadas para validar.';
  end if;

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
  on conflict (cohort_id, definition_id) do nothing;

  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select s.id,
         'nota_publicada',
         '¡Salieron tus notas! 📣',
         'Ya puedes ver tus notas de "' || coalesce(v_modulo, 'tu módulo') || '". Entra y mira cómo te fue. 👀',
         jsonb_build_object('module_id', p_module),
         'push'
  from public.students s
  where s.cohort_id = p_cohort;
end;
$$;

-- 3. Examen calificado -> PUSH + chulo
create or replace function public.fn_notify_attempt_graded()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_exam_title text;
begin
  if new.status = 'calificado' and old.status is distinct from 'calificado' then
    select title into v_exam_title from public.exams where id = new.exam_id;
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    values (
      new.student_id,
      'nota_publicada',
      '¡Ya tienes nota! ✅',
      'Se calificó tu examen "' || coalesce(v_exam_title, '') || '". Entra a revisarla.',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id),
      'push'
    );
  end if;
  return new;
end;
$$;

-- 4. Examen habilitado -> PUSH + chulo
create or replace function public.fn_notify_exam_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if new.status = 'habilitado' and old.status = 'oculto' then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'examen_habilitado',
           '¡Nuevo examen! 📝',
           'Tu profesor habilitó "' || new.title || '". Entra a la app y preséntalo.',
           jsonb_build_object('exam_id', new.id),
           'push'
    from public.students s
    join public.cohorts c on c.id = s.cohort_id
    where (new.cohort_id is not null and s.cohort_id = new.cohort_id)
       or (new.cohort_id is null and c.current_module_id = new.module_id and c.status = 'activa');
  end if;
  return new;
end;
$$;

-- 5. Notas enviadas por el profesor -> PUSH a Dirección (para que valide rápido)
create or replace function public.enviar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cohorte text;
  v_modulo text;
  v_suma numeric;
begin
  if not (select public.teaches_cohort(p_cohort)) then
    raise exception 'No tienes a cargo esta cohorte.';
  end if;
  if (select public.auth_role()) not in ('profesor', 'direccion_academica', 'super_admin', 'admin') then
    raise exception 'Solo el personal académico puede enviar notas.';
  end if;
  if exists (select 1 from public.grade_submissions where cohort_id = p_cohort and module_id = p_module and status = 'validado') then
    raise exception 'Estas notas ya fueron validadas.';
  end if;

  select coalesce(sum(weight_pct), 0) into v_suma from public.manual_exam_definitions where module_id = p_module;
  if v_suma <> 100 then
    raise exception 'Los porcentajes de las evaluaciones del módulo suman % %% y deben sumar 100 %%. Ajústalos en Registrar evaluación.', v_suma;
  end if;

  insert into public.grade_submissions (cohort_id, module_id, status, submitted_by)
  values (p_cohort, p_module, 'enviado', auth.uid())
  on conflict (cohort_id, module_id) do update
    set status = 'enviado', submitted_by = auth.uid(), submitted_at = now(),
        validated_by = null, validated_at = null,
        return_reason = null, returned_at = null, returned_by = null;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select prof.id,
         'notas_registradas',
         'Notas por validar 📋',
         'El profesor envió las notas de ' || coalesce(v_cohorte, 'una cohorte') || ' · ' || coalesce(v_modulo, 'módulo') || '. Falta tu validación.',
         jsonb_build_object('cohort_id', p_cohort, 'module_id', p_module),
         'push'
  from public.profiles prof
  where prof.role in ('direccion_academica', 'super_admin');
end;
$$;

-- 6. Notas devueltas -> PUSH al profesor
create or replace function public.devolver_notas(p_cohort uuid, p_module uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
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
         'push'
  from (
    select v_envio as profile_id
    union
    select tma.teacher_id from public.teacher_module_assignments tma
    where tma.module_id = p_module
  ) t
  where t.profile_id is not null;
end;
$$;

-- 7. Avisos de clase: "es hora de entrar" (a la hora) y "vas tarde" (pasada la tolerancia)
create or replace function public.fn_avisos_de_clase()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_hoy  date := (now() at time zone 'America/Caracas')::date;
  v_now  time := (now() at time zone 'America/Caracas')::time;
  v_inicio time; v_tol int; v_tarde time;
  v_ini text[] := array[
    '¡Arranca la clase! 🔧 Ya es hora de entrar. Marca tu asistencia con el QR.',
    '¡Hora de clase! ⏰ Agarra tu puesto que ya empezamos. No te quedes afuera.',
    '¡Vamos que vamos! 🚗💨 Es hora de tu clase. Entra y marca asistencia.'
  ];
  v_lat text[] := array[
    '⏳ Todavía no marcas asistencia… ¡córrele! Estás a punto de quedar inasistente.',
    '👀 ¡Ojo pelao! El reloj corre y no has llegado. Marca antes de que cuente como falta.'
  ];
  v_vi int := (extract(doy from now())::int % 3) + 1;
  v_vl int := (extract(doy from now())::int % 2) + 1;
begin
  for r in
    select cs.id as session_id, cs.cohort_id, c.turno
    from public.class_sessions cs
    join public.cohorts c on c.id = cs.cohort_id
    where cs.session_date = v_hoy and cs.status not in ('cancelada', 'reprogramada')
  loop
    v_inicio := coalesce((public.cfg_turno('attendance.hora_inicio', r.turno) #>> '{}')::time, '09:00');
    v_tol    := coalesce((public.cfg_turno('attendance.tarde_umbral_minutos', r.turno) #>> '{}')::int, 20);
    v_tarde  := v_inicio + make_interval(mins => v_tol);

    if v_now >= v_inicio and not exists (
      select 1 from public.daily_notification_log where type = 'clase_inicio:' || r.cohort_id and sent_on = v_hoy
    ) then
      insert into public.notifications (profile_id, type, title, body, payload, channel)
      select s.id, 'hora_clase', '¡Es hora de clase! 🎒', v_ini[v_vi],
             jsonb_build_object('session_id', r.session_id), 'push'
      from public.students s where s.cohort_id = r.cohort_id;
      insert into public.daily_notification_log (type) values ('clase_inicio:' || r.cohort_id);
    end if;

    if v_now >= v_tarde and not exists (
      select 1 from public.daily_notification_log where type = 'clase_tarde:' || r.cohort_id and sent_on = v_hoy
    ) then
      insert into public.notifications (profile_id, type, title, body, payload, channel)
      select s.id, 'hora_clase', '¡Vas tarde! ⏰', v_lat[v_vl],
             jsonb_build_object('session_id', r.session_id), 'push'
      from public.students s
      left join public.attendance_events ae on ae.session_id = r.session_id and ae.student_id = s.id
      where s.cohort_id = r.cohort_id and ae.id is null;
      insert into public.daily_notification_log (type) values ('clase_tarde:' || r.cohort_id);
    end if;
  end loop;
end;
$$;

revoke execute on function public.fn_avisos_de_clase() from public, anon, authenticated;

select cron.schedule('avisos-de-clase-cada-5-min', '*/5 * * * *', $$ select public.fn_avisos_de_clase(); $$);
