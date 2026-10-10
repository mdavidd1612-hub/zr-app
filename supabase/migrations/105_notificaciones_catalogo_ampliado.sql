-- =============================================================================
-- ZR APP · MIGRACIÓN 105 · Catálogo de notificaciones ampliado
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026), a partir de una recomendación
-- directa de los estudiantes: que la app avise como WhatsApp/Instagram (con
-- tono, aunque estén en otra app), para material nuevo, cambio de módulo, y
-- las horas de clase y de refrigerio.
--
-- La migración 009 dejó el catálogo cerrado a propósito ("no agregues otros
-- sin aprobación: el estudiante que recibe ocho avisos un sábado desinstala
-- la aplicación") y la migración 041 ya anticipó este momento exacto:
-- "se revisita si administración lo pide". Administración lo pidió.
--
-- Lo que NO entra aquí, y por qué:
--   - "duda_respondida": no se agrega. La función de que el PROFESOR responda
--     una duda nunca se construyó (migración 034 solo tiene el lado
--     estudiante) -- agregar el tipo de notificación sin la función real
--     detrás sería una notificación que nunca dispara. Queda pendiente como
--     su propia pieza de trabajo.
--   - "tarea habilitada" como tipo aparte: content_type (pdf/presentación/
--     imagen/enlace/documento) no distingue una "tarea" de cualquier otro
--     material -- lo cubre 'material_nuevo' igual que a los demás.
-- =============================================================================

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente',
    'material_nuevo',
    'modulo_cambiado',
    'hora_clase',
    'hora_refrigerio'
  ));

-- -----------------------------------------------------------------------------
-- material_nuevo — se publicó contenido para el módulo que cursa la cohorte
-- -----------------------------------------------------------------------------
create or replace function public.fn_notify_material_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published = true and old.is_published is distinct from true then
    insert into public.notifications (profile_id, type, title, body, payload)
    select s.id,
           'material_nuevo',
           'Nuevo material: ' || new.title,
           'Tu profesor subió material nuevo. Entra a la app para verlo.',
           jsonb_build_object('content_item_id', new.id)
    from public.students s
    join public.cohorts c on c.id = s.cohort_id
    where c.current_module_id = new.module_id
      and c.status = 'activa';
  end if;
  return new;
end;
$$;

create trigger trg_notify_material_nuevo
  after update on public.content_items
  for each row execute function public.fn_notify_material_nuevo();

-- -----------------------------------------------------------------------------
-- modulo_cambiado — la cohorte del estudiante pasó a otro módulo
-- -----------------------------------------------------------------------------
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

    insert into public.notifications (profile_id, type, title, body, payload)
    select s.id,
           'modulo_cambiado',
           'Pasaste de módulo',
           'Ya estás en "' || coalesce(v_nombre_modulo, 'un nuevo módulo') || '".',
           jsonb_build_object('module_id', new.current_module_id)
    from public.students s
    where s.cohort_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_notify_modulo_cambiado
  after update of current_module_id on public.cohorts
  for each row execute function public.fn_notify_modulo_cambiado();

-- -----------------------------------------------------------------------------
-- hora_clase — el profesor abrió la sesión de hoy (ya se puede marcar asistencia)
-- -----------------------------------------------------------------------------
create or replace function public.fn_notify_hora_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'abierta' and old.status is distinct from 'abierta' then
    insert into public.notifications (profile_id, type, title, body, payload)
    select s.id,
           'hora_clase',
           'Ya puedes entrar a clase',
           'Se abrió la asistencia de hoy. Muestra tu QR al profesor.',
           jsonb_build_object('session_id', new.id)
    from public.students s
    where s.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

create trigger trg_notify_hora_clase
  after update on public.class_sessions
  for each row execute function public.fn_notify_hora_clase();

-- -----------------------------------------------------------------------------
-- hora_refrigerio — se activó la ventana de escaneo en la cantina (por cron,
-- cada 5 minutos, igual que send-push -- migración 019). Un aviso por día.
-- -----------------------------------------------------------------------------
create table public.daily_notification_log (
  type    text not null,
  sent_on date not null default current_date,
  primary key (type, sent_on)
);

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

  -- Ventana de 5 minutos alrededor de la hora de inicio, para no depender de
  -- que el cron caiga exacto al minuto.
  if v_hora_inicio is not null
     and v_hora_actual >= v_hora_inicio
     and v_hora_actual < to_char((v_hora_inicio || ':00')::time + interval '5 minutes', 'HH24:MI')
     and not exists (
       select 1 from public.daily_notification_log
       where type = 'hora_refrigerio' and sent_on = current_date
     )
  then
    insert into public.notifications (profile_id, type, title, body, payload)
    select distinct s.id,
           'hora_refrigerio',
           'Ya puedes pasar por tu refrigerio',
           'La cantina ya está entregando refrigerios. Muestra tu QR ahí.',
           '{}'::jsonb
    from public.students s
    join public.attendance_events a on a.student_id = s.id
    join public.class_sessions cs on cs.id = a.session_id
    where cs.session_date = current_date;

    insert into public.daily_notification_log (type) values ('hora_refrigerio');
  end if;
end;
$$;

select cron.schedule(
  'notificar-hora-refrigerio-cada-5-min',
  '*/5 * * * *',
  $$ select public.fn_notify_hora_refrigerio(); $$
);
