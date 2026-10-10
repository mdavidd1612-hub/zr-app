-- =============================================================================
-- ZR APP · MIGRACIÓN 107 · RLS para daily_notification_log
-- =============================================================================
-- Se me quedó fuera en la 105 -- regla 1 de AGENTS.md: el 100% de las tablas
-- lleva RLS. Solo la función SECURITY DEFINER de la 106 escribe aquí; nadie
-- necesita insertar/actualizar/borrar por la API, solo se deja lectura para
-- super_admin (auditar si el aviso diario de refrigerio se mandó o no).
-- =============================================================================

alter table public.daily_notification_log enable row level security;

create policy "super_admin: leer log de notificaciones diarias"
  on public.daily_notification_log for select
  using ((select role from public.profiles where id = auth.uid()) = 'super_admin');
