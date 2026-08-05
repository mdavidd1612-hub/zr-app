-- =============================================================================
-- ZR APP · MIGRACIÓN 004 · Estructura académica
-- =============================================================================
-- Programa → módulos → cohortes → sesiones de clase.
-- Referencia: docs/09_DECISIONES_ARQUITECTONICAS.md · ADR-009
--
-- CONCEPTO CLAVE: un estudiante pertenece a una COHORTE. La cohorte cursa un
-- módulo a la vez. Una SESIÓN es un sábado concreto de una cohorte.
-- La asistencia se registra contra una sesión, nunca contra una fecha suelta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. programs
-- -----------------------------------------------------------------------------
create table public.programs (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  total_modules         int  not null default 13,
  total_duration_months int  not null default 13,
  created_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. modules — los 13 módulos del programa
-- -----------------------------------------------------------------------------
create table public.modules (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.programs(id) on delete cascade,
  order_index      int  not null check (order_index >= 1),
  name             text not null,
  description      text,
  duration_weeks   int  not null default 4 check (duration_weeks between 1 and 12),
  inces_homologado boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (program_id, order_index)
);

comment on column public.modules.inces_homologado is
  'true para Electricidad, Transmisión, Suspensión/Frenos y Dirección. El INCES los certifica aparte.';

-- -----------------------------------------------------------------------------
-- 3. cohorts — grupos/secciones que cursan en paralelo
-- -----------------------------------------------------------------------------
create table public.cohorts (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.programs(id),
  name              text not null,                        -- ej. 'Cohorte 2026-B · Sábado 8am'
  current_module_id uuid references public.modules(id),
  teacher_id        uuid references public.teachers(id),
  location          text,                                 -- ej. 'Taller 2'
  start_date        date not null default current_date,
  status            public.cohort_status not null default 'activa',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_cohorts_teacher on public.cohorts (teacher_id);
create index idx_cohorts_status  on public.cohorts (status);

create trigger trg_cohorts_updated
  before update on public.cohorts
  for each row execute function public.set_updated_at();

-- Cerramos la FK pendiente de students.
alter table public.students
  add constraint fk_students_cohort
  foreign key (cohort_id) references public.cohorts(id);

-- -----------------------------------------------------------------------------
-- 4. learning_guides — las sub-competencias, una por objetivo semanal
-- -----------------------------------------------------------------------------
-- Estas ya existen en papel. No hay que diseñarlas, hay que transcribirlas.
create table public.learning_guides (
  id                       uuid primary key default gen_random_uuid(),
  module_id                uuid not null references public.modules(id) on delete cascade,
  week_number              int  not null check (week_number >= 1),
  order_in_week            int  not null default 1,
  sub_competency_name      text not null,
  pre_practice_description text,   -- investigación previa, entre semana
  practice_description     text,   -- práctica de taller, el sábado
  digitized                boolean not null default false,
  source_document_url      text,   -- foto o escaneo de la guía física original
  created_at               timestamptz not null default now(),
  unique (module_id, week_number, order_in_week)
);

-- -----------------------------------------------------------------------------
-- 5. class_sessions — un sábado concreto de una cohorte
-- -----------------------------------------------------------------------------
create table public.class_sessions (
  id               uuid primary key default gen_random_uuid(),
  cohort_id        uuid not null references public.cohorts(id) on delete cascade,
  module_id        uuid not null references public.modules(id),
  teacher_id       uuid references public.teachers(id),
  session_date     date not null,
  week_number      int  not null check (week_number >= 1),
  status           public.session_status not null default 'programada',
  opened_at        timestamptz,
  closed_at        timestamptz,
  rescheduled_from uuid references public.class_sessions(id),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (cohort_id, session_date)
);

create index idx_sessions_cohort on public.class_sessions (cohort_id, session_date desc);
create index idx_sessions_status on public.class_sessions (status) where status = 'abierta';

create trigger trg_sessions_updated
  before update on public.class_sessions
  for each row execute function public.set_updated_at();

-- Marca automática de apertura y cierre.
create or replace function public.fn_session_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'abierta' and (old.status is distinct from 'abierta') then
    new.opened_at = now();
  end if;
  if new.status = 'cerrada' and (old.status is distinct from 'cerrada') then
    new.closed_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_session_timestamps
  before update on public.class_sessions
  for each row execute function public.fn_session_timestamps();

alter table public.programs        enable row level security;
alter table public.modules         enable row level security;
alter table public.cohorts         enable row level security;
alter table public.learning_guides enable row level security;
alter table public.class_sessions  enable row level security;
