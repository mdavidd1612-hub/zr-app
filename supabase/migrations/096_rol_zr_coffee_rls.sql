-- =============================================================================
-- ZR APP · MIGRACIÓN 096 · Rol ZR Coffee (2/2 — RLS, asignación, limpieza)
-- =============================================================================
-- Con el rol ya existente (migración 095): `es_gestor_zr_coffee()` pasa de
-- consultar la lista de cuentas permitidas (`zr_coffee_managers`) a mirar
-- directamente el rol ACTIVO de la sesión -- mismo criterio que
-- `is_admin_up()` para admin/super_admin. Como las políticas de
-- zr_coffee_products/tasa/sales (migración 090) ya llaman a esta función
-- por nombre, un simple `create or replace` les cambia el comportamiento
-- sin tocarlas.
--
-- No hay bypass para super_admin a propósito: el coordinador pidió
-- explícitamente que NINGUNA otra administración viera esto, ni siquiera
-- super_admin -- eso no cambia solo porque ahora es un rol en vez de una
-- lista.
--
-- `zr_coffee_managers` ya no hace falta -- el rol + profile_roles + la
-- pantalla de Personal (asignar roles adicionales) reemplazan exactamente
-- lo que hacía esa tabla.
-- =============================================================================

create or replace function public.es_gestor_zr_coffee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'zr_coffee',
    false
  );
$$;

drop table public.zr_coffee_managers;

-- Cecilia (V-14586820) ya podía entrar como gestora; ahora eso se traduce a
-- tener 'zr_coffee' en su lista de roles elegibles, ADEMÁS del que ya tenga
-- activo hoy (para que no pierda su rol actual al no estar todavía en
-- profile_roles si su cuenta es de antes de la migración 085).
insert into public.profile_roles (profile_id, role)
select id, 'zr_coffee'::public.user_role from public.profiles where cedula = 'V-14586820'
on conflict do nothing;

insert into public.profile_roles (profile_id, role)
select id, role from public.profiles where cedula = 'V-14586820'
on conflict do nothing;
