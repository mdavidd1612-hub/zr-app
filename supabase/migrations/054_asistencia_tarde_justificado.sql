-- =============================================================================
-- ZR APP · MIGRACIÓN 054 · Estados "tarde" y "justificado" en asistencia (B-3)
-- =============================================================================
-- especificacion-funcional-zrm-academy.md §10.2 pide cuatro estados:
-- presente / tarde / ausente / justificado. Hoy solo hay dos (hay evento de
-- escaneo = presente, no hay evento = ausente).
--
-- attendance_events sigue siendo de solo-inserción, presente-únicamente — no
-- se toca esa garantía. Se agregan dos piezas:
--   1. attendance_events.status: 'presente' o 'tarde', calculado en el
--      servidor comparando scanned_at contra class_sessions.opened_at + el
--      umbral de tolerancia de system_config (nunca un número en el código).
--   2. attendance_justifications: una AUSENCIA justificada no es un evento de
--      asistencia (nunca llegó a escanear), así que necesita su propia tabla,
--      no una columna en attendance_events.
-- =============================================================================

alter table public.attendance_events
  add column status text not null default 'presente'
    check (status in ('presente', 'tarde'));

comment on column public.attendance_events.status is
  'presente = llegó dentro del margen de tolerancia; tarde = después. Nunca "ausente" — eso es la ausencia de fila.';

insert into public.system_config (key, value, description, is_public)
values (
  'attendance.tarde_umbral_minutos', '15',
  'Minutos después de que se abre la sesión a partir de los cuales un escaneo cuenta como "tarde" en vez de "presente".',
  true
)
on conflict (key) do nothing;

create or replace function public.fn_attendance_marcar_tarde()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened_at timestamptz;
  v_umbral    int;
begin
  select opened_at into v_opened_at from public.class_sessions where id = new.session_id;
  v_umbral := public.cfg_int('attendance.tarde_umbral_minutos', 15);

  if v_opened_at is not null and new.scanned_at > v_opened_at + make_interval(mins => v_umbral) then
    new.status := 'tarde';
  else
    new.status := 'presente';
  end if;

  return new;
end;
$$;

-- Antes de fn_attendance_validate (que ya corre en BEFORE INSERT) para que el
-- status quede fijado en el mismo insert, sin un segundo UPDATE (que el
-- guard de la migración 006 bloquearía).
create trigger trg_attendance_marcar_tarde
  before insert on public.attendance_events
  for each row execute function public.fn_attendance_marcar_tarde();

-- -----------------------------------------------------------------------------
-- attendance_justifications — ausencias justificadas
-- -----------------------------------------------------------------------------
create table public.attendance_justifications (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.class_sessions(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  reason        text not null check (length(trim(reason)) > 0),
  justified_by  uuid references public.profiles(id) on delete set null,
  justified_at  timestamptz not null default now(),
  unique (session_id, student_id)
);

create index idx_justifications_session on public.attendance_justifications (session_id);
create index idx_justifications_student on public.attendance_justifications (student_id);

alter table public.attendance_justifications enable row level security;

create policy "estudiante: leer sus justificaciones"
  on public.attendance_justifications for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer justificaciones de su cohorte"
  on public.attendance_justifications for select to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ));

create policy "personal: justificar ausencia de su cohorte"
  on public.attendance_justifications for insert to authenticated
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and (select public.teaches_cohort(s.cohort_id))
  ));

create policy "admin: borrar justificacion"
  on public.attendance_justifications for delete to authenticated
  using ((select public.is_admin_up()));
