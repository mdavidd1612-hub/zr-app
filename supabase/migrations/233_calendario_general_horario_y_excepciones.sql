-- =============================================================================
-- ZR APP · MIGRACIÓN 233 · Calendario general (parte 1): horario como dato,
-- excepciones por fecha y la función que arma la semana
-- =============================================================================
-- Propuesta aprobada por el coordinador el 20-nov-2026
-- (docs/reportes/propuesta_calendario_general_2026-11-20.md).
--
-- 1) Horario estructurado por corte. Antes era texto libre ("9:00 a.m. –
--    12:00 p.m.") y no se podía dibujar por horas ni detectar choques.
--    `class_weekdays` usa 0=domingo … 6=sábado. Los textos actuales se
--    convierten una vez; `days`/`schedule` siguen existiendo para la planilla.
-- 2) `cohort_class_exceptions`: "esta fecha no hay clase" (new_date null) o
--    "esta clase pasa a otro día/hora". La usará la parte 2 (mover clases);
--    la función ya la respeta desde hoy.
-- 3) `fn_calendario_general(desde, hasta)`: clases presenciales de los cortes
--    activos en el rango, con módulo, profesor(es) y salón. Las clases futuras
--    no existen como filas: salen de los tramos presenciales del calendario de
--    módulos × los días de clase del corte, menos/más las excepciones.
--    Sedes: super_admin ve todas; Dirección y Administración ven las que el
--    super admin les asignó en `admin_sedes` (o todas si no tienen ninguna).
-- =============================================================================

alter table public.cohorts
  add column if not exists class_weekdays smallint[],
  add column if not exists class_start time,
  add column if not exists class_end time;

-- Convierte un texto tipo "9:00 a.m. – 12:00 p.m." o "2:00 a 6:00 p.m" a horas.
create or replace function public.fn_parsear_horario(p text, out inicio time, out fin time)
language plpgsql immutable as $$
declare
  m text[];
  h1 int; mi1 int; h2 int; mi2 int;
  pm1 boolean; pm2 boolean; am1 boolean;
begin
  if p is null then return; end if;
  m := regexp_match(lower(p),
    '(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\s*(?:–|-|a|al|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|m\.?)?');
  if m is null then return; end if;
  h1 := m[1]::int; mi1 := coalesce(m[2], '0')::int;
  h2 := m[4]::int; mi2 := coalesce(m[5], '0')::int;
  am1 := m[3] is not null and m[3] like 'a%';
  pm1 := m[3] is not null and m[3] like 'p%';
  pm2 := m[6] is not null and m[6] like 'p%';
  if pm2 and h2 < 12 then h2 := h2 + 12; end if;
  -- Sin marca en la primera hora: toma la de la segunda si así queda antes.
  if pm1 and h1 < 12 then h1 := h1 + 12;
  elsif not am1 and m[3] is null and pm2 and h1 + 12 < h2 then h1 := h1 + 12;
  end if;
  if h1 > 23 or h2 > 23 or mi1 > 59 or mi2 > 59 then return; end if;
  inicio := make_time(h1, mi1, 0);
  fin := make_time(h2, mi2, 0);
end $$;

update public.cohorts c
   set class_start = coalesce(c.class_start, (public.fn_parsear_horario(c.schedule)).inicio),
       class_end   = coalesce(c.class_end,   (public.fn_parsear_horario(c.schedule)).fin),
       class_weekdays = coalesce(c.class_weekdays,
         case
           when c.days is null then array[6]::smallint[]
           else array_remove(array[
             case when c.days ~* 'dom' then 0 end,
             case when c.days ~* 'lun' then 1 end,
             case when c.days ~* 'mar' then 2 end,
             case when c.days ~* 'mi[eé]' then 3 end,
             case when c.days ~* 'jue' then 4 end,
             case when c.days ~* 'vie' then 5 end,
             case when c.days ~* 's[aá]b' then 6 end
           ]::smallint[], null)
         end);

-- Excepciones por fecha ------------------------------------------------------
create table if not exists public.cohort_class_exceptions (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.cohorts(id) on delete cascade,
  original_date date not null,
  new_date      date,            -- null = esa fecha no hay clase
  new_start     time,
  new_end       time,
  room_id       uuid references public.rooms(id) on delete set null,
  reason        text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (cohort_id, original_date)
);
create index if not exists cohort_class_exceptions_new_date_idx on public.cohort_class_exceptions (new_date);

alter table public.cohort_class_exceptions enable row level security;

create policy "personal y su corte: ver excepciones" on public.cohort_class_exceptions
  for select to authenticated
  using ((select public.is_staff()) or cohort_id = (select public.my_cohort_id()));

create policy "direccion: gestiona excepciones" on public.cohort_class_exceptions
  for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));

-- Semana del calendario general ----------------------------------------------
create or replace function public.fn_calendario_general(p_desde date, p_hasta date)
returns table (
  cohort_id uuid, cohorte text, sede text, fecha date,
  hora_inicio time, hora_fin time,
  module_id uuid, modulo text, modulo_orden int,
  profesores text, salon text,
  movida boolean, fecha_original date
)
language sql stable security definer set search_path to 'public'
as $$
  with permitido as (
    select (select public.auth_role()) in ('super_admin', 'direccion_academica', 'admin') as ok
  ),
  mis_sedes as (
    select sede_id from public.admin_sedes where profile_id = auth.uid()
  ),
  cortes as (
    select c.id, c.name, s.nombre as sede, c.class_weekdays, c.class_start, c.class_end
      from public.cohorts c
      join public.programs pr on pr.id = c.program_id
      left join public.sedes s on s.id = pr.sede_id
     where c.status = 'activa'
       and (select ok from permitido)
       and (
         (select public.auth_role()) = 'super_admin'
         or not exists (select 1 from mis_sedes)
         or pr.sede_id in (select sede_id from mis_sedes)
       )
  ),
  -- Fechas normales: días de clase del corte dentro de un tramo presencial.
  normales as (
    select co.id as cohort_id, d::date as fecha, k.module_id
      from cortes co
      join public.cohort_module_calendar k
        on k.cohort_id = co.id and coalesce(k.modalidad, 'presencial') = 'presencial'
      cross join lateral generate_series(greatest(k.start_date, p_desde - 14), least(k.end_date, p_hasta), interval '1 day') d
     where extract(dow from d)::smallint = any (coalesce(co.class_weekdays, array[6]::smallint[]))
  ),
  base as (
    -- Las que no tienen excepción, en su fecha
    select n.cohort_id, n.fecha, n.module_id, null::time as ini, null::time as fin, null::uuid as room_id,
           false as movida, null::date as fecha_original
      from normales n
     where not exists (select 1 from public.cohort_class_exceptions e
                        where e.cohort_id = n.cohort_id and e.original_date = n.fecha)
    union all
    -- Las movidas, en su fecha nueva
    select n.cohort_id, e.new_date, n.module_id, e.new_start, e.new_end, e.room_id, true, n.fecha
      from normales n
      join public.cohort_class_exceptions e
        on e.cohort_id = n.cohort_id and e.original_date = n.fecha and e.new_date is not null
  )
  select b.cohort_id, co.name, co.sede, b.fecha,
         coalesce(b.ini, co.class_start), coalesce(b.fin, co.class_end),
         b.module_id, m.name, m.order_index,
         (select string_agg(p.full_name, ', ' order by p.full_name)
            from public.teacher_module_assignments t join public.profiles p on p.id = t.teacher_id
           where t.cohort_id = b.cohort_id and t.module_id = b.module_id),
         coalesce((select r.nombre from public.rooms r where r.id = b.room_id),
                  public.fn_salon_de_clase(b.cohort_id, b.fecha)),
         b.movida, b.fecha_original
    from base b
    join cortes co on co.id = b.cohort_id
    join public.modules m on m.id = b.module_id
   where b.fecha between p_desde and p_hasta
   order by b.fecha, 5, co.name;
$$;

revoke execute on function public.fn_calendario_general(date, date) from public, anon;
grant execute on function public.fn_calendario_general(date, date) to authenticated;
