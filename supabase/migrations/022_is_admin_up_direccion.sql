-- =============================================================================
-- ZR APP · MIGRACIÓN 022 · is_admin_up() reconoce a Dirección Académica
-- =============================================================================
-- is_admin_up() ya decía en su comentario "Administración o dirección
-- académica" (migración 011) desde antes de que existiera ese rol — quedó
-- escrito como intención, nunca implementado. Casi toda política de RLS de
-- la app depende de esta función, así que es el único cambio que hace falta
-- para que Dirección Académica vea lo mismo que ve admin/super_admin.
-- =============================================================================

create or replace function public.is_admin_up()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('admin', 'super_admin', 'direccion_academica'), false);
$$;
