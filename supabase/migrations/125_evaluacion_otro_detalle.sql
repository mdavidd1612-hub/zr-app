-- =============================================================================
-- ZR APP · MIGRACIÓN 125 · "Otro" necesita decir de qué se trata
-- =============================================================================
-- Pedido de Dirección Académica (reunión de sept. 2026): al registrar una
-- evaluación de tipo "Otro" debe escribirse qué es (ej. "recuperación",
-- "bonificación"); hoy no decía a dónde iba esa nota. Las ya existentes de
-- tipo 'otro' se rellenan con un texto genérico para no romper la restricción.
-- =============================================================================

alter table public.manual_exam_definitions
  add column kind_detail text;

update public.manual_exam_definitions
set kind_detail = 'Otro'
where kind = 'otro' and kind_detail is null;

alter table public.manual_exam_definitions
  add constraint chk_otro_con_detalle
  check (kind <> 'otro' or length(btrim(coalesce(kind_detail, ''))) > 0);
