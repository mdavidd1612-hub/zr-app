-- =============================================================================
-- ZR APP · MIGRACIÓN 117 · Aviso al subir material muy pesado
-- =============================================================================
-- Reporte de Dirección Académica (sept. 2026): la "Presentación Módulo II"
-- (PDF de 38 MB) se veía mal / tardaba en teléfonos Android de gama baja
-- (Tecno 30). El tope duro de subida ya existía (`content.max_size_mb`, 200);
-- esto agrega un AVISO suave -- no bloquea -- para que quien suba material
-- sepa que conviene comprimirlo antes. El umbral vive aquí, no en el código
-- (regla 5 de AGENTS.md).
-- =============================================================================

insert into public.system_config (key, value, description, is_public)
values (
  'content.aviso_pesado_mb', '25',
  'Tamaño en MB a partir del cual, al subir material, se avisa que puede verse lento o mal en teléfonos de gama baja. Solo avisa, no bloquea.',
  true
)
on conflict (key) do nothing;
