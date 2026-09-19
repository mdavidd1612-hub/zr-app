-- =============================================================================
-- ZR APP · MIGRACIÓN 103 · El formulario de feedback se cierra al cambiar de módulo
-- =============================================================================
-- Pedido del coordinador (sept. 2026): el feedback se abre al final de cada
-- módulo, solo cuando Dirección Académica lo abre. Al pasar la cohorte al
-- siguiente módulo, el formulario del anterior tiene que quedar cerrado y el
-- del nuevo empezar cerrado, para que Dirección Académica lo abra cuando
-- corresponda. Los resultados viejos se conservan (nada se borra).
--
-- `feedback_macro_windows` ya es por (cohorte, módulo), así que el módulo
-- nuevo arranca sin ventana (= cerrado). Lo que faltaba: si el formulario
-- anterior se quedaba abierto, seguía aceptando respuestas para ese módulo.
-- Este trigger lo cierra en el momento en que cambia `cohorts.current_module_id`.
-- =============================================================================

create or replace function public.fn_cerrar_feedback_al_cambiar_modulo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_module_id is distinct from old.current_module_id then
    update public.feedback_macro_windows
    set closed_at = now()
    where cohort_id = new.id
      and closed_at is null
      and module_id is distinct from new.current_module_id;
  end if;
  return new;
end;
$$;

create trigger trg_cerrar_feedback_al_cambiar_modulo
  after update of current_module_id on public.cohorts
  for each row execute function public.fn_cerrar_feedback_al_cambiar_modulo();

-- Limpieza de lo que ya estuviera abierto para un módulo que dejó de ser el actual.
update public.feedback_macro_windows w
set closed_at = now()
from public.cohorts c
where c.id = w.cohort_id
  and w.closed_at is null
  and w.module_id is distinct from c.current_module_id;
