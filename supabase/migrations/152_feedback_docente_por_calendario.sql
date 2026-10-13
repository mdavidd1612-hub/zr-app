-- =============================================================================
-- ZR APP · MIGRACIÓN 152 · Feedback de módulo del profesor: según el calendario
-- =============================================================================
-- Hallazgo de la prueba del 12 oct.: el profesor solo veía UN feedback, el de
-- "el módulo que cada cohorte cursa AHORA si coincide con uno de los suyos".
-- Resultado: (a) aparecía una cohorte de relleno sin estudiantes (PTMA-2026-I)
-- y (b) el feedback de un módulo propio que ya terminó desaparecía en cuanto la
-- cohorte pasaba al siguiente.
--
-- Ahora, para las cohortes con calendario (migración 137): todos los módulos que
-- dicta el profesor y que YA EMPEZARON (en curso o terminados). Los que aún no
-- empiezan no tienen nada que mostrar. Las cohortes sin calendario conservan el
-- comportamiento anterior (el módulo actual), pero solo si tienen estudiantes: una
-- cohorte vacía no tiene feedback que mostrar.
-- =============================================================================

create or replace function public.fn_feedback_modulos_docente()
returns table(cohort_id uuid, cohort_name text, module_id uuid, module_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, m.id, m.name
  from public.cohorts c
  join public.modules m on exists (
    select 1 from public.cohort_module_calendar k
    where k.cohort_id = c.id and k.module_id = m.id
      and k.start_date <= (now() at time zone 'America/Caracas')::date
  )
  where c.status = 'activa'
    and exists (
      select 1 from public.teacher_module_assignments t
      where t.teacher_id = auth.uid() and t.module_id = m.id
    )

  union

  select c.id, c.name, m.id, m.name
  from public.cohorts c
  join public.modules m on m.id = c.current_module_id
  where c.status = 'activa'
    and not exists (select 1 from public.cohort_module_calendar k where k.cohort_id = c.id)
    and exists (select 1 from public.students st where st.cohort_id = c.id)
    and exists (
      select 1 from public.teacher_module_assignments t
      where t.teacher_id = auth.uid() and t.module_id = c.current_module_id
    )

  order by 2, 4;
$$;
