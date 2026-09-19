-- =============================================================================
-- ZR APP · MIGRACIÓN 102 · Lista de cohortes+módulo para el feedback del profesor
-- =============================================================================
-- Bug encontrado en el chequeo total previo al primer uso real: la pantalla
-- del profesor (/feedback-modulo-docente) armaba su lista leyendo `cohorts`,
-- pero la RLS de `cohorts` solo deja al profesor ver cohortes donde figura
-- como `cohorts.teacher_id` o en alguna `class_sessions.teacher_id`
-- (`teaches_cohort`, migración 021+). Estar asignado al MÓDULO
-- (`teacher_module_assignments`) no da esa visibilidad, así que la lista le
-- salía vacía a un profesor legítimo y nunca llegaba a ver su promedio.
--
-- En vez de ampliar la RLS de `cohorts` para todo lo que un profesor pueda
-- leer ahí, se expone solo lo que esta pantalla necesita -- nombre de la
-- cohorte y del módulo -- mediante una función acotada: únicamente las
-- cohortes activas cuyo módulo ACTUAL tiene asignado el profesor que llama.
-- =============================================================================

create or replace function public.fn_feedback_modulos_docente()
returns table (cohort_id uuid, cohort_name text, module_id uuid, module_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, m.id, m.name
  from public.cohorts c
  join public.modules m on m.id = c.current_module_id
  where c.status = 'activa'
    and exists (
      select 1 from public.teacher_module_assignments t
      where t.teacher_id = auth.uid() and t.module_id = c.current_module_id
    )
  order by c.name;
$$;

revoke all on function public.fn_feedback_modulos_docente() from public;
grant execute on function public.fn_feedback_modulos_docente() to authenticated;
