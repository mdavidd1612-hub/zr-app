-- =============================================================================
-- ZR APP · MIGRACIÓN 065 · Unicidad de nombre de programa
-- =============================================================================
-- Cierra la mitad de R-13 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md que
-- quedaba pendiente. La otra mitad — `cohorts (program_id, name)` — ya se
-- resolvió en la migración 060 (`idx_cohorts_nombre_por_programa`), cuando se
-- corrigió el bug de las dos cohortes llamadas igual en sedes distintas.
--
-- `programs.name` seguía sin restricción: nada impedía crear un segundo
-- programa con el mismo nombre que uno ya existente. Verificado antes de
-- aplicar: no hay duplicados en producción, así que la restricción entra
-- limpia.
-- =============================================================================

alter table public.programs
  add constraint programs_name_key unique (name);
