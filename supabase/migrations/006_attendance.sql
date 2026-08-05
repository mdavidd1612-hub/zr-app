-- =============================================================================
-- ZR APP · MIGRACIÓN 006 · Asistencia y refrigerios
-- =============================================================================
-- Referencia: docs/09_DECISIONES_ARQUITECTONICAS.md · ADR-005 y ADR-006
--
-- CÓMO FUNCIONA (no lo cambies):
--   1. Cada estudiante tiene un secreto TOTP. Su carnet muestra un QR que
--      cambia cada 30 segundos, generado en su teléfono, sin internet.
--   2. El PROFESOR escanea ese QR con un dispositivo de la academia.
--      NUNCA al revés. Si el estudiante escanea una pantalla, alguien va a
--      fotografiar el código y mandarlo por WhatsApp a un compañero ausente.
--   3. El servidor valida el código. El cliente NUNCA valida.
--   4. El mismo escaneo, en un segundo momento, marca el refrigerio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. student_qr_secrets — secreto TOTP por estudiante
-- -----------------------------------------------------------------------------
-- NINGÚN rol puede leer esta tabla por la API pública. Ni siquiera el propio
-- estudiante. El secreto se entrega una sola vez, en el aprovisionamiento,
-- desde una Edge Function. La validación siempre ocurre en el servidor.
create table public.student_qr_secrets (
  student_id uuid primary key references public.students(id) on delete cascade,
  secret     text not null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. attendance_events
-- -----------------------------------------------------------------------------
create table public.attendance_events (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.class_sessions(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,

  -- Momento REAL del escaneo, no el de la sincronización. Importa porque el
  -- dispositivo puede estar sin señal y sincronizar horas después.
  scanned_at        timestamptz not null default now(),
  synced_at         timestamptz,

  scanned_by        uuid not null references public.profiles(id),
  method            public.attendance_method not null default 'qr',
  manual_reason     text,
  device_id         text,

  snack_claimed_at  timestamptz,
  snack_claimed_by  uuid references public.profiles(id),

  created_at        timestamptz not null default now(),

  -- Esta restricción es lo que hace idempotente la sincronización sin conexión:
  -- mandar el mismo escaneo dos veces NO crea dos asistencias.
  unique (session_id, student_id),

  constraint chk_manual_reason
    check (method <> 'manual' or (manual_reason is not null and length(trim(manual_reason)) > 0))
);

create index idx_attendance_student on public.attendance_events (student_id);
create index idx_attendance_session on public.attendance_events (session_id);

-- -----------------------------------------------------------------------------
-- 3. Inmutabilidad controlada
-- -----------------------------------------------------------------------------
-- No se borra nunca. No se edita, salvo los dos campos de refrigerio, y esos
-- solo una vez.
create or replace function public.fn_attendance_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'attendance_events es de solo-inserción. No se puede borrar una asistencia.';
  end if;

  if (new.id, new.session_id, new.student_id, new.scanned_at, new.scanned_by, new.method)
     is distinct from
     (old.id, old.session_id, old.student_id, old.scanned_at, old.scanned_by, old.method)
  then
    raise exception 'Solo se pueden actualizar los campos de refrigerio en attendance_events.';
  end if;

  if old.snack_claimed_at is not null
     and new.snack_claimed_at is distinct from old.snack_claimed_at
  then
    raise exception 'El refrigerio ya fue entregado a este estudiante en esta sesión.';
  end if;

  return new;
end;
$$;

create trigger trg_attendance_guard
  before update or delete on public.attendance_events
  for each row execute function public.fn_attendance_guard();

create trigger trg_attendance_audit
  after insert or update on public.attendance_events
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 4. Validación: la sesión debe estar abierta y el estudiante pertenecer a ella
-- -----------------------------------------------------------------------------
create or replace function public.fn_attendance_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_status public.session_status;
  v_session_cohort uuid;
  v_student_cohort uuid;
begin
  select status, cohort_id into v_session_status, v_session_cohort
  from public.class_sessions where id = new.session_id;

  if v_session_status is null then
    raise exception 'La sesión de clase no existe.';
  end if;

  if v_session_status <> 'abierta' then
    raise exception 'La sesión no está abierta. Estado actual: %.', v_session_status;
  end if;

  select cohort_id into v_student_cohort from public.students where id = new.student_id;

  if v_student_cohort is distinct from v_session_cohort then
    raise exception 'El estudiante no pertenece a la cohorte de esta sesión.';
  end if;

  return new;
end;
$$;

create trigger trg_attendance_validate
  before insert on public.attendance_events
  for each row execute function public.fn_attendance_validate();

alter table public.student_qr_secrets enable row level security;
alter table public.attendance_events  enable row level security;
