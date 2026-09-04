-- =============================================================================
-- ZR APP · MIGRACIÓN 087 · Sedes asignadas a cada administrador
-- =============================================================================
-- Pedido explícito del coordinador: hay dos sedes (La Morita, UCV) y dos
-- administradoras -- Cecilia (administradora total, las dos sedes) y Erika
-- Hidalgo (solo UCV). Sin esto, cualquier admin ve mezclados en sus listas
-- (asistencia, notas, cohortes, estudiantes...) los estudiantes de AMBAS
-- sedes, lo cual confunde en un sábado con las dos funcionando a la vez.
--
-- super_admin y dirección académica NUNCA se restringen por sede -- son
-- quienes asignan sedes a los administradores, y siguen viendo todo. Un
-- admin SIN sedes asignadas todavía tampoco se restringe (para no romper a
-- nadie que no haya pasado por esta pantalla) -- la restricción empieza a
-- aplicar en cuanto se le asigna al menos una.
--
-- teaches_cohort() y can_see_student() son el corazón de esto: gatean 18
-- políticas distintas (asistencia, notas, cohortes, dominio, formularios,
-- justificaciones...) a través de un solo punto -- arreglar estas dos
-- funciones (más las dos políticas de cohorts/students que usan
-- is_admin_up() directo) alcanza para que TODA la app respete la sede, sin
-- tocar cada tabla una por una.
-- =============================================================================

create table public.admin_sedes (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sede_id    uuid not null references public.sedes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, sede_id)
);

create index idx_admin_sedes_profile on public.admin_sedes (profile_id);

alter table public.admin_sedes enable row level security;

create policy "dueno_ve_sus_sedes" on public.admin_sedes
  for select using (auth.uid() = profile_id);

create policy "direccion_administra_sedes" on public.admin_sedes
  for all using (public.is_academico()) with check (public.is_academico());

-- -----------------------------------------------------------------------------
-- Helpers de sede
-- -----------------------------------------------------------------------------
create or replace function public.admin_ve_sede(p_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.auth_role() in ('super_admin', 'direccion_academica')
    or (
      public.auth_role() = 'admin' and (
        p_sede_id is null
        or not exists (select 1 from public.admin_sedes where profile_id = auth.uid())
        or exists (select 1 from public.admin_sedes where profile_id = auth.uid() and sede_id = p_sede_id)
      )
    )
$$;

create or replace function public.admin_ve_cohorte(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_ve_sede((
    select pr.sede_id
    from public.cohorts c
    join public.programs pr on pr.id = c.program_id
    where c.id = p_cohort_id
  ))
$$;

create or replace function public.admin_ve_estudiante(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_ve_sede((
    select pr.sede_id
    from public.students s
    join public.cohorts c on c.id = s.cohort_id
    join public.programs pr on pr.id = c.program_id
    where s.id = p_student_id
  ))
$$;

-- -----------------------------------------------------------------------------
-- teaches_cohort y can_see_student: mismo comportamiento de siempre (el
-- profesor de esa cohorte/sesión sigue viéndola), solo que el bypass de
-- is_admin_up() ahora respeta la sede para el rol 'admin' específicamente.
-- -----------------------------------------------------------------------------
create or replace function public.teaches_cohort(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.admin_ve_cohorte(p_cohort)
    or exists (
      select 1 from public.cohorts c
      where c.id = p_cohort and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.class_sessions s
      where s.cohort_id = p_cohort and s.teacher_id = auth.uid()
    );
$$;

create or replace function public.can_see_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.admin_ve_estudiante(p_student)
    or exists (
      select 1 from public.students s
      where s.id = p_student and public.teaches_cohort(s.cohort_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- cohorts y students también tienen su propia política directa con
-- is_admin_up() (no pasa por teaches_cohort/can_see_student) -- se ajusta
-- igual.
-- -----------------------------------------------------------------------------
alter policy "admin: escribir cohortes" on public.cohorts
  using (public.admin_ve_cohorte(id))
  with check (public.admin_ve_cohorte(id));

alter policy "admin: escribir estudiantes" on public.students
  using (public.admin_ve_estudiante(id))
  with check (public.admin_ve_estudiante(id));
