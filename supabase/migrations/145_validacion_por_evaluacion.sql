-- 145_validacion_por_evaluacion.sql
-- Reunión de Dirección Académica (oct. 2026), caso de prueba "Juan / Luis":
--  * Lo que Dirección valida se queda visible para el estudiante aunque el
--    profesor cargue después otras evaluaciones: la validación es POR
--    EVALUACIÓN (por cohorte), ya no "todo el módulo o nada".
--  * Las evaluaciones nuevas aparecen en rayitas hasta que se validen.
--  * Devolver al profesor solo reabre lo que está por validar; lo ya validado
--    no se le quita al estudiante.
--  * El estudiante ve su nota acumulada a medida que avanza el módulo (solo con
--    lo validado), no únicamente al final.

create table if not exists public.grade_validated_evals (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  definition_id uuid not null references public.manual_exam_definitions(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  validated_by uuid references public.profiles(id),
  validated_at timestamptz not null default now(),
  primary key (cohort_id, definition_id)
);
alter table public.grade_validated_evals enable row level security;

drop policy if exists "estudiante: ver lo validado de su cohorte" on public.grade_validated_evals;
create policy "estudiante: ver lo validado de su cohorte"
  on public.grade_validated_evals for select
  using (cohort_id = (select public.my_cohort_id()));

drop policy if exists "personal: ver lo validado de su cohorte" on public.grade_validated_evals;
create policy "personal: ver lo validado de su cohorte"
  on public.grade_validated_evals for select
  using ((select public.teaches_cohort(cohort_id)));

-- Lo que ya estaba validado por módulo pasa a validado por evaluación.
insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by, validated_at)
select g.cohort_id, d.id, d.module_id, g.validated_by, coalesce(g.validated_at, now())
from public.grade_submissions g
join public.manual_exam_definitions d on d.module_id = g.module_id
where g.status = 'validado'
on conflict do nothing;

-- Visibilidad del estudiante: evaluaciones del módulo si hay algo validado; notas solo las validadas.
drop policy if exists "estudiante: leer evaluaciones de modulos validados" on public.manual_exam_definitions;
create policy "estudiante: leer evaluaciones de modulos validados"
  on public.manual_exam_definitions for select
  using (
    (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.cohort_id = (select public.my_cohort_id()) and v.module_id = manual_exam_definitions.module_id
    )
  );

drop policy if exists "estudiante: leer sus notas de examen validadas" on public.manual_exam_scores;
create policy "estudiante: leer sus notas de examen validadas"
  on public.manual_exam_scores for select
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.definition_id = manual_exam_scores.definition_id and v.cohort_id = (select public.my_cohort_id())
    )
  );

drop policy if exists "estudiante: leer sus notas validadas" on public.module_enrollments;
create policy "estudiante: leer sus notas validadas"
  on public.module_enrollments for select
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.cohort_id = module_enrollments.cohort_id and v.module_id = module_enrollments.module_id
    )
  );

-- Validar: marca como validadas todas las evaluaciones del módulo para esa cohorte.
create or replace function public.validar_notas(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_modulo text;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede validar notas.';
  end if;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';

  if not found then
    raise exception 'No hay notas enviadas para validar.';
  end if;

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
  on conflict (cohort_id, definition_id) do nothing;

  select name into v_modulo from public.modules where id = p_module;

  insert into public.notifications (profile_id, type, title, body, payload)
  select s.id,
         'nota_publicada',
         'Ya puedes ver tus notas',
         'Se publicaron tus notas de "' || coalesce(v_modulo, 'tu módulo') || '".',
         jsonb_build_object('module_id', p_module)
  from public.students s
  where s.cohort_id = p_cohort;
end;
$$;

-- Devolver: solo lo que está enviado y por validar. Lo ya validado no se toca.
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
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado'
  returning submitted_by into v_envio;

  if not found then
    raise exception 'No hay notas enviadas por validar para devolver.';
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

-- Si el profesor cambia una nota ya validada, solo esa evaluación vuelve a quedar por validar.
create or replace function public.fn_bloquear_notas_enviadas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_def uuid;
  v_status text;
begin
  if (select public.auth_role()) <> 'profesor' then
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

  select status into v_status from public.grade_submissions
  where cohort_id = v_cohort and module_id = v_module;

  if v_status = 'enviado' then
    raise exception 'Las notas están enviadas y esperan la validación de Dirección Académica. Pide que te las devuelvan para corregir.';
  elsif v_status = 'validado' then
    delete from public.grade_submissions where cohort_id = v_cohort and module_id = v_module;
  end if;

  -- Esa evaluación vuelve a ser "por validar" (las demás siguen visibles).
  if v_def is not null then
    delete from public.grade_validated_evals where cohort_id = v_cohort and definition_id = v_def;
  end if;
  return coalesce(new, old);
end;
$$;

-- Una evaluación nueva reabre el envío (enviado o validado); lo ya validado se queda.
create or replace function public.fn_reabrir_envios_nueva_evaluacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.grade_submissions
  where module_id = new.module_id and status in ('enviado', 'validado');
  return new;
end;
$$;

-- Resumen del estudiante: solo con lo validado (nota acumulada mientras avanza el módulo).
create or replace function public.mis_notas_modulos()
returns table (module_id uuid, puntos numeric, evaluado_pct numeric, umbral numeric, estado text)
language sql stable security definer set search_path = public as $$
  select e.module_id,
         round(coalesce(sum(s.score / d.scale_max * 20 * d.weight_pct / 100), 0), 2) as puntos,
         coalesce(sum(d.weight_pct) filter (where s.score is not null), 0) as evaluado_pct,
         e.passing_threshold as umbral,
         case
           when e.status = 'retirado' then 'retirado'
           when coalesce(sum(d.weight_pct) filter (where s.score is not null), 0) < 100 then 'en_curso'
           when coalesce(sum(s.score / d.scale_max * 20 * d.weight_pct / 100), 0) >= e.passing_threshold then 'aprobado'
           else 'reprobado'
         end as estado
  from public.module_enrollments e
  join public.grade_validated_evals v on v.cohort_id = e.cohort_id and v.module_id = e.module_id
  join public.manual_exam_definitions d on d.id = v.definition_id
  left join public.manual_exam_scores s on s.definition_id = d.id and s.student_id = e.student_id
  where e.student_id = auth.uid() and (select public.estudiante_solvente())
  group by e.module_id, e.passing_threshold, e.status;
$$;
grant execute on function public.mis_notas_modulos() to authenticated;
