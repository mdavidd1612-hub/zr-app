-- =============================================================================
-- ZR APP · MIGRACIÓN 030 · Corregir nombres reales de FKs en audit_log y system_config
-- =============================================================================
-- La migración 029 intentó DROP con nombres incorrectos (IF EXISTS los silenció).
-- Los nombres reales son fk_audit_actor y fk_system_config_updated_by.
-- Se reemplazan aquí con ON DELETE SET NULL.
-- (Migración 031 los eliminará definitivamente porque audit_log es inmutable.)

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS fk_audit_actor;
ALTER TABLE public.audit_log
  ADD CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.system_config
  DROP CONSTRAINT IF EXISTS fk_system_config_updated_by;
ALTER TABLE public.system_config
  ADD CONSTRAINT fk_system_config_updated_by
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
