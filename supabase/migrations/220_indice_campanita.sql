-- Indice para la campanita (19-nov-2026): cada usuario consulta sus 30
-- notificaciones mas recientes cada 30 s; sin este indice crece con la tabla.
create index if not exists idx_notif_profile_fecha on public.notifications (profile_id, created_at desc);
