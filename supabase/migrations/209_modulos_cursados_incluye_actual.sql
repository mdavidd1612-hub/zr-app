-- 14-nov-2026: "módulos que ya cursó + el que está cursando". Antes, si la cohorte
-- tenía calendario, el módulo actual (cohorts.current_module_id) solo contaba si
-- estaba en el calendario. Caso real: PTMA-2026-II con current_module = Inglés
-- Técnico (#14) y calendario solo hasta #12 -> el estudiante veía todo su
-- material como "Todavía no disponible". Ahora se suman las dos reglas:
--   * módulos cuyo calendario ya empezó, y
--   * todos los del programa hasta el módulo actual de la cohorte (inclusive).
-- Los módulos posteriores al actual y sin fecha vigente siguen ocultos.
create or replace function public.mis_modulos_cursados()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select k.module_id
  from public.cohort_module_calendar k
  join public.students s on s.cohort_id = k.cohort_id
  where s.id = auth.uid()
    and k.start_date <= (now() at time zone 'America/Caracas')::date
  union
  select m.id
  from public.students s
  join public.cohorts c   on c.id = s.cohort_id
  join public.modules cur on cur.id = c.current_module_id
  join public.modules m   on m.program_id = cur.program_id and m.order_index <= cur.order_index
  where s.id = auth.uid();
$$;
