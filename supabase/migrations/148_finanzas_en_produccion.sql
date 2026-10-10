-- 148_finanzas_en_produccion.sql
-- Sube Finanzas (solvencia básica) a producción -- decisión del coordinador
-- (11 oct. 2026: "despliega lo de finanzas"). Es el estado final de las
-- migraciones de staging 113-116, 128, 140 y 142, PERO sin redefinir las
-- políticas de notas: en producción esas políticas ya son las de la migración
-- 147 (validación POR EVALUACIÓN con grade_validated_evals), idénticas a las de
-- staging, y ya incluyen estudiante_solvente(). Redefinirlas con la versión de
-- la 140 (validación por módulo con grade_submissions) rompería el flujo de
-- "Juan/Luis". Por eso aquí solo se toca lo de finanzas.
--
-- payment_status default 'solvente': nadie queda bloqueado al desplegar; la
-- administradora marca a mano a quién bloquear (regla de la migración 115).

-- 1. Columnas
alter table public.students
  add column if not exists payment_status text not null default 'solvente'
    check (payment_status in ('solvente', 'solvente_pendiente', 'no_solvente'));
comment on column public.students.payment_status is
  'Excepción explícita de Fase 1 (finanzas básico). Solo admin/super_admin lo cambian.';

alter table public.students
  add column if not exists payment_pending_until date;
comment on column public.students.payment_pending_until is
  'Último día (inclusive) de plazo en solvente_pendiente. Pasado ese día sin confirmar, pasa solo a no_solvente.';

-- 2. estudiante_solvente() real (reemplaza el stub de la migración 147)
create or replace function public.estudiante_solvente()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.payment_status <> 'no_solvente' from public.students s where s.id = auth.uid()),
    true
  );
$$;

-- 3. Solo admin/super_admin cambian el estado o el plazo (el proceso nocturno,
--    sin usuario, sí puede).
create or replace function public.fn_restringir_payment_status()
returns trigger language plpgsql security definer set search_path = public as $$
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
drop trigger if exists trg_restringir_payment_status on public.students;
create trigger trg_restringir_payment_status
  before update of payment_status on public.students
  for each row execute function public.fn_restringir_payment_status();

-- 4. Fecha por defecto del plazo (próximo sábado) y limpieza al salir de pendiente
create or replace function public.fn_normalizar_plazo_pendiente()
returns trigger language plpgsql set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  if new.payment_status = 'solvente_pendiente' then
    if new.payment_pending_until is null then
      new.payment_pending_until := v_hoy + (case when extract(dow from v_hoy)::int = 6 then 7 else 6 - extract(dow from v_hoy)::int end);
    end if;
  else
    new.payment_pending_until := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_normalizar_plazo_pendiente on public.students;
create trigger trg_normalizar_plazo_pendiente
  before insert or update of payment_status, payment_pending_until on public.students
  for each row execute function public.fn_normalizar_plazo_pendiente();

-- 5. Catálogo de notificaciones: agrega 'recordatorio_pago'
do $$
declare v_tipos text[];
begin
  select array_agg(distinct t) into v_tipos from (
    select unnest(array['examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible',
                        'profesor_pendiente','material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio',
                        'notas_registradas','recordatorio_pago']) t
    union
    select distinct type from public.notifications
  ) x;
  alter table public.notifications drop constraint if exists notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_tipos);
end $$;

-- 6. Recordatorio diario a quien está en solvente_pendiente (con su fecha)
create or replace function public.fn_recordar_solvencia_pendiente()
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.daily_notification_log where type = 'recordatorio_pago' and sent_on = current_date) then
    return;
  end if;
  insert into public.notifications (profile_id, type, title, body, payload)
  select s.id, 'recordatorio_pago', 'Tienes un pago pendiente',
         'Tienes plazo hasta el ' || to_char(s.payment_pending_until, 'DD/MM/YYYY')
           || '. Habla con administración para ponerte al día o quedarás como no solvente.',
         '{}'::jsonb
  from public.students s
  where s.payment_status = 'solvente_pendiente';
  insert into public.daily_notification_log (type) values ('recordatorio_pago');
end;
$$;

-- 7. Vencimiento automático del plazo
create or replace function public.fn_vencer_solvencia_pendiente()
returns void language plpgsql security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Caracas')::date;
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
revoke execute on function public.fn_recordar_solvencia_pendiente() from public, anon, authenticated;
revoke execute on function public.fn_restringir_payment_status() from public, anon, authenticated;

-- 8. Crons
select cron.schedule('recordar-solvencia-pendiente-diario', '0 16 * * *', $$ select public.fn_recordar_solvencia_pendiente(); $$);
select cron.schedule('vencer-solvencia-pendiente-diario', '10 4 * * *', $$ select public.fn_vencer_solvencia_pendiente(); $$);

-- 9. 'No solvente' no ve Material (RLS, también bloquea los archivos de Storage)
drop policy if exists "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;
create policy "estudiante: leer contenido publicado de sus modulos cursados"
  on public.content_items for select to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select public.mis_modulos_cursados())
    and (select public.estudiante_solvente())
  );

drop policy if exists "estudiante: leer carpetas de sus modulos cursados" on public.content_folders;
create policy "estudiante: leer carpetas de sus modulos cursados"
  on public.content_folders for select to authenticated
  using (
    module_id in (select public.mis_modulos_cursados())
    and (select public.estudiante_solvente())
  );

-- 10. WhatsApp de administración (para la pantalla del estudiante bloqueado)
insert into public.system_config (key, value, description, is_public) values
  ('finanzas.whatsapp_administracion', '"584128217792"'::jsonb,
   'WhatsApp de administración, con código de país y sin signos. Se muestra al estudiante bloqueado por solvencia.',
   true)
on conflict (key) do nothing;

-- 11. v_students expone los dos campos (al final: CREATE OR REPLACE no reordena)
create or replace view public.v_students
with (security_invoker = true)
as
select
  s.id, s.birth_date, s.cohort_id, s.enrollment_date, s.onboarding_status,
  s.emergency_contact_name, s.emergency_contact_phone, s.created_at,
  p.full_name, p.cedula, p.contact_email, p.phone, p.avatar_url, p.status,
  public.age_years(s.birth_date)      as age_years,
  public.age_years(s.birth_date) < 18 as is_minor,
  s.address, s.validated_at,
  s.payment_status, s.payment_pending_until
from public.students s
join public.profiles p on p.id = s.id;
