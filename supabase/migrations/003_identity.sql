-- =============================================================================
-- ZR APP · MIGRACIÓN 003 · Identidad: perfiles, estudiantes, profesores, admins
-- =============================================================================
-- Referencia: docs/09_DECISIONES_ARQUITECTONICAS.md · ADR-001
--
-- REGLA CRÍTICA: las contraseñas viven SOLO en auth.users (Supabase Auth).
-- Ninguna tabla de este esquema tiene password_hash. Nunca.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles — identidad común a los cuatro roles, 1 a 1 con auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          public.user_role   not null default 'estudiante',
  full_name     text               not null,
  cedula        text               not null unique,
  contact_email text               not null,  -- para menores: correo del representante legal
  phone         text,
  avatar_url    text,
  status        public.profile_status not null default 'activo',
  created_at    timestamptz        not null default now(),
  updated_at    timestamptz        not null default now()
);

create index idx_profiles_role   on public.profiles (role);
create index idx_profiles_cedula on public.profiles (cedula);

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.fn_audit();

-- Ahora que existe profiles, cerramos la FK pendiente de system_config.
alter table public.system_config
  add constraint fk_system_config_updated_by
  foreign key (updated_by) references public.profiles(id);

alter table public.audit_log
  add constraint fk_audit_actor
  foreign key (actor_profile_id) references public.profiles(id);

-- -----------------------------------------------------------------------------
-- 2. students
-- -----------------------------------------------------------------------------
-- OJO: NO existe una columna is_minor. La minoría de edad depende de la fecha
-- actual, así que una columna generada es imposible en Postgres (exige
-- expresiones IMMUTABLE) y además quedaría obsoleta al cumplir 18 años.
-- Se resuelve con la función age_years() y la vista v_students, más abajo.
create table public.students (
  id                       uuid primary key references public.profiles(id) on delete cascade,
  birth_date               date not null,
  cohort_id                uuid,  -- FK a cohorts, se agrega en migración 004
  enrollment_date          date not null default current_date,
  onboarding_status        public.onboarding_status not null default 'en_curso',
  emergency_contact_name   text,
  emergency_contact_phone  text,
  trust_level              int check (trust_level between 1 and 3), -- [FASE 2] null en Fase 1
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_students_cohort on public.students (cohort_id);

create trigger trg_students_updated
  before update on public.students
  for each row execute function public.set_updated_at();

create trigger trg_students_audit
  after insert or update or delete on public.students
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 3. teachers
-- -----------------------------------------------------------------------------
create table public.teachers (
  id          uuid primary key references public.profiles(id) on delete cascade,
  specialties text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_teachers_updated
  before update on public.teachers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. admins
-- -----------------------------------------------------------------------------
create table public.admins (
  id                    uuid primary key references public.profiles(id) on delete cascade,
  can_issue_certificates boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_admins_updated
  before update on public.admins
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Edad y vista de estudiantes
-- -----------------------------------------------------------------------------
create or replace function public.age_years(p_birth_date date)
returns int
language sql
immutable
as $$
  select extract(year from age(current_date, p_birth_date))::int;
$$;

-- Vista que el frontend debe usar para leer estudiantes.
-- Nunca consultes la tabla students directamente desde la interfaz.
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
  public.age_years(s.birth_date) < 18   as is_minor
from public.students s
join public.profiles p on p.id = s.id;

-- -----------------------------------------------------------------------------
-- 6. Creación automática de perfil al registrarse
-- -----------------------------------------------------------------------------
-- SEGURIDAD: el rol SIEMPRE se fuerza a 'estudiante'. Nunca se toma de
-- raw_user_meta_data porque ese dato lo controla el cliente: si lo leyéramos,
-- cualquiera podría registrarse como super_admin.
-- Los roles de personal los asigna un admin después, del lado servidor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, role, full_name, cedula, contact_email, phone)
  values (
    new.id,
    'estudiante',
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'SIN NOMBRE'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'cedula'), ''), new.id::text),
    coalesce(nullif(trim(new.raw_user_meta_data->>'contact_email'), ''), new.email),
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.admins   enable row level security;
