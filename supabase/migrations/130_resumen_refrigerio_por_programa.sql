-- =============================================================================
-- ZR APP · MIGRACIÓN 130 · Resumen de refrigerio de hoy, por programa
-- =============================================================================
-- Reunión de sept. 2026: "Entregados hoy" debe desglosarse por programa
-- ("PTMA 2026-2: 0 de 16"), no un solo contador global.
--
-- Hallazgo al hacerlo: el contador anterior leía attendance_events
-- directamente, pero la cuenta de ZR Coffee no tiene (ni debe tener) permiso
-- de lectura sobre asistencia, sesiones ni cohortes -- así que siempre
-- mostraba 0. Esta función de servidor devuelve SOLO los totales por cohorte
-- (sin nombres ni datos de estudiantes) a ZR Coffee, admin y super_admin.
-- =============================================================================

create or replace function public.resumen_refrigerio_hoy()
returns table (
  cohort_id   uuid,
  cohorte     text,
  programa    text,
  turno       text,
  presentes   integer,
  entregados  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.auth_role()) not in ('zr_coffee', 'admin', 'super_admin') then
    raise exception 'Sin permiso.';
  end if;

  return query
  select c.id,
         c.name,
         coalesce(p.name, c.name),
         c.turno,
         count(ae.id)::integer,
         count(ae.snack_claimed_at)::integer
  from public.class_sessions cs
  join public.cohorts c on c.id = cs.cohort_id
  left join public.programs p on p.id = c.program_id
  left join public.attendance_events ae on ae.session_id = cs.id
  where cs.session_date = (now() at time zone 'America/Caracas')::date
  group by c.id, c.name, p.name, c.turno
  order by c.turno, c.name;
end;
$$;
