-- =============================================================================
-- ZR APP · MIGRACIÓN 142 · "Solvente (PENDIENTE)" con fecha límite (SOLO STAGING)
-- =============================================================================
-- Pedido del coordinador (10 oct. 2026): al poner a alguien en "Solvente
-- (PENDIENTE)" se indica HASTA CUÁNDO tiene chance (por defecto el próximo
-- sábado, editable). Si esa fecha pasa y nadie lo confirmó como solvente, pasa
-- solo a "No solvente".
--
--   * students.payment_pending_until: último día con chance (inclusive).
--   * Al pasar a 'solvente_pendiente' sin fecha, se pone el próximo sábado; al
--     pasar a cualquier otro estado, la fecha se borra.
--   * Todas las noches (00:10 hora de Caracas) los pendientes cuya fecha ya
--     pasó quedan en 'no_solvente' y reciben un aviso.
--   * El recordatorio diario ahora dice hasta cuándo tiene.
-- =============================================================================

alter table public.students
  add column payment_pending_until date;

comment on column public.students.payment_pending_until is
  'Último día (inclusive) que administración le dio de plazo en solvente_pendiente. Pasado ese día sin confirmar, pasa solo a no_solvente.';

-- El cambio automático lo hace una función de servidor (sin usuario): se le
-- permite cambiar el estado; a una persona, solo admin/super_admin como antes.
create or replace function public.fn_restringir_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and auth.uid() is not null
     and (select public.auth_role()) not in ('admin', 'super_admin')
  then
    raise exception 'Solo Administración puede cambiar el estado de solvencia.';
  end if;
  if new.payment_pending_until is distinct from old.payment_pending_until
     and auth.uid() is not null
     and (select public.auth_role()) not in ('admin', 'super_admin')
  then
    raise exception 'Solo Administración puede cambiar el plazo de solvencia.';
  end if;
  return new;
end;
$$;

-- Fecha por defecto del plazo y limpieza al salir de "pendiente".
create or replace function public.fn_normalizar_plazo_pendiente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  if new.payment_status = 'solvente_pendiente' then
    if new.payment_pending_until is null then
      -- Próximo sábado (si hoy es sábado, el de la semana que viene).
      new.payment_pending_until := v_hoy + (case when extract(dow from v_hoy)::int = 6 then 7 else 6 - extract(dow from v_hoy)::int end);
    end if;
  else
    new.payment_pending_until := null;
  end if;
  return new;
end;
$$;

create trigger trg_normalizar_plazo_pendiente
  before insert or update of payment_status, payment_pending_until on public.students
  for each row execute function public.fn_normalizar_plazo_pendiente();

-- Pasada la fecha, sin confirmar: no solvente.
create or replace function public.fn_vencer_solvencia_pendiente()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  with vencidos as (
    update public.students
    set payment_status = 'no_solvente'
    where payment_status = 'solvente_pendiente'
      and payment_pending_until is not null
      and payment_pending_until < v_hoy
    returning id
  )
  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select id, 'recordatorio_pago', 'Quedaste como no solvente',
         'Venció el plazo que te dio administración. Habla con ellos para ponerte al día.',
         '{}'::jsonb, 'push'
  from vencidos;
end;
$$;

revoke execute on function public.fn_vencer_solvencia_pendiente() from public, anon, authenticated;
revoke execute on function public.fn_normalizar_plazo_pendiente() from public, anon, authenticated;

select cron.schedule(
  'vencer-solvencia-pendiente-diario',
  '10 4 * * *',
  $$ select public.fn_vencer_solvencia_pendiente(); $$
);

-- El recordatorio diario dice hasta cuándo.
create or replace function public.fn_recordar_solvencia_pendiente()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.daily_notification_log
    where type = 'recordatorio_pago' and sent_on = current_date
  ) then
    return;
  end if;

  insert into public.notifications (profile_id, type, title, body, payload)
  select s.id,
         'recordatorio_pago',
         'Tienes un pago pendiente',
         'Tienes plazo hasta el ' || to_char(s.payment_pending_until, 'DD/MM/YYYY')
           || '. Habla con administración para ponerte al día o quedarás como no solvente.',
         '{}'::jsonb
  from public.students s
  where s.payment_status = 'solvente_pendiente';

  insert into public.daily_notification_log (type) values ('recordatorio_pago');
end;
$$;

-- La vista que usa la pantalla de Finanzas expone la fecha (al final: CREATE OR
-- REPLACE VIEW no deja reordenar columnas ya publicadas).
create or replace view public.v_students
with (security_invoker = true)
as
select
  s.id,
  s.birth_date,
  s.cohort_id,
  s.enrollment_date,
  s.onboarding_status,
  s.emergency_contact_name,
  s.emergency_contact_phone,
  s.created_at,
  p.full_name,
  p.cedula,
  p.contact_email,
  p.phone,
  p.avatar_url,
  p.status,
  public.age_years(s.birth_date)        as age_years,
  public.age_years(s.birth_date) < 18   as is_minor,
  s.address,
  s.validated_at,
  s.payment_status,
  s.payment_pending_until
from public.students s
join public.profiles p on p.id = s.id;

-- Los que ya estaban en pendiente reciben el plazo por defecto.
update public.students set payment_status = payment_status where payment_status = 'solvente_pendiente';
