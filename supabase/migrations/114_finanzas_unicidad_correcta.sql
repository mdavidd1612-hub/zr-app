-- =============================================================================
-- ZR APP · MIGRACIÓN 114 · Corrige la unicidad de student_payments
-- =============================================================================
-- La restricción `unique (student_id, concept, module_id)` de la migración
-- 113 no protege nada para 'inscripcion': ahí module_id siempre es NULL, y
-- Postgres trata cada NULL como distinto de los demás -- un estudiante podría
-- terminar con dos filas de inscripción. Se reemplaza por dos índices
-- únicos parciales, uno por concepto.
-- =============================================================================

alter table public.student_payments drop constraint student_payments_student_id_concept_module_id_key;

create unique index idx_student_payments_inscripcion_unica
  on public.student_payments (student_id)
  where concept = 'inscripcion';

create unique index idx_student_payments_mensualidad_unica
  on public.student_payments (student_id, module_id)
  where concept = 'mensualidad';
