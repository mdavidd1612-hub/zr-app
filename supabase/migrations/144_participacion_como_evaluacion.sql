-- 144_participacion_como_evaluacion.sql
-- Correcciones de la reunión (oct. 2026) sobre la 143:
--  * La participación NO es un campo aparte: es un tipo de evaluación más
--    (Examen, Práctica, Pre-práctica, Exposición, Participación y Otro). Se
--    registra como cualquier evaluación, con su porcentaje (entre el mínimo y
--    el máximo de system_config) y su nota por estudiante.
--  * Todas las evaluaciones de un módulo suman exactamente 100 %.
--  * El profesor también registra evaluaciones, solo de los módulos que da.

drop trigger if exists trg_validar_peso_participacion on public.modules;
drop trigger if exists trg_recalc_modulo_participacion on public.modules;
drop function if exists public.fn_validar_peso_participacion();
alter table public.modules drop column if exists participation_pct;

alter table public.manual_exam_definitions drop constraint if exists manual_exam_definitions_kind_check;
alter table public.manual_exam_definitions
  add constraint manual_exam_definitions_kind_check
  check (kind = any (array['examen'::text, 'practica'::text, 'prepractica'::text, 'exposicion'::text, 'participacion'::text, 'otro'::text]));

-- Suma de pesos <= 100 y rango de la participación.
create or replace function public.fn_validar_suma_pesos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_otros numeric;
  v_min numeric := public.cfg_num('module.participation_weight_min', 0.05) * 100;
  v_max numeric := public.cfg_num('module.participation_weight_max', 0.10) * 100;
begin
  if new.kind = 'participacion' and (new.weight_pct < v_min or new.weight_pct > v_max) then
    raise exception 'La participación debe valer entre % %% y % %% de la nota del módulo.', v_min, v_max;
  end if;
  select coalesce(sum(weight_pct), 0) into v_otros
  from public.manual_exam_definitions
  where module_id = new.module_id and id <> new.id;
  if v_otros + new.weight_pct > 100 then
    raise exception 'Los porcentajes pasan de 100 %%: las otras evaluaciones suman % %% y esta pide % %%.', v_otros, new.weight_pct;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_suma_pesos on public.manual_exam_definitions;
create trigger trg_validar_suma_pesos
  before insert or update of weight_pct, module_id, kind on public.manual_exam_definitions
  for each row execute function public.fn_validar_suma_pesos();

-- Nota del módulo: suma ponderada de las evaluaciones ya calificadas.
create or replace function public.fn_recalc_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pts numeric;
  v_pct numeric;
begin
  select sum(s.score / d.scale_max * 20 * d.weight_pct / 100), sum(d.weight_pct)
    into v_pts, v_pct
  from public.manual_exam_scores s
  join public.manual_exam_definitions d on d.id = s.definition_id
  where s.student_id = new.student_id and d.module_id = new.module_id;

  v_pct := coalesce(v_pct, 0);
  new.participation_score := null;
  new.theory_score := null;
  new.practice_score := null;
  new.evaluated_pct := v_pct;
  new.final_score := case when v_pct > 0 then round(coalesce(v_pts, 0), 2) end;

  if new.status <> 'retirado' then
    if v_pct < 100 then
      new.status := 'en_curso';
      new.approved_at := null;
    elsif new.final_score >= new.passing_threshold then
      new.status := 'aprobado';
      new.approved_at := coalesce(new.approved_at, now());
    else
      new.status := 'reprobado';
      new.approved_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- Enviar notas: las evaluaciones deben sumar exactamente 100 %.
create or replace function public.enviar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cohorte text;
  v_modulo text;
  v_suma numeric;
begin
  if not (select public.teaches_cohort(p_cohort)) then
    raise exception 'No tienes a cargo esta cohorte.';
  end if;
  if (select public.auth_role()) not in ('profesor', 'direccion_academica', 'super_admin', 'admin') then
    raise exception 'Solo el personal académico puede enviar notas.';
  end if;
  if exists (select 1 from public.grade_submissions where cohort_id = p_cohort and module_id = p_module and status = 'validado') then
    raise exception 'Estas notas ya fueron validadas.';
  end if;

  select coalesce(sum(weight_pct), 0) into v_suma from public.manual_exam_definitions where module_id = p_module;
  if v_suma <> 100 then
    raise exception 'Los porcentajes de las evaluaciones del módulo suman % %% y deben sumar 100 %%. Ajústalos en Registrar evaluación.', v_suma;
  end if;

  insert into public.grade_submissions (cohort_id, module_id, status, submitted_by)
  values (p_cohort, p_module, 'enviado', auth.uid())
  on conflict (cohort_id, module_id) do update
    set status = 'enviado', submitted_by = auth.uid(), submitted_at = now(),
        validated_by = null, validated_at = null,
        return_reason = null, returned_at = null, returned_by = null;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload)
  select prof.id,
         'notas_registradas',
         'Notas por validar',
         'El profesor envió las notas de ' || coalesce(v_cohorte, 'una cohorte') || ' · ' || coalesce(v_modulo, 'módulo') || '. Falta tu validación.',
         jsonb_build_object('cohort_id', p_cohort, 'module_id', p_module)
  from public.profiles prof
  where prof.role in ('direccion_academica', 'super_admin');
end;
$$;

-- Módulos que da el profesor: los de sus cohortes, sus sesiones y sus asignaciones.
create or replace function public.modulos_que_imparto()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m from public.mis_modulos_docente() m
  union
  select tma.module_id from public.teacher_module_assignments tma where tma.teacher_id = auth.uid();
$$;
grant execute on function public.modulos_que_imparto() to authenticated;

-- El profesor registra, edita y quita evaluaciones de sus módulos.
drop policy if exists "profesor: administra evaluaciones de sus modulos" on public.manual_exam_definitions;
create policy "profesor: administra evaluaciones de sus modulos"
  on public.manual_exam_definitions for all
  using ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto()))
  with check ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto()));

update public.module_enrollments set updated_at = now();
