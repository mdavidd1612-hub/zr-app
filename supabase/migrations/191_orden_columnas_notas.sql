-- =============================================================================
-- ZR APP · MIGRACIÓN 191 · Orden manual de columnas en "Ver calificaciones"
-- =============================================================================
-- Pedido de Dirección Académica (nov. 2026): en el cuadro de calificaciones por
-- estudiante (/notas-academicas/[cohortId]) las columnas de cada evaluación
-- salían en el orden en que se montaron (por `exam_date`). Si primero se montaba
-- un "Examen 3" y luego una "Pre-práctica del examen 1", quedaba la 3 de primera
-- y la 1 después -- desordenado. Ahora Dirección y super_admin pueden arrastrar
-- las columnas y el orden queda guardado aquí.
--
-- No afecta NINGÚN cálculo (regla 2 de AGENTS.md): teoría/práctica promedian
-- las evaluaciones de cada tipo (migración 110), así que el orden es irrelevante
-- para la nota. Esto solo cambia cómo se ven las columnas.
--
-- RLS: no hace falta tocar nada. La política "direccion: administra examenes
-- manuales" (migración 147) ya cubre UPDATE para is_admin_up() -- Dirección y
-- super_admin -- así que pueden escribir `sort_order` desde la pantalla.
-- =============================================================================

alter table public.manual_exam_definitions
  add column if not exists sort_order integer;

comment on column public.manual_exam_definitions.sort_order is
  'Orden manual de la columna en el cuadro de calificaciones de Dirección Académica. '
  'NULL = sin orden fijado (se ordena por exam_date). Lo fija Dirección arrastrando columnas; '
  'no influye en ningún cálculo de notas.';
