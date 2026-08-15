-- =============================================================================
-- ZR APP · MIGRACIÓN 031 · Eliminar FKs de tablas inmutables
-- =============================================================================
-- audit_log es append-only: el trigger fn_block_update_delete bloquea todo
-- UPDATE, incluyendo el UPDATE interno que hace Postgres para ON DELETE SET NULL.
-- La solución correcta es eliminar la FK: el UUID queda como dato histórico
-- inmutable — exactamente lo que quiere un audit log.
-- Igual para system_config.updated_by.

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS fk_audit_actor;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_profile_id_fkey;

ALTER TABLE public.system_config DROP CONSTRAINT IF EXISTS fk_system_config_updated_by;
ALTER TABLE public.system_config DROP CONSTRAINT IF EXISTS system_config_updated_by_fkey;
