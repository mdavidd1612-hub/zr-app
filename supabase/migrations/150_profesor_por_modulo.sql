-- =============================================================================
-- ZR APP · MIGRACIÓN 150 · Profesor por módulo (acceso por módulos asignados)
-- =============================================================================
-- Metodología confirmada por el coordinador (oct. 2026): un solo programa en
-- uso (PTMA 2026-II); todo profesor que se crea queda en ese programa y se le
-- asigna su módulo (o varios). "Módulos asignados" pasa a ser lo que DA el
-- acceso, y al cambiar de módulo entra solo el profesor de ese módulo.
--
-- Reglas:
--   * El profesor ve a los estudiantes del programa donde tiene módulos
--     asignados, pero asistencia y notas SOLO de sus módulos.
--   * Módulo EN CURSO (según el calendario de la cohorte): carga y envía notas.
--   * Módulo TERMINADO: solo ver; corregir lo hace Dirección Académica.
--   * Módulo que AÚN NO EMPIEZA: no se cargan notas (el material sí se puede
--     preparar, ver migración 123).
--   * Dos profesores en el mismo módulo trabajan igual.
--   * Programas SIN módulos asignados a nadie conservan el comportamiento
--     anterior (profesor dueño de la cohorte), para no romper nada.
--   * Cada cambio de profesor de una cohorte queda en la bitácora (audit_log).
-- =============================================================================

-- ------------------------------------------------------------- funciones base
-- Comportamiento anterior (dueño de la cohorte o dio alguna sesión).
create or replace function public.profesor_de_cohorte_antiguo(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cohorts c where c.id = p_cohort and c.teacher_id = auth.uid())
      or exists (select 1 from public.class_sessions s where s.cohort_id = p_cohort and s.teacher_id = auth.uid());
$$;

-- ¿El programa de esta cohorte tiene algún módulo asignado a algún profesor?
create or replace function public.programa_tiene_asignaciones(p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cohorts c
    join public.modules m on m.program_id = c.program_id
    join public.teacher_module_assignments a on a.module_id = m.id
    where c.id = p_cohort
  );
$$;

-- ¿Tengo asignado este módulo (y pertenece al programa de esta cohorte)?
create or replace function public.tengo_modulo_asignado(p_cohort uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_module_assignments a
    join public.modules m on m.id = a.module_id
    join public.cohorts c on c.id = p_cohort and c.program_id = m.program_id
    where a.teacher_id = auth.uid() and a.module_id = p_module
  );
$$;

-- Visibilidad de la cohorte (estudiantes, lista de sesiones): cualquier
-- profesor con algún módulo asignado en su programa, además de lo anterior.
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
      join public.modules m on m.id = a.module_id
      join public.cohorts c on c.id = p_cohort and c.program_id = m.program_id
      where a.teacher_id = auth.uid()
    );
$$;

-- Trabajo por módulo (asistencia y notas): el módulo tiene que ser MÍO.
create or replace function public.teaches_cohort_module(p_cohort uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.admin_ve_cohorte(p_cohort)
    or (public.programa_tiene_asignaciones(p_cohort) and public.tengo_modulo_asignado(p_cohort, p_module))
    or (not public.programa_tiene_asignaciones(p_cohort) and public.profesor_de_cohorte_antiguo(p_cohort));
$$;

-- Estado de un módulo para una cohorte, según su calendario.
create or replace function public.estado_modulo_cohorte(p_cohort uuid, p_module uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) = 0 then 'sin_calendario'
    when (now() at time zone 'America/Caracas')::date < min(start_date) then 'no_empezo'
    when (now() at time zone 'America/Caracas')::date > max(end_date) then 'terminado'
    else 'en_curso'
  end
  from public.cohort_module_calendar
  where cohort_id = p_cohort and module_id = p_module;
$$;

grant execute on function public.estado_modulo_cohorte(uuid, uuid) to authenticated;
grant execute on function public.teaches_cohort_module(uuid, uuid) to authenticated;
revoke execute on function public.profesor_de_cohorte_antiguo(uuid) from public, anon, authenticated;
revoke execute on function public.programa_tiene_asignaciones(uuid) from public, anon, authenticated;
revoke execute on function public.tengo_modulo_asignado(uuid, uuid) from public, anon, authenticated;

-- Módulos que dicta el profesor: los asignados + (comportamiento anterior) el
-- módulo vigente de sus cohortes y los de sus sesiones.
create or replace function public.mis_modulos_docente()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.module_id from public.teacher_module_assignments a where a.teacher_id = auth.uid()
  union
  select c.current_module_id from public.cohorts c
   where c.teacher_id = auth.uid() and c.current_module_id is not null
  union
  select s.module_id from public.class_sessions s
   where s.teacher_id = auth.uid() and s.module_id is not null;
$$;

-- -------------------------------------------------------- políticas por módulo
-- Sesiones
drop policy "personal: leer sesiones que atiende" on public.class_sessions;
create policy "personal: leer sesiones que atiende"
  on public.class_sessions for select to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "personal: escribir sesiones que atiende" on public.class_sessions;
create policy "personal: escribir sesiones que atiende"
  on public.class_sessions for insert to authenticated
  with check ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "personal: actualizar sesiones que atiende" on public.class_sessions;
create policy "personal: actualizar sesiones que atiende"
  on public.class_sessions for update to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)))
  with check ((select public.teaches_cohort_module(cohort_id, module_id)));

-- Asistencia y justificaciones
drop policy "personal: leer asistencia de su cohorte" on public.attendance_events;
create policy "personal: leer asistencia de su cohorte"
  on public.attendance_events for select to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_events.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ));

drop policy "personal: registrar asistencia" on public.attendance_events;
create policy "personal: registrar asistencia"
  on public.attendance_events for insert to authenticated
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_events.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ));

drop policy "personal: marcar refrigerio" on public.attendance_events;
create policy "personal: marcar refrigerio"
  on public.attendance_events for update to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_events.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ))
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_events.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ));

drop policy "personal: leer justificaciones de su cohorte" on public.attendance_justifications;
create policy "personal: leer justificaciones de su cohorte"
  on public.attendance_justifications for select to authenticated
  using (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_justifications.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ));

drop policy "personal: justificar ausencia de su cohorte" on public.attendance_justifications;
create policy "personal: justificar ausencia de su cohorte"
  on public.attendance_justifications for insert to authenticated
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = attendance_justifications.session_id
      and (select public.teaches_cohort_module(s.cohort_id, s.module_id))
  ));

-- Notas por estudiante y módulo
drop policy "personal: leer notas de su cohorte" on public.module_enrollments;
create policy "personal: leer notas de su cohorte"
  on public.module_enrollments for select to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "personal: escribir notas de su cohorte" on public.module_enrollments;
create policy "personal: escribir notas de su cohorte"
  on public.module_enrollments for insert to authenticated
  with check ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "personal: actualizar notas de su cohorte" on public.module_enrollments;
create policy "personal: actualizar notas de su cohorte"
  on public.module_enrollments for update to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)))
  with check ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores;
create policy "profesor: calificar examen manual de su cohorte"
  on public.manual_exam_scores for all to authenticated
  using (exists (
    select 1
    from public.students s
    join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
    where s.id = manual_exam_scores.student_id
      and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
  ))
  with check (exists (
    select 1
    from public.students s
    join public.manual_exam_definitions d on d.id = manual_exam_scores.definition_id
    where s.id = manual_exam_scores.student_id
      and (select public.teaches_cohort_module(s.cohort_id, d.module_id))
  ));

drop policy "personal: ver envios de su cohorte" on public.grade_submissions;
create policy "personal: ver envios de su cohorte"
  on public.grade_submissions for select to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)));

drop policy "personal: ver lo validado de su cohorte" on public.grade_validated_evals;
create policy "personal: ver lo validado de su cohorte"
  on public.grade_validated_evals for select to authenticated
  using ((select public.teaches_cohort_module(cohort_id, module_id)));

-- ------------------------------------- módulo terminado / sin empezar = no se edita
-- (solo se aplica al profesor; Dirección Académica sigue pudiendo corregir)
create or replace function public.fn_bloquear_notas_enviadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_def uuid;
  v_status text;
  v_estado text;
  v_rol text := (select public.auth_role());
begin
  if v_rol is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'manual_exam_scores' then
    v_student := coalesce(new.student_id, old.student_id);
    v_def := coalesce(new.definition_id, old.definition_id);
    select module_id into v_module from public.manual_exam_definitions where id = v_def;
  else
    v_student := coalesce(new.student_id, old.student_id);
    v_module := coalesce(new.module_id, old.module_id);
  end if;
  select cohort_id into v_cohort from public.students where id = v_student;

  if v_rol <> 'profesor' then
    if v_def is not null then
      delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
    end if;
    return coalesce(new, old);
  end if;

  v_estado := public.estado_modulo_cohorte(v_cohort, v_module);
  if v_estado = 'terminado' then
    raise exception 'Este módulo ya terminó: solo Dirección Académica puede cambiar sus notas.';
  elsif v_estado = 'no_empezo' then
    raise exception 'Este módulo todavía no empieza: aún no se pueden cargar notas.';
  end if;

  select status into v_status from public.grade_submissions
  where cohort_id = v_cohort and module_id = v_module;

  if v_status = 'enviado' then
    raise exception 'Las notas están enviadas y esperan la validación de Dirección Académica. Pide que te las devuelvan para corregir.';
  elsif v_status = 'validado' then
    delete from public.grade_submissions where cohort_id = v_cohort and module_id = v_module;
  end if;

  if v_def is not null then
    delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
  end if;
  return coalesce(new, old);
end;
$$;

-- --------------------------- el calendario también pone al profesor del módulo
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

    -- Profesor del módulo vigente (el primero que se le asignó, si hay varios).
    select a.teacher_id into v_prof
    from public.teacher_module_assignments a
    where a.module_id = v_modulo
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

-- Al asignar o quitar un módulo a un profesor, se reaplica el calendario de las
-- cohortes de ese programa (si el módulo es el vigente, cambia el profesor ya).
create or replace function public.fn_trg_asignacion_modulo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modulo uuid := coalesce(new.module_id, old.module_id);
  c record;
begin
  for c in
    select co.id
    from public.cohorts co
    join public.modules m on m.program_id = co.program_id
    where m.id = v_modulo
      and exists (select 1 from public.cohort_module_calendar k where k.cohort_id = co.id)
  loop
    perform public.fn_aplicar_calendario_cohorte(c.id);
  end loop;
  return null;
end;
$$;

revoke execute on function public.fn_trg_asignacion_modulo() from public, anon, authenticated;

create trigger trg_asignacion_modulo
  after insert or delete on public.teacher_module_assignments
  for each row execute function public.fn_trg_asignacion_modulo();

-- ------------------------------------------------------------------ bitácora
-- Quién cambió el profesor de una cohorte y cuándo (antes no quedaba rastro) y
-- quién asignó o quitó módulos.
create trigger trg_cohorts_audit_profesor
  after update of teacher_id on public.cohorts
  for each row
  when (old.teacher_id is distinct from new.teacher_id)
  execute function public.fn_audit();

create trigger trg_asignaciones_audit
  after insert or delete on public.teacher_module_assignments
  for each row execute function public.fn_audit();
