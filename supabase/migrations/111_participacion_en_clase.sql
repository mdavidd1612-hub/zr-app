-- =============================================================================
-- ZR APP · MIGRACIÓN 111 · "Participación en clase" -- único campo manual de General
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026): un 4to campo en General,
-- distinto de puntualidad (que ya es automática desde la asistencia,
-- migración 110). Este SÍ lo pone el profesor directamente -- es el único
-- campo de General que vuelve a ser manual; teoría, práctica y puntualidad
-- siguen calculándose solas.
--
-- No entra todavía en el cálculo de `final_score` (`calc_final_score`,
-- migración 005, fórmula fija de 3 campos) -- decisión pendiente de
-- confirmar cómo se pesa, igual que se dejó explícito con los campos extra
-- de la migración 108. Se guarda y se muestra, no se inventa un peso.
-- =============================================================================

alter table public.module_enrollments
  add column class_participation_score numeric(4,2)
    check (class_participation_score between 0 and 20);

comment on column public.module_enrollments.class_participation_score is
  'Participación en clase -- el ÚNICO campo de General que pone el profesor a mano. '
  'Teoría, práctica y puntualidad se calculan solas (migración 110).';
