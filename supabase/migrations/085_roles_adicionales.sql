-- =============================================================================
-- ZR APP · MIGRACIÓN 085 · Roles adicionales por cuenta
-- =============================================================================
-- Pedido explícito del coordinador: Erika Hidalgo (vendedor) necesita también
-- entrar como administración, sin crear una segunda cuenta -- la cédula ya es
-- única por persona (auth.users.email se deriva de ella), así que dos cuentas
-- para la misma persona no es viable.
--
-- profiles.role sigue siendo EL ROL ACTIVO -- todo lo demás (RLS, proxy.ts,
-- cada layout) sigue leyendo esa única columna exactamente igual que antes,
-- sin tocar ninguna política. profile_roles es la lista de roles que esa
-- cuenta TIENE PERMITIDO usar; "cambiar de rol" es simplemente actualizar
-- profiles.role a uno de los que ya están en su lista -- lo hace
-- fn_cambiar_mi_rol, nunca un UPDATE directo del cliente (regla #9 de
-- AGENTS.md: el rol nunca lo decide el cliente libremente, solo puede elegir
-- entre lo que un admin ya le asignó).
-- =============================================================================

create table public.profile_roles (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       public.user_role not null,
  created_at timestamptz not null default now(),
  unique (profile_id, role)
);

create index idx_profile_roles_profile on public.profile_roles (profile_id);

alter table public.profile_roles enable row level security;

-- Cada quien ve sus propios roles adicionales (lo necesita para saber qué
-- botones mostrar en el selector al iniciar sesión).
create policy "dueno_ve_sus_roles" on public.profile_roles
  for select using (auth.uid() = profile_id);

-- Asignar roles adicionales es gestión de personal: mismo permiso que ya
-- tiene la pantalla Personal (esDireccionAcademica: direccion_academica y
-- super_admin).
create policy "direccion_administra_roles" on public.profile_roles
  for all using (public.is_academico()) with check (public.is_academico());

-- Todo el mundo empieza con su rol actual ya en la lista -- si no, el
-- selector de "¿cómo quieres entrar?" no tendría ni una opción para nadie.
insert into public.profile_roles (profile_id, role)
select id, role from public.profiles
on conflict (profile_id, role) do nothing;

-- -----------------------------------------------------------------------------
-- Cambiar de rol activo: SECURITY DEFINER porque profiles no tiene (ni debe
-- tener) una política que deje a cualquiera actualizar su propia fila con
-- cualquier rol -- esta función es la única puerta, y solo deja pasar un rol
-- que ya esté en la lista de esa cuenta.
-- -----------------------------------------------------------------------------
create or replace function public.fn_cambiar_mi_rol(nuevo_rol public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profile_roles
    where profile_id = auth.uid() and role = nuevo_rol
  ) then
    raise exception 'No tienes ese rol asignado.';
  end if;

  update public.profiles set role = nuevo_rol where id = auth.uid();
end;
$$;

grant execute on function public.fn_cambiar_mi_rol(public.user_role) to authenticated;
