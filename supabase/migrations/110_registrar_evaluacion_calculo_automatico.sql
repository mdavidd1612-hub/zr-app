-- =============================================================================
-- ZR APP · MIGRACIÓN 110 · "Registrar Evaluación" -- lo general lo calcula el servidor
-- =============================================================================
-- Corrección explícita del coordinador (sept. 2026) sobre la migración 108:
--
--   1. Se quita "General - Por Módulo" para TODOS -- Dirección Académica,
--      super_admin y profesor. Nadie pone a mano teoría/práctica/
--      participación nunca más.
--   2. "Por Examen" se generaliza a "Registrar Evaluación": ahí se registran
--      exámenes, prácticas y otras cosas evaluativas (columna `kind`).
--   3. teoría y práctica del módulo se calculan solos, promediando las
--      evaluaciones registradas de cada tipo (normalizadas a su propia
--      escala, sobre 20).
--   4. participación se reemplaza por PUNTUALIDAD, calculada sola desde la
--      asistencia: empieza en 20, resta 3 por falta sin justificar, 2 por
--      falta justificada, 0.5 por cada llegada tarde. Nunca la pone el
--      profesor, ni Dirección Académica, ni super_admin.
--
-- Nada de esto lo calcula el navegador (regla 2 de AGENTS.md): todo vive en
-- triggers del lado servidor. `calc_final_score` (migración 005) no se toca
-- -- sigue siendo teoría/práctica/participación con el mismo peso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fuera "General" -- nadie lo pone a mano
-- -----------------------------------------------------------------------------
drop trigger if exists trg_notify_notas_general on public.module_enrollments;
drop trigger if exists trg_notify_notas_extra on public.module_evaluation_extra_scores;

drop table if exists public.module_evaluation_extra_scores;
drop table if exists public.module_evaluation_field_defs;

-- -----------------------------------------------------------------------------
-- 2. "Registrar Evaluación" -- generaliza "Por Examen"
-- -----------------------------------------------------------------------------
alter table public.manual_exam_definitions
  add column kind text not null default 'examen' check (kind in ('examen', 'practica', 'otro'));

comment on table public.manual_exam_definitions is
  'Evaluaciones que registra Dirección Académica (examen, práctica u otro) para que el profesor '
  'ponga la nota de cada estudiante. teoría y práctica del módulo se recalculan solas a partir de '
  'estas notas -- nadie las escribe directamente.';

-- -----------------------------------------------------------------------------
-- 3. Asegurar que exista module_enrollments -- antes lo creaba el formulario
--    de "General" al primer guardado; ahora nadie lo llena a mano, así que
--    hay que crearlo solo quando un estudiante queda en un módulo.
-- -----------------------------------------------------------------------------
create or replace function public.fn_asegurar_enrollment(p_student_id uuid, p_module_id uuid, p_cohort_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_module_id is null then return; end if;

  insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
  values (p_student_id, p_module_id, p_cohort_id, 0)
  on conflict (student_id, module_id) do nothing;
end;
$$;

create or replace function public.fn_asegurar_enrollments_cohorte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_module_id is distinct from old.current_module_id and new.current_module_id is not null then
    insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
    select s.id, new.current_module_id, new.id, 0
    from public.students s
    where s.cohort_id = new.id
    on conflict (student_id, module_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_asegurar_enrollments_cohorte
  after update of current_module_id on public.cohorts
  for each row execute function public.fn_asegurar_enrollments_cohorte();

create or replace function public.fn_asegurar_enrollment_estudiante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
begin
  if new.cohort_id is distinct from old.cohort_id or tg_op = 'INSERT' then
    select current_module_id into v_module_id from public.cohorts where id = new.cohort_id;
    perform public.fn_asegurar_enrollment(new.id, v_module_id, new.cohort_id);
  end if;
  return new;
end;
$$;

create trigger trg_asegurar_enrollment_estudiante
  after insert or update of cohort_id on public.students
  for each row execute function public.fn_asegurar_enrollment_estudiante();

-- Backfill: estudiantes que ya estaban en una cohorte con módulo activo.
insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
select s.id, c.current_module_id, c.id, 0
from public.students s
join public.cohorts c on c.id = s.cohort_id
where c.current_module_id is not null
on conflict (student_id, module_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. teoría y práctica -- promedio de las evaluaciones registradas de cada tipo,
--    normalizado sobre 20 según la escala de cada una.
-- -----------------------------------------------------------------------------
create or replace function public.fn_recalc_evaluacion_general(p_student_id uuid, p_module_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teoria numeric;
  v_practica numeric;
begin
  select round(avg(s.score / d.scale_max * 20), 2) into v_teoria
  from public.manual_exam_scores s
  join public.manual_exam_definitions d on d.id = s.definition_id
  where s.student_id = p_student_id and d.module_id = p_module_id and d.kind = 'examen';

  select round(avg(s.score / d.scale_max * 20), 2) into v_practica
  from public.manual_exam_scores s
  join public.manual_exam_definitions d on d.id = s.definition_id
  where s.student_id = p_student_id and d.module_id = p_module_id and d.kind = 'practica';

  update public.module_enrollments
  set theory_score = v_teoria,
      practice_score = v_practica
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

create or replace function public.fn_trg_recalc_evaluacion_general()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_module_id uuid;
begin
  v_student_id := coalesce(new.student_id, old.student_id);
  select module_id into v_module_id from public.manual_exam_definitions
  where id = coalesce(new.definition_id, old.definition_id);

  perform public.fn_asegurar_enrollment(
    v_student_id, v_module_id,
    (select cohort_id from public.students where id = v_student_id)
  );
  perform public.fn_recalc_evaluacion_general(v_student_id, v_module_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_recalc_evaluacion_general
  after insert or update or delete on public.manual_exam_scores
  for each row execute function public.fn_trg_recalc_evaluacion_general();

-- -----------------------------------------------------------------------------
-- 5. Puntualidad -- reemplaza a "participación". Se calcula de la asistencia,
--    nunca la pone una persona. Fórmula confirmada con el coordinador:
--    empieza en 20, -3 falta sin justificar, -2 falta justificada,
--    -0.5 por cada llegada tarde. Nunca baja de 0.
-- -----------------------------------------------------------------------------
create or replace function public.fn_recalc_puntualidad(p_student_id uuid, p_module_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puntualidad numeric;
  v_tiene_sesiones_cerradas boolean;
begin
  select exists (
    select 1 from public.class_sessions cs
    join public.students s on s.cohort_id = cs.cohort_id
    where s.id = p_student_id and cs.module_id = p_module_id and cs.closed_at is not null
  ) into v_tiene_sesiones_cerradas;

  if not v_tiene_sesiones_cerradas then
    update public.module_enrollments
    set participation_score = null
    where student_id = p_student_id and module_id = p_module_id;
    return;
  end if;

  select greatest(0, 20
    - 3   * count(*) filter (where ae.id is null and aj.id is null)
    - 2   * count(*) filter (where ae.id is null and aj.id is not null)
    - 0.5 * count(*) filter (where ae.status = 'tarde')
  )
  into v_puntualidad
  from public.class_sessions cs
  join public.students s on s.cohort_id = cs.cohort_id
  left join public.attendance_events ae on ae.session_id = cs.id and ae.student_id = p_student_id
  left join public.attendance_justifications aj on aj.session_id = cs.id and aj.student_id = p_student_id
  where s.id = p_student_id and cs.module_id = p_module_id and cs.closed_at is not null;

  update public.module_enrollments
  set participation_score = v_puntualidad
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

create or replace function public.fn_trg_recalc_puntualidad_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
begin
  select module_id into v_module_id from public.class_sessions where id = coalesce(new.session_id, old.session_id);
  perform public.fn_recalc_puntualidad(coalesce(new.student_id, old.student_id), v_module_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_recalc_puntualidad_asistencia
  after insert or update or delete on public.attendance_events
  for each row execute function public.fn_trg_recalc_puntualidad_asistencia();

create trigger trg_recalc_puntualidad_justificacion
  after insert or delete on public.attendance_justifications
  for each row execute function public.fn_trg_recalc_puntualidad_asistencia();

-- Al cerrarse una sesión, las faltas sin marcar pasan a contar -- recalcular
-- a TODA la cohorte de esa sesión, no solo a quien tenga un evento.
create or replace function public.fn_trg_recalc_puntualidad_cierre_sesion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.closed_at is not null and old.closed_at is null then
    perform public.fn_recalc_puntualidad(s.id, new.module_id)
    from public.students s
    where s.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

create trigger trg_recalc_puntualidad_cierre_sesion
  after update on public.class_sessions
  for each row execute function public.fn_trg_recalc_puntualidad_cierre_sesion();

-- -----------------------------------------------------------------------------
-- 6. "de 9 a 9:20" -- el margen de tolerancia para "tarde" pasa de 15 a 20 min.
-- -----------------------------------------------------------------------------
update public.system_config set value = '20' where key = 'attendance.tarde_umbral_minutos';
