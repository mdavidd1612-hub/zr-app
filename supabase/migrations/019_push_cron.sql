-- =============================================================================
-- ZR APP · MIGRACIÓN 019 · Cron de notificaciones push
-- =============================================================================
-- send-push (spec/03_EDGE_FUNCTIONS.md · FUNCIÓN 7) se dispara cada 5 minutos
-- por pg_cron. No la llama el navegador — por eso vive fuera del flujo normal
-- de Edge Functions invocadas desde el cliente.
--
-- La URL del proyecto y la service_role key para el header Authorization se
-- leen de Supabase Vault, NUNCA de system_config: esa tabla se muestra en
-- /configuracion como editable a super_admin, y una service_role key ahí
-- terminaría renderizada en texto plano en el navegador (regla 4 de AGENTS.md).
--
-- Antes de que este cron funcione, hay que crear los dos secretos una vez
-- desde el dashboard (Project Settings → Vault), NUNCA por migración:
--   project_url         → https://<ref>.supabase.co
--   service_role_key    → la clave service_role del proyecto
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-push-cada-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
