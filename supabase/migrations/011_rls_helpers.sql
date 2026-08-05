-- =============================================================================
-- ZR APP · MIGRACIÓN 011 · Funciones de apoyo para Row Level Security
-- =============================================================================
-- Todas son SECURITY DEFINER a propósito: así consultan las tablas saltándose
-- RLS y evitan la recursión infinita que ocurre cuando una política sobre
-- 'profiles' necesita leer 'profiles' para decidir.
--
-- RENDIMIENTO: en las políticas, invócalas siempre envueltas en un subselect,
-- por ejemplo (select public.is_staff()). Así Postgres las evalúa una sola vez
-- por consulta en lugar de una vez por fila.
-- =============================================================================

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'super_admin', false);
$$;

-- Administración o dirección académica.
create or replace function public.is_admin_up()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('admin','super_admin'), false);
$$;

-- Cualquier miembro del personal: profesor, admin o super admin.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('profesor','admin','super_admin'), false);
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'estudiante', false);
$$;

-- Cohorte del estudiante que hace la consulta.
create or replace function public.my_cohort_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cohort_id from public.students where id = auth.uid();
$$;

-- Módulo que cursa hoy el estudiante que hace la consulta.
create or replace function public.my_module_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.current_module_id
  from public.students s
  join public.cohorts c on c.id = s.cohort_id
  where s.id = auth.uid();
$$;

-- ¿El usuario actual da clase en esta cohorte?
-- Admin y super admin devuelven true siempre: ven todo.
create or replace function public.teaches_cohort(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_up()
    or exists (
      select 1 from public.cohorts c
      where c.id = p_cohort and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.class_sessions s
      where s.cohort_id = p_cohort and s.teacher_id = auth.uid()
    );
$$;

-- ¿Este estudiante está en una cohorte que atiende el usuario actual?
create or replace function public.can_see_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_up()
    or exists (
      select 1 from public.students s
      where s.id = p_student and public.teaches_cohort(s.cohort_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- Protección de campos sensibles de profiles
-- -----------------------------------------------------------------------------
-- Un usuario puede editar su teléfono y su avatar. No su rol, ni su cédula,
-- ni su estado. Si esto solo se validara en la interfaz, se saltaría con una
-- petición directa a la API.
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() es null cuando escribe el servidor (service_role) o un
  -- disparador interno. Esos casos ya pasaron por su propia validación.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin_up() then
    return new;
  end if;

  if (new.role, new.cedula, new.status) is distinct from (old.role, old.cedula, old.status) then
    raise exception 'No puedes modificar tu rol, tu cédula ni tu estado.';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_profiles_guard();
