-- =============================================================================
-- ZR APP · MIGRACIÓN 141 · "Llegó tarde" se calcula con la HORA DE CLASE (error corregido)
-- =============================================================================
-- Error reportado por el coordinador (10 oct. 2026): el chulito amarillo de
-- "llegó tarde" nunca salía. Causa: fn_attendance_marcar_tarde medía el retraso
-- contra class_sessions.opened_at -- el momento en que alguien "abre" la
-- sesión --, pero las sesiones se generan solas como 'programada' y nadie las
-- abre, así que opened_at era null y TODO escaneo quedaba como 'presente'
-- (comprobado: 0 tardes en las sesiones del 26 sep, 3 oct y 10 oct aunque hubo
-- escaneos hasta las 9:39 con clase a las 9:00). Esto también alimentaba mal la
-- puntualidad de las notas.
--
-- Regla nueva: tarde = el escaneo llegó DESPUÉS de la hora de inicio de la
-- clase + la tolerancia. Hora de inicio y tolerancia salen de system_config
-- (regla 5 de CLAUDE.md), por turno (migración 129):
--   attendance.hora_inicio            -> mañana (y turnos sin valor propio): 09:00
--   attendance.hora_inicio.tarde      -> turno de la tarde: 14:00
--   attendance.tarde_umbral_minutos   -> tolerancia: 20 min (9:20 / 2:20 p.m.)
-- Una asistencia puesta a mano por administración nunca se marca tarde (no se
-- sabe a qué hora llegó), ni la de otro día distinto al de la sesión.
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values
  ('attendance.hora_inicio', '"09:00"'::jsonb,
   'Hora de inicio de la clase (HH:MM, hora de Venezuela) del turno de la mañana y de cualquier turno sin valor propio. Pasada la tolerancia (attendance.tarde_umbral_minutos) la llegada cuenta como tarde.',
   false),
  ('attendance.hora_inicio.tarde', '"14:00"'::jsonb,
   'Turno de la tarde -- hora de inicio de la clase (HH:MM, hora de Venezuela).',
   false)
on conflict (key) do nothing;

update public.system_config set value = '20'::jsonb where key = 'attendance.tarde_umbral_minutos';

-- Límite a partir del cual un escaneo es "tarde", para una fecha y un turno.
create or replace function public.limite_llegada_tarde(p_fecha date, p_turno text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select ((p_fecha::text || ' ' || coalesce(public.cfg_turno('attendance.hora_inicio', p_turno) #>> '{}', '09:00'))::timestamp
            at time zone 'America/Caracas')
         + make_interval(mins => coalesce((public.cfg_turno('attendance.tarde_umbral_minutos', p_turno) #>> '{}')::int, 15));
$$;

create or replace function public.fn_attendance_marcar_tarde()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_turno text;
begin
  select cs.session_date, c.turno into v_fecha, v_turno
  from public.class_sessions cs
  join public.cohorts c on c.id = cs.cohort_id
  where cs.id = new.session_id;

  if new.method::text = 'manual'
     or v_fecha is null
     or (new.scanned_at at time zone 'America/Caracas')::date <> v_fecha
  then
    new.status := 'presente';
  elsif new.scanned_at > public.limite_llegada_tarde(v_fecha, v_turno) then
    new.status := 'tarde';
  else
    new.status := 'presente';
  end if;

  return new;
end;
$$;

-- Las asistencias ya registradas en sesiones que nunca se "abrieron" nunca
-- pasaron por una regla de tardanza: se recalculan con la regla correcta.
update public.attendance_events ae
set status = case
  when ae.scanned_at > public.limite_llegada_tarde(cs.session_date, c.turno) then 'tarde'
  else 'presente'
end
from public.class_sessions cs
join public.cohorts c on c.id = cs.cohort_id
where ae.session_id = cs.id
  and cs.opened_at is null
  and ae.method::text <> 'manual'
  and (ae.scanned_at at time zone 'America/Caracas')::date = cs.session_date;
