-- 143_notas_ponderadas.sql
-- Reunión de Dirección Académica sobre Notas (oct. 2026):
--  * Cada evaluación lleva un porcentaje (weight_pct). Las de un módulo + la
--    participación suman exactamente 100 % para poder enviar las notas.
--  * La participación es un renglón propio con peso entre un mínimo y un máximo
--    (system_config), definido por módulo (modules.participation_pct).
--  * Se acaban "Teoría" / "Práctica" / "Puntualidad" como parte de la nota: la
--    nota final es la suma ponderada de las evaluaciones + la participación.
--    La puntualidad sigue existiendo como información (sábados puntuales), pero
--    ya no entra en la nota.
--  * Nota en progreso: final_score = puntos ganados hasta ahora (sobre 20);
--    evaluated_pct = qué parte del módulo ya está evaluada. Solo cuando
--    evaluated_pct llega a 100 se decide aprobado / reprobado.
--  * Devolver al profesor exige un motivo, que el profesor ve (status 'devuelto').

insert into public.system_config (key, value, description, is_public)
values ('module.participation_weight_max', '0.10', 'Peso máximo de la participación en la nota final del módulo (reunión de Dirección Académica, oct. 2026).', true)
on conflict (key) do nothing;

alter table public.manual_exam_definitions
  add column if not exists weight_pct numeric not null default 0
    check (weight_pct >= 0 and weight_pct <= 100);

alter table public.modules
  add column if not exists participation_pct numeric not null default 5
    check (participation_pct >= 0 and participation_pct <= 100);

alter table public.module_enrollments
  add column if not exists evaluated_pct numeric not null default 0;

alter table public.grade_submissions
  drop constraint if exists grade_submissions_status_check;
alter table public.grade_submissions
  add constraint grade_submissions_status_check
  check (status = any (array['enviado'::text, 'validado'::text, 'devuelto'::text]));
alter table public.grade_submissions
  add column if not exists return_reason text,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_by uuid references public.profiles(id);

-- El peso de la participación debe estar dentro del rango configurado.
create or replace function public.fn_validar_peso_participacion()
returns trigger language plpgsql set search_path = public as $$
declare
  v_min numeric := public.cfg_num('module.participation_weight_min', 0.05) * 100;
  v_max numeric := public.cfg_num('module.participation_weight_max', 0.10) * 100;
begin
  if new.participation_pct < v_min or new.participation_pct > v_max then
    raise exception 'La participación debe valer entre % %% y % %% del módulo.', v_min, v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_peso_participacion on public.modules;
create trigger trg_validar_peso_participacion
  before insert or update of participation_pct on public.modules
  for each row execute function public.fn_validar_peso_participacion();

-- Los pesos de las evaluaciones de un módulo + la participación no pueden pasar de 100 %.
create or replace function public.fn_validar_suma_pesos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_otros numeric;
  v_part numeric;
begin
  select coalesce(sum(weight_pct), 0) into v_otros
  from public.manual_exam_definitions
  where module_id = new.module_id and id <> new.id;
  select participation_pct into v_part from public.modules where id = new.module_id;
  if v_otros + new.weight_pct + coalesce(v_part, 0) > 100 then
    raise exception 'Los porcentajes pasan de 100 %%: las otras evaluaciones suman % %%, la participación % %% y esta pide % %%.',
      v_otros, v_part, new.weight_pct;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_suma_pesos on public.manual_exam_definitions;
create trigger trg_validar_suma_pesos
  before insert or update of weight_pct, module_id on public.manual_exam_definitions
  for each row execute function public.fn_validar_suma_pesos();

-- Nota del módulo: suma ponderada de lo ya calificado + participación.
create or replace function public.fn_recalc_enrollment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_pts numeric;
  v_pct numeric;
  v_part_pct numeric;
begin
  select sum(s.score / d.scale_max * 20 * d.weight_pct / 100), sum(d.weight_pct)
    into v_pts, v_pct
  from public.manual_exam_scores s
  join public.manual_exam_definitions d on d.id = s.definition_id
  where s.student_id = new.student_id and d.module_id = new.module_id;

  v_pts := coalesce(v_pts, 0);
  v_pct := coalesce(v_pct, 0);

  new.participation_score := new.class_participation_score;
  select participation_pct into v_part_pct from public.modules where id = new.module_id;
  new.participation_weight := coalesce(v_part_pct, 5) / 100;

  if new.participation_score is not null then
    v_pts := v_pts + new.participation_score * coalesce(v_part_pct, 5) / 100;
    v_pct := v_pct + coalesce(v_part_pct, 5);
  end if;

  new.theory_score := null;
  new.practice_score := null;
  new.evaluated_pct := v_pct;
  new.final_score := case when v_pct > 0 then round(v_pts, 2) end;

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

-- Al cambiar notas, el recálculo ocurre al tocar la matrícula.
create or replace function public.fn_recalc_evaluacion_general(p_student_id uuid, p_module_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.module_enrollments set updated_at = now()
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

-- Si cambia una evaluación (peso, escala, borrado) o el peso de la participación,
-- se recalcula todo el módulo.
create or replace function public.fn_trg_recalc_modulo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mod uuid;
begin
  v_mod := case when tg_table_name = 'modules' then coalesce(new.id, old.id)
                else coalesce(new.module_id, old.module_id) end;
  update public.module_enrollments set updated_at = now() where module_id = v_mod;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_modulo_definiciones on public.manual_exam_definitions;
create trigger trg_recalc_modulo_definiciones
  after update or delete on public.manual_exam_definitions
  for each row execute function public.fn_trg_recalc_modulo();

drop trigger if exists trg_recalc_modulo_participacion on public.modules;
create trigger trg_recalc_modulo_participacion
  after update of participation_pct on public.modules
  for each row execute function public.fn_trg_recalc_modulo();

-- La puntualidad deja de alimentar la nota: solo informa cuántos sábados.
create or replace function public.fn_recalc_puntualidad(p_student_id uuid, p_module_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hoy      date := (now() at time zone 'America/Caracas')::date;
  v_cohorte  uuid;
  v_manual   numeric;
  v_contados int;
  v_auto     numeric;
  v_total    int;
begin
  select cohort_id into v_cohorte from public.students where id = p_student_id;
  select puntualidad_manual into v_manual
  from public.module_enrollments where student_id = p_student_id and module_id = p_module_id;

  with ses as (
    select cs.id, cs.session_date, cs.closed_at
    from public.class_sessions cs
    where cs.cohort_id = v_cohorte and cs.module_id = p_module_id
      and cs.status not in ('cancelada', 'reprogramada')
  ),
  det as (
    select ae.id as ae_id, ae.status as ae_status, aj.id as aj_id,
           (ses.closed_at is not null or ses.session_date < v_hoy) as resuelta
    from ses
    left join public.attendance_events ae on ae.session_id = ses.id and ae.student_id = p_student_id
    left join public.attendance_justifications aj on aj.session_id = ses.id and aj.student_id = p_student_id
  )
  select
    count(*) filter (where ae_id is not null or resuelta),
    greatest(0, 20
      - 3   * count(*) filter (where ae_id is null and aj_id is null and resuelta)
      - 2   * count(*) filter (where ae_id is null and aj_id is not null and resuelta)
      - 0.5 * count(*) filter (where ae_status = 'tarde'))
  into v_contados, v_auto
  from det;

  select count(*) into v_total
  from public.cohort_module_calendar k
  cross join lateral generate_series(k.start_date, k.end_date, interval '1 day') d
  where k.cohort_id = v_cohorte and k.module_id = p_module_id and extract(dow from d) = 6;
  if v_total = 0 then
    select duration_weeks into v_total from public.modules where id = p_module_id;
  end if;

  -- participation_score ya NO se toca aquí: es la participación en clase.
  update public.module_enrollments
  set puntualidad_sabados = v_contados,
      puntualidad_sabados_total = v_total
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

-- Enviar notas: los porcentajes deben sumar exactamente 100.
create or replace function public.enviar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cohorte text;
  v_modulo text;
  v_suma numeric;
  v_part numeric;
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
  select participation_pct into v_part from public.modules where id = p_module;
  if v_suma + coalesce(v_part, 0) <> 100 then
    raise exception 'Los porcentajes del módulo suman % %% y deben sumar 100 %%. Pídele a Dirección Académica que los ajuste en Registrar Evaluación.',
      v_suma + coalesce(v_part, 0);
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

-- Devolver con motivo: queda la fila en estado 'devuelto' (el profesor la ve)
-- y se le avisa al profesor que envió.
drop function if exists public.devolver_notas(uuid, uuid);
create or replace function public.devolver_notas(p_cohort uuid, p_module uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_envio uuid;
  v_cohorte text;
  v_modulo text;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede devolver notas.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribe el motivo de la devolución para que el profesor sepa qué corregir.';
  end if;

  update public.grade_submissions
  set status = 'devuelto', return_reason = btrim(p_motivo), returned_at = now(), returned_by = auth.uid(),
      validated_by = null, validated_at = null
  where cohort_id = p_cohort and module_id = p_module
  returning submitted_by into v_envio;

  if not found then
    raise exception 'No hay notas enviadas para devolver.';
  end if;

  select name into v_cohorte from public.cohorts where id = p_cohort;
  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload)
  select distinct t.profile_id,
         'notas_registradas',
         'Notas devueltas',
         'Dirección Académica devolvió las notas de ' || coalesce(v_cohorte, 'tu cohorte') || ' · ' || coalesce(v_modulo, 'módulo') || ': ' || btrim(p_motivo),
         jsonb_build_object('cohort_id', p_cohort, 'module_id', p_module)
  from (
    select v_envio as profile_id
    union
    select tma.teacher_id from public.teacher_module_assignments tma
    where tma.module_id = p_module
  ) t
  where t.profile_id is not null;
end;
$$;

grant execute on function public.devolver_notas(uuid, uuid, text) to authenticated;

-- Recalcula lo que ya existe con la fórmula nueva.
update public.module_enrollments set updated_at = now();

alter function public.fn_recalc_enrollment() security definer;
alter function public.fn_validar_peso_participacion() security definer;
