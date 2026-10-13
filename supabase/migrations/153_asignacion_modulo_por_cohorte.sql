-- =============================================================================
-- ZR APP · MIGRACIÓN 153 · Asignar el módulo de un profesor A UNA COHORTE (programa)
-- =============================================================================
-- Pedido del coordinador (12 oct. 2026): al crear un profesor se debe poder
-- ELEGIR en qué programa (cohorte) da clase, porque puede dictar en dos
-- programas distintos y en dos módulos distintos.
--
-- Hasta ahora una asignación era (profesor, módulo) y valía para todas las
-- cohortes que tuvieran ese módulo en su calendario. Se agrega cohort_id:
--   * cohort_id con valor = vale solo para esa cohorte.
--   * cohort_id nulo      = como antes (vale para todas las cohortes con ese
--                           módulo en su calendario). Las asignaciones que ya
--                           existen quedan así y no cambian de comportamiento.
-- =============================================================================

alter table public.teacher_module_assignments
  add column cohort_id uuid references public.cohorts(id) on delete cascade;

alter table public.teacher_module_assignments
  drop constraint teacher_module_assignments_teacher_id_module_id_key;

create unique index teacher_module_assignments_unico
  on public.teacher_module_assignments (teacher_id, module_id, coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ------------------------------------------------------------- funciones
create or replace function public.tengo_modulo_asignado(p_cohort uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_module_assignments a
    where a.teacher_id = auth.uid() and a.module_id = p_module
      and (a.cohort_id is null or a.cohort_id = p_cohort)
  ) and exists (
    select 1 from public.cohort_module_calendar k
    where k.cohort_id = p_cohort and k.module_id = p_module
  );
$$;

create or replace function public.programa_tiene_asignaciones(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cohort_module_calendar k
    join public.teacher_module_assignments a
      on a.module_id = k.module_id and (a.cohort_id is null or a.cohort_id = p_cohort)
    where k.cohort_id = p_cohort
  );
$$;

create or replace function public.teaches_cohort(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.admin_ve_cohorte(p_cohort)
    or public.profesor_de_cohorte_antiguo(p_cohort)
    or exists (
      select 1
      from public.teacher_module_assignments a
      join public.cohort_module_calendar k
        on k.module_id = a.module_id and k.cohort_id = p_cohort
      where a.teacher_id = auth.uid()
        and (a.cohort_id is null or a.cohort_id = p_cohort)
    );
$$;

-- Profesor del módulo vigente de UNA cohorte: solo cuentan las asignaciones
-- que valen para esa cohorte.
create or replace function public.fn_aplicar_calendario_cohorte(p_cohort uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy    date := (now() at time zone 'America/Caracas')::date;
  v_modulo uuid;
  v_prof   uuid;
begin
  v_modulo := public.modulo_por_calendario(p_cohort, v_hoy);
  if v_modulo is not null then
    update public.cohorts
    set current_module_id = v_modulo
    where id = p_cohort and current_module_id is distinct from v_modulo;

    select a.teacher_id into v_prof
    from public.teacher_module_assignments a
    where a.module_id = v_modulo
      and (a.cohort_id is null or a.cohort_id = p_cohort)
    order by a.assigned_at, a.id
    limit 1;

    if v_prof is not null then
      update public.cohorts set teacher_id = v_prof
      where id = p_cohort and teacher_id is distinct from v_prof;

      update public.class_sessions set teacher_id = v_prof
      where cohort_id = p_cohort and module_id = v_modulo
        and closed_at is null and teacher_id is distinct from v_prof;
    end if;
  end if;

  update public.class_sessions cs
  set module_id = public.modulo_por_calendario(cs.cohort_id, cs.session_date)
  where cs.cohort_id = p_cohort
    and public.modulo_por_calendario(cs.cohort_id, cs.session_date) is not null
    and cs.module_id is distinct from public.modulo_por_calendario(cs.cohort_id, cs.session_date);
end;
$$;

-- Al asignar o quitar: se reaplica el calendario de la cohorte elegida o, si la
-- asignación vale para todas, de todas las que tengan ese módulo.
create or replace function public.fn_trg_asignacion_modulo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modulo uuid := coalesce(new.module_id, old.module_id);
  v_cohorte uuid := coalesce(new.cohort_id, old.cohort_id);
  c record;
begin
  for c in
    select co.id
    from public.cohorts co
    join public.cohort_module_calendar k on k.cohort_id = co.id and k.module_id = v_modulo
    where v_cohorte is null or co.id = v_cohorte
    group by co.id
  loop
    perform public.fn_aplicar_calendario_cohorte(c.id);
  end loop;
  return null;
end;
$$;

-- Feedback del profesor: solo sus asignaciones para esa cohorte.
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
        and (t.cohort_id is null or t.cohort_id = c.id)
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
        and (t.cohort_id is null or t.cohort_id = c.id)
    )

  order by 2, 4;
$$;
