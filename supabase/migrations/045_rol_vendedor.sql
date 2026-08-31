-- =============================================================================
-- ZR APP · MIGRACIÓN 045 · Rol Vendedor (1/2 — el valor del enum)
-- =============================================================================
-- Un ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción en que
-- se agrega si esa transacción también lo consulta (restricción de Postgres),
-- así que va solo en su propia migración; el resto (tabla, RLS) es la 046.
-- docs/17_PLAN_CONSOLIDADO_CURRICULUM_Y_COORDINADOR.md, Sprint 5.
-- =============================================================================

alter type public.user_role add value 'vendedor';
