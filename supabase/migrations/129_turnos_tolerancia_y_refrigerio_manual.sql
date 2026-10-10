-- =============================================================================
-- ZR APP · MIGRACIÓN 129 · Turnos (tolerancia y refrigerio) + apertura manual
-- =============================================================================
-- Reunión de sept. 2026:
--   1. La tolerancia de "tarde" y la ventana del refrigerio se configuran POR
--      TURNO. Convención: la clave general (ej. attendance.tarde_umbral_minutos)
--      es la del turno de la mañana y la de cualquier turno sin valor propio;
--      cada turno puede tener la suya con sufijo (.tarde, .mediodia). El turno
--      de mediodía queda previsto: basta crear la clave con ese sufijo desde
--      Configuración.
--   2. ZR Coffee (y super_admin) pueden abrir o cerrar el refrigerio a mano,
--      por turno y por día. La decisión manual manda sobre el horario.
--
-- Los valores del turno de la TARDE son PROVISIONALES (mismo patrón del turno
-- de la mañana: clase 2:00 p.m., refrigerio 2 h después): Dirección debe
-- confirmarlos o cambiarlos en Configuración.
-- =============================================================================

insert into public.system_config (key, value, description) values
  ('attendance.tarde_umbral_minutos.tarde', '20'::jsonb,
   'Turno de la tarde -- minutos después de abrirse la sesión a partir de los cuales un escaneo cuenta como "tarde". PROVISIONAL: confirmar.'),
  ('attendance.refrigerio_hora_inicio.tarde', '"16:00"'::jsonb,
   'Turno de la tarde -- hora (HH:MM, Venezuela) desde la que se puede escanear el refrigerio. PROVISIONAL: confirmar.'),
  ('attendance.refrigerio_hora_fin.tarde', '"16:30"'::jsonb,
   'Turno de la tarde -- hora (HH:MM, Venezuela) hasta la que se puede escanear el refrigerio. PROVISIONAL: confirmar.')
on conflict (key) do nothing;

update public.system_config set description =
  'Turno de la mañana (y turnos sin valor propio) -- ' || description
where key in ('attendance.tarde_umbral_minutos', 'attendance.refrigerio_hora_inicio', 'attendance.refrigerio_hora_fin')
  and description not like 'Turno de la mañana%';

-- Valor de configuración de un turno, con respaldo en la clave general.
-- p_turno viene tal cual de cohorts.turno ('mañana', 'tarde', ...): la mañana
-- usa la clave general; los demás, la clave con sufijo si existe.
create or replace function public.cfg_turno(p_key text, p_turno text)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (select value from public.system_config
      where key = p_key || '.' || translate(lower(coalesce(p_turno, '')), 'áéíóúñ', 'aeioun')
        and lower(coalesce(p_turno, '')) not in ('mañana', 'manana', '')),
    (select value from public.system_config where key = p_key)
  );
$$;

create or replace function public.fn_attendance_marcar_tarde()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened_at timestamptz;
  v_turno     text;
  v_umbral    int;
begin
  select cs.opened_at, c.turno into v_opened_at, v_turno
  from public.class_sessions cs
  join public.cohorts c on c.id = cs.cohort_id
  where cs.id = new.session_id;

  v_umbral := coalesce((public.cfg_turno('attendance.tarde_umbral_minutos', v_turno) #>> '{}')::int, 15);

  if v_opened_at is not null and new.scanned_at > v_opened_at + make_interval(mins => v_umbral) then
    new.status := 'tarde';
  else
    new.status := 'presente';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------- apertura/cierre manual
create table public.snack_overrides (
  checkin_date date not null,
  turno        text not null check (turno in ('mañana', 'tarde', 'mediodia')),
  estado       text not null check (estado in ('abierto', 'cerrado')),
  set_by       uuid default auth.uid() references public.profiles(id),
  set_at       timestamptz not null default now(),
  primary key (checkin_date, turno)
);

alter table public.snack_overrides enable row level security;

create policy "cantina: administra la apertura manual"
  on public.snack_overrides for all
  to authenticated
  using ((select public.auth_role()) in ('zr_coffee', 'super_admin'))
  with check ((select public.auth_role()) in ('zr_coffee', 'super_admin'));

create policy "admin: ve la apertura manual"
  on public.snack_overrides for select
  to authenticated
  using ((select public.auth_role()) = 'admin');
