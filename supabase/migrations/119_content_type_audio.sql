-- =============================================================================
-- ZR APP · MIGRACIÓN 119 · content_type admite 'audio'
-- =============================================================================
-- Pedido de Dirección Académica (reunión de oct. 2026): el material puede ser
-- PDF, PPTX, documentos, videos, imágenes y audios. Faltaba 'audio'.
-- Va SOLA en su archivo: ALTER TYPE ... ADD VALUE no puede convivir con
-- consultas que usen el valor nuevo en la misma transacción (CLAUDE.md §11.4).
-- =============================================================================

alter type public.content_type add value if not exists 'audio';
