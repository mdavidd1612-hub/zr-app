-- =============================================================================
-- ZR APP · MIGRACIÓN 179 · Aula Virtual — Fase 6: calendario
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §9 y §15: el calendario se alimenta SOLO de
-- disparadores -- nunca se carga a mano. Una unidad contribuye hasta dos
-- eventos (apertura y cierre), un examen uno (su fecha de cierre, o de
-- apertura si no tiene cierre) y una tarea uno (su fecha límite).
-- =============================================================================

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('unit_open','unit_close','exam','assignment')),
  source_id   uuid not null,
  module_id   uuid not null references public.modules(id) on delete cascade,
  title       text not null,
  event_at    timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (source_type, source_id)
);

create index idx_calendar_module on public.calendar_events (module_id, event_at);

create trigger trg_calendar_updated
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 1. Unidades: apertura y cierre
-- -----------------------------------------------------------------------------
create or replace function public.fn_calendar_sync_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.calendar_events where source_type in ('unit_open','unit_close') and source_id = old.id;
    return old;
  end if;

  if new.open_at is null then
    delete from public.calendar_events where source_type = 'unit_open' and source_id = new.id;
  else
    insert into public.calendar_events (source_type, source_id, module_id, title, event_at)
    values ('unit_open', new.id, new.module_id, 'Se abre: ' || new.title, new.open_at)
    on conflict (source_type, source_id)
    do update set module_id = excluded.module_id, title = excluded.title, event_at = excluded.event_at;
  end if;

  if new.close_at is null then
    delete from public.calendar_events where source_type = 'unit_close' and source_id = new.id;
  else
    insert into public.calendar_events (source_type, source_id, module_id, title, event_at)
    values ('unit_close', new.id, new.module_id, 'Se cierra: ' || new.title, new.close_at)
    on conflict (source_type, source_id)
    do update set module_id = excluded.module_id, title = excluded.title, event_at = excluded.event_at;
  end if;

  return new;
end;
$$;

create trigger trg_calendar_sync_unit
  after insert or update of open_at, close_at, title, module_id or delete on public.units
  for each row execute function public.fn_calendar_sync_unit();

-- -----------------------------------------------------------------------------
-- 2. Exámenes: su fecha de cierre (o de apertura si no tiene cierre)
-- -----------------------------------------------------------------------------
-- Solo los que pertenecen a una unidad del Aula Virtual (unit_id no nulo) --
-- los exámenes sueltos de antes de este módulo no tenían calendario y no
-- hace falta que empiecen a tenerlo ahora.
create or replace function public.fn_calendar_sync_exam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
  v_fecha     timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.calendar_events where source_type = 'exam' and source_id = old.id;
    return old;
  end if;

  if new.unit_id is null then
    delete from public.calendar_events where source_type = 'exam' and source_id = new.id;
    return new;
  end if;

  v_fecha := coalesce(new.closes_at, new.opens_at);
  if v_fecha is null then
    delete from public.calendar_events where source_type = 'exam' and source_id = new.id;
    return new;
  end if;

  select module_id into v_module_id from public.units where id = new.unit_id;

  insert into public.calendar_events (source_type, source_id, module_id, title, event_at)
  values ('exam', new.id, v_module_id, new.title, v_fecha)
  on conflict (source_type, source_id)
  do update set module_id = excluded.module_id, title = excluded.title, event_at = excluded.event_at;

  return new;
end;
$$;

create trigger trg_calendar_sync_exam
  after insert or update of unit_id, opens_at, closes_at, title or delete on public.exams
  for each row execute function public.fn_calendar_sync_exam();

-- -----------------------------------------------------------------------------
-- 3. Tareas: su fecha límite
-- -----------------------------------------------------------------------------
create or replace function public.fn_calendar_sync_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.calendar_events where source_type = 'assignment' and source_id = old.id;
    return old;
  end if;

  if new.due_at is null then
    delete from public.calendar_events where source_type = 'assignment' and source_id = new.id;
    return new;
  end if;

  select module_id into v_module_id from public.units where id = new.unit_id;

  insert into public.calendar_events (source_type, source_id, module_id, title, event_at)
  values ('assignment', new.id, v_module_id, new.title, new.due_at)
  on conflict (source_type, source_id)
  do update set module_id = excluded.module_id, title = excluded.title, event_at = excluded.event_at;

  return new;
end;
$$;

create trigger trg_calendar_sync_assignment
  after insert or update of unit_id, due_at, title or delete on public.assignments
  for each row execute function public.fn_calendar_sync_assignment();

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
alter table public.calendar_events enable row level security;

create policy "estudiante: leer calendario de su modulo"
  on public.calendar_events for select to authenticated
  using (module_id = (select public.my_module_id()));

create policy "personal: leer calendario"
  on public.calendar_events for select to authenticated
  using ((select public.is_staff()));

-- Nadie escribe calendar_events a mano -- solo los disparadores de arriba
-- (que corren como su dueño, no necesitan política de escritura para
-- estudiantes ni personal).

-- -----------------------------------------------------------------------------
-- 5. Exportar a iCal (RFC 5545) -- un archivo .ics por estudiante
-- -----------------------------------------------------------------------------
-- Misma guarda de seguridad que unit_prerequisite_met/fn_unit_required_complete
-- (176/177): "por mí mismo" o "soy personal".
create or replace function public.fn_calendar_ical(p_student_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_modulo uuid;
  v_evento record;
  v_ics    text;
begin
  if p_student_id is distinct from auth.uid() and not public.is_staff() then
    raise exception 'No autorizado.';
  end if;

  select c.current_module_id into v_modulo
  from public.students s join public.cohorts c on c.id = s.cohort_id
  where s.id = p_student_id;

  v_ics := E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ZR Mecademy//Aula Virtual//ES\r\nCALSCALE:GREGORIAN\r\n';

  for v_evento in
    select * from public.calendar_events where module_id = v_modulo order by event_at
  loop
    v_ics := v_ics
      || E'BEGIN:VEVENT\r\n'
      || 'UID:' || v_evento.id || E'@zrmecademy\r\n'
      || 'DTSTAMP:' || to_char(now() at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || E'\r\n'
      || 'DTSTART:' || to_char(v_evento.event_at at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || E'\r\n'
      || 'SUMMARY:' || replace(replace(v_evento.title, ',', '\,'), ';', '\;') || E'\r\n'
      || E'END:VEVENT\r\n';
  end loop;

  v_ics := v_ics || 'END:VCALENDAR' || E'\r\n';
  return v_ics;
end;
$$;
