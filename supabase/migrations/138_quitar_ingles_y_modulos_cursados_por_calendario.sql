-- =============================================================================
-- ZR APP · MIGRACIÓN 138 · Quitar "Inglés técnico automotriz" + "cursados" por calendario
-- =============================================================================
-- Pedido del coordinador (10 oct. 2026), tras revisar la malla curricular de un
-- estudiante real:
--   1. "Inglés técnico automotriz" no es un módulo que se dicte: se elimina de
--      los programas. Se verificó que NADA lo referencia (cero filas en
--      cohortes, sesiones, notas, material, calendario). Los módulos que
--      venían después se renumeran para no dejar un hueco en el 7.
--   2. El orden de cursado ya no es universal: según la planificación, algunas
--      cohortes ven Aire acondicionado antes que Performance y otras después.
--      Si una cohorte tiene calendario (migración 137), "módulos cursados" son
--      los que ya empezaron según SU calendario; si no tiene, se usa el orden
--      del programa como antes.
-- =============================================================================

delete from public.modules where name = 'Inglés técnico automotriz';

-- Renumerar (8..14 pasan a 7..13) sin chocar con la restricción de orden único:
-- pasar por un valor alto temporal (la restricción exige order_index >= 1).
-- Solo en programas que se quedaron sin módulo 7.
update public.modules m
set order_index = m.order_index + 1000
where m.order_index > 7
  and not exists (
    select 1 from public.modules x where x.program_id = m.program_id and x.order_index = 7
  );

update public.modules set order_index = order_index - 1001 where order_index > 1000;

create or replace function public.mis_modulos_cursados()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Con calendario: los módulos que ya empezaron para MI cohorte.
  select k.module_id
  from public.cohort_module_calendar k
  join public.students s on s.cohort_id = k.cohort_id
  where s.id = auth.uid()
    and k.start_date <= (now() at time zone 'America/Caracas')::date
  union
  -- Sin calendario: el orden del programa, hasta el módulo actual.
  select m.id
  from public.students s
  join public.cohorts c   on c.id = s.cohort_id
  join public.modules cur on cur.id = c.current_module_id
  join public.modules m   on m.program_id = cur.program_id and m.order_index <= cur.order_index
  where s.id = auth.uid()
    and not exists (select 1 from public.cohort_module_calendar k2 where k2.cohort_id = s.cohort_id);
$$;
