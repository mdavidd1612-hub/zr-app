-- =============================================================================
-- ZR APP · MIGRACIÓN 137 · Calendario de módulos por cohorte (cambio automático)
-- =============================================================================
-- Pedido del coordinador (9 oct. 2026): el módulo que cursa cada cohorte debe
-- cambiar SOLO según fechas, y el super_admin debe poder editar esas fechas
-- (por fecha y por número de sábados) desde Configuración.
--
-- Cada fila es un TRAMO: un módulo puede tener varios (Motor de combustión
-- interna se corta por las vacaciones de diciembre: dos tramos). Regla: el
-- módulo vigente de una cohorte es el del tramo con la fecha de inicio más
-- reciente que ya haya llegado; entre tramos (vacaciones, semanas sin clase)
-- se queda en el último. Antes de la primera fecha no se toca nada.
--
-- Cada noche (00:30 hora de Caracas) y cada vez que se edita el calendario se
-- actualiza cohorts.current_module_id y se corrigen los módulos de las
-- sesiones (class_sessions) según la fecha de cada una.
-- =============================================================================

create table public.cohort_module_calendar (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  module_id  uuid not null references public.modules(id),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  constraint chk_calendario_fechas check (end_date >= start_date)
);

create index idx_calendario_cohorte on public.cohort_module_calendar (cohort_id, start_date);

alter table public.cohort_module_calendar enable row level security;

create policy "personal: ver calendario de modulos"
  on public.cohort_module_calendar for select
  to authenticated
  using ((select public.is_staff()));

create policy "estudiante: ver el calendario de su cohorte"
  on public.cohort_module_calendar for select
  to authenticated
  using (cohort_id = (select public.my_cohort_id()));

create policy "super_admin: administra el calendario"
  on public.cohort_module_calendar for all
  to authenticated
  using ((select public.is_super()))
  with check ((select public.is_super()));

-- Módulo que corresponde a una cohorte en una fecha (null si no hay calendario
-- o la fecha es anterior al primer tramo).
create or replace function public.modulo_por_calendario(p_cohort uuid, p_fecha date)
returns uuid
language sql
stable
set search_path = public
as $$
  select module_id from public.cohort_module_calendar
  where cohort_id = p_cohort and start_date <= p_fecha
  order by start_date desc
  limit 1;
$$;

-- Aplica el calendario a UNA cohorte: módulo actual y módulo de sus sesiones.
create or replace function public.fn_aplicar_calendario_cohorte(p_cohort uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy    date := (now() at time zone 'America/Caracas')::date;
  v_modulo uuid;
begin
  v_modulo := public.modulo_por_calendario(p_cohort, v_hoy);
  if v_modulo is not null then
    update public.cohorts
    set current_module_id = v_modulo
    where id = p_cohort and current_module_id is distinct from v_modulo;
  end if;

  -- Cada sesión pertenece al módulo que tocaba EN SU FECHA.
  update public.class_sessions cs
  set module_id = public.modulo_por_calendario(cs.cohort_id, cs.session_date)
  where cs.cohort_id = p_cohort
    and public.modulo_por_calendario(cs.cohort_id, cs.session_date) is not null
    and cs.module_id is distinct from public.modulo_por_calendario(cs.cohort_id, cs.session_date);
end;
$$;

-- Todas las cohortes activas que tengan calendario (la corre el cron).
create or replace function public.fn_avanzar_modulos_por_calendario()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  for c in
    select distinct k.cohort_id
    from public.cohort_module_calendar k
    join public.cohorts co on co.id = k.cohort_id
    where co.status = 'activa'
  loop
    perform public.fn_aplicar_calendario_cohorte(c.cohort_id);
  end loop;
end;
$$;

revoke execute on function public.fn_aplicar_calendario_cohorte(uuid) from public, anon, authenticated;
revoke execute on function public.fn_avanzar_modulos_por_calendario() from public, anon, authenticated;

-- Al editar el calendario se aplica de inmediato.
create or replace function public.fn_trg_calendario_modulos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_aplicar_calendario_cohorte(coalesce(new.cohort_id, old.cohort_id));
  return coalesce(new, old);
end;
$$;

revoke execute on function public.fn_trg_calendario_modulos() from public, anon, authenticated;

create trigger trg_calendario_modulos
  after insert or update or delete on public.cohort_module_calendar
  for each row execute function public.fn_trg_calendario_modulos();

-- 00:30 hora de Caracas = 04:30 UTC, todos los días (antes de las 08:00 UTC
-- del sábado, cuando se generan las sesiones).
select cron.schedule(
  'avanzar-modulos-por-calendario',
  '30 4 * * *',
  $$ select public.fn_avanzar_modulos_por_calendario(); $$
);

-- ------------------------------------------------ Calendario de PTMA-2026-II
-- Fechas dadas por el coordinador (9 oct. 2026). Inglés técnico y Proyecto
-- integrador son complementarios y no entran en este calendario. Se inserta por
-- nombre de cohorte y orden del módulo dentro de su programa, así sirve igual
-- en cualquier entorno.
insert into public.cohort_module_calendar (cohort_id, module_id, start_date, end_date)
select c.id, m.id, v.inicio::date, v.fin::date
from public.cohorts c
join public.modules m on m.program_id = c.program_id
join (values
  (1,  '2026-09-05', '2026-09-19'),
  (2,  '2026-09-26', '2026-11-07'),
  (3,  '2026-11-14', '2026-11-28'),
  (4,  '2026-12-05', '2026-12-19'),
  (4,  '2027-01-09', '2027-02-06'),
  (5,  '2027-02-13', '2027-03-06'),
  (6,  '2027-03-13', '2027-04-10'),
  (8,  '2027-04-17', '2027-05-08'),
  (9,  '2027-05-15', '2027-06-05'),
  (10, '2027-06-12', '2027-07-03'),
  (12, '2027-07-10', '2027-07-31'),
  (11, '2027-08-07', '2027-08-28'),
  (13, '2027-09-04', '2027-09-25')
) as v(orden, inicio, fin) on v.orden = m.order_index
where c.name = 'PTMA-2026-II'
  and not exists (select 1 from public.cohort_module_calendar x where x.cohort_id = c.id);
