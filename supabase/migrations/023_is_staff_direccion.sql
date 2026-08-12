-- =============================================================================
-- ZR APP · MIGRACIÓN 023 · is_staff() reconoce a Dirección Académica
-- =============================================================================
-- Mismo caso que is_admin_up() en la migración 022: is_staff() se usa en
-- varias políticas (por ejemplo, leer exámenes de cualquier profesor para
-- supervisión académica) y no incluía a direccion_academica.
-- =============================================================================

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('profesor', 'admin', 'super_admin', 'direccion_academica'), false);
$$;
