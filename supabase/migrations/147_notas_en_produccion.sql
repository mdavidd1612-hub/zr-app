-- 147_notas_en_produccion.sql
-- Sube el sistema de Notas completo a producción (decisión del coordinador,
-- oct. 2026: "despliega todo menos Finanzas"). Es el estado final de las
-- migraciones 108, 110, 111, 125, 126, 127, 131, 132, 134, 136, 139 y 143-146,
-- que en producción solo se habían aplicado hasta la 134 y luego se revirtieron
-- con la 135. SIN Finanzas: donde las políticas llaman a estudiante_solvente()
-- se crea una versión que siempre responde "solvente" si todavía no existe
-- (staging ya tiene la real; cuando Finanzas suba, su migración la reemplaza).
-- Idempotente: se puede correr en staging sin cambiar nada.

-- 0. Solvencia: versión neutra solo si no existe
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'estudiante_solvente' and pronamespace = 'public'::regnamespace) then
    create function public.estudiante_solvente() returns boolean
      language sql stable security definer set search_path = public as 'select true';
  end if;
end $$;

-- 1. Catálogo de notificaciones (suma notas_registradas; conserva lo que ya haya)
do $$
declare
  v_tipos text[];
begin
  select array_agg(distinct t) into v_tipos from (
    select unnest(array['examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible','profesor_pendiente',
                        'material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio','notas_registradas']) t
    union
    select distinct type from public.notifications
  ) x;
  alter table public.notifications drop constraint if exists notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_tipos);
end $$;

-- 2. Configuración
insert into public.system_config (key, value, description, is_public)
values ('module.participation_weight_max', '0.10', 'Peso máximo de la participación en la nota final del módulo.', true)
on conflict (key) do nothing;

-- 3. Columnas de la matrícula
alter table public.module_enrollments
  add column if not exists class_participation_score numeric,
  add column if not exists puntualidad_manual numeric,
  add column if not exists puntualidad_sabados integer,
  add column if not exists puntualidad_sabados_total integer,
  add column if not exists evaluated_pct numeric not null default 0;

-- 4. Tablas
create table if not exists public.manual_exam_definitions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id),
  exam_date date not null,
  title text not null check (length(trim(both from title)) > 0),
  scale_max numeric not null default 20 check (scale_max > 0),
  passing_min numeric not null default 12 check (passing_min >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  kind text not null default 'examen',
  kind_detail text,
  weight_pct numeric not null default 0 check (weight_pct >= 0 and weight_pct <= 100),
  constraint chk_manual_exam_umbral check (passing_min <= scale_max),
  constraint chk_otro_con_detalle check (kind <> 'otro' or length(btrim(coalesce(kind_detail, ''))) > 0),
  constraint manual_exam_definitions_kind_check check (kind = any (array['examen','practica','prepractica','exposicion','participacion','otro']))
);
create index if not exists idx_manual_exam_module on public.manual_exam_definitions (module_id);

create table if not exists public.manual_exam_scores (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.manual_exam_definitions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric not null check (score >= 0),
  graded_by uuid references public.profiles(id),
  graded_at timestamptz not null default now(),
  unique (definition_id, student_id)
);
create index if not exists idx_manual_exam_scores_def on public.manual_exam_scores (definition_id);
create index if not exists idx_manual_exam_scores_student on public.manual_exam_scores (student_id);

create table if not exists public.grade_submissions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  status text not null check (status = any (array['enviado','validado','devuelto'])),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  return_reason text,
  returned_at timestamptz,
  returned_by uuid references public.profiles(id),
  constraint grade_submissions_cohort_module_key unique (cohort_id, module_id)
);

create table if not exists public.grade_validated_evals (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  definition_id uuid not null references public.manual_exam_definitions(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  validated_by uuid references public.profiles(id),
  validated_at timestamptz not null default now(),
  primary key (cohort_id, definition_id)
);

alter table public.manual_exam_definitions enable row level security;
alter table public.manual_exam_scores enable row level security;
alter table public.grade_submissions enable row level security;
alter table public.grade_validated_evals enable row level security;

-- 5. Funciones
create or replace function public.fn_asegurar_enrollment(p_student_id uuid, p_module_id uuid, p_cohort_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_module_id is null then return; end if;
  insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
  values (p_student_id, p_module_id, p_cohort_id, 0)
  on conflict (student_id, module_id) do nothing;
end;
$$;

create or replace function public.fn_asegurar_enrollment_estudiante()
returns trigger language plpgsql security definer set search_path = public as $$
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

create or replace function public.fn_asegurar_enrollments_cohorte()
returns trigger language plpgsql security definer set search_path = public as $$
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

create or replace function public.fn_validar_escala_examen_manual()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_escala numeric;
begin
  select scale_max into v_escala from public.manual_exam_definitions where id = new.definition_id;
  if v_escala is not null and new.score > v_escala then
    raise exception 'La nota (%) no puede superar la escala del examen (%).', new.score, v_escala;
  end if;
  return new;
end;
$$;

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

create or replace function public.fn_recalc_evaluacion_general(p_student_id uuid, p_module_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.module_enrollments set updated_at = now()
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

create or replace function public.fn_trg_recalc_evaluacion_general()
returns trigger language plpgsql security definer set search_path = public as $$
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

create or replace function public.fn_reabrir_envios_nueva_evaluacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.grade_submissions
  where module_id = new.module_id and status in ('enviado', 'validado');
  return new;
end;
$$;

create or replace function public.fn_bloquear_notas_enviadas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
  v_def uuid;
  v_status text;
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

create or replace function public.fn_recalc_puntualidad(p_student_id uuid, p_module_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hoy      date := (now() at time zone 'America/Caracas')::date;
  v_cohorte  uuid;
  v_contados int;
  v_total    int;
begin
  select cohort_id into v_cohorte from public.students where id = p_student_id;

  select count(*) into v_contados
  from public.class_sessions cs
  left join public.attendance_events ae on ae.session_id = cs.id and ae.student_id = p_student_id
  where cs.cohort_id = v_cohorte and cs.module_id = p_module_id
    and cs.status not in ('cancelada', 'reprogramada')
    and (ae.id is not null or cs.closed_at is not null or cs.session_date < v_hoy);

  select count(*) into v_total
  from public.cohort_module_calendar k
  cross join lateral generate_series(k.start_date, k.end_date, interval '1 day') d
  where k.cohort_id = v_cohorte and k.module_id = p_module_id and extract(dow from d) = 6;
  if v_total = 0 then
    select duration_weeks into v_total from public.modules where id = p_module_id;
  end if;

  update public.module_enrollments
  set puntualidad_sabados = v_contados,
      puntualidad_sabados_total = v_total
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;

create or replace function public.fn_recalc_puntualidad_todos()
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  for e in
    select me.student_id, me.module_id
    from public.module_enrollments me
    join public.cohorts c on c.id = me.cohort_id
    where c.status = 'activa'
  loop
    perform public.fn_recalc_puntualidad(e.student_id, e.module_id);
  end loop;
end;
$$;

create or replace function public.fn_trg_puntualidad_manual()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.puntualidad_manual is distinct from old.puntualidad_manual then
    perform public.fn_recalc_puntualidad(new.student_id, new.module_id);
  end if;
  return null;
end;
$$;

create or replace function public.fn_trg_recalc_puntualidad_asistencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_module_id uuid;
begin
  select module_id into v_module_id from public.class_sessions where id = coalesce(new.session_id, old.session_id);
  perform public.fn_recalc_puntualidad(coalesce(new.student_id, old.student_id), v_module_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.fn_trg_recalc_puntualidad_cierre_sesion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.closed_at is not null and old.closed_at is null then
    perform public.fn_recalc_puntualidad(s.id, new.module_id)
    from public.students s
    where s.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

create or replace function public.modulos_que_imparto()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m from public.mis_modulos_docente() m
  union
  select tma.module_id from public.teacher_module_assignments tma where tma.teacher_id = auth.uid();
$$;

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

create or replace function public.publicar_cambios(p_cohort uuid, p_module uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede publicar notas.';
  end if;

  insert into public.grade_validated_evals (cohort_id, definition_id, module_id, validated_by)
  select p_cohort, d.id, d.module_id, auth.uid()
  from public.manual_exam_definitions d
  where d.module_id = p_module
  on conflict (cohort_id, definition_id) do nothing;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';
end;
$$;

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

-- 6. Permisos de las funciones: nada de funciones internas para anónimos
revoke execute on function public.fn_asegurar_enrollment(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_asegurar_enrollment_estudiante() from public, anon, authenticated;
revoke execute on function public.fn_asegurar_enrollments_cohorte() from public, anon, authenticated;
revoke execute on function public.fn_validar_escala_examen_manual() from public, anon, authenticated;
revoke execute on function public.fn_validar_suma_pesos() from public, anon, authenticated;
revoke execute on function public.fn_recalc_enrollment() from public, anon, authenticated;
revoke execute on function public.fn_recalc_evaluacion_general(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_trg_recalc_evaluacion_general() from public, anon, authenticated;
revoke execute on function public.fn_trg_recalc_modulo() from public, anon, authenticated;
revoke execute on function public.fn_reabrir_envios_nueva_evaluacion() from public, anon, authenticated;
revoke execute on function public.fn_bloquear_notas_enviadas() from public, anon, authenticated;
revoke execute on function public.fn_recalc_puntualidad(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_recalc_puntualidad_todos() from public, anon, authenticated;
revoke execute on function public.fn_trg_puntualidad_manual() from public, anon, authenticated;
revoke execute on function public.fn_trg_recalc_puntualidad_asistencia() from public, anon, authenticated;
revoke execute on function public.fn_trg_recalc_puntualidad_cierre_sesion() from public, anon, authenticated;
revoke execute on function public.enviar_notas(uuid, uuid) from public, anon;
revoke execute on function public.validar_notas(uuid, uuid) from public, anon;
revoke execute on function public.devolver_notas(uuid, uuid, text) from public, anon;
revoke execute on function public.publicar_cambios(uuid, uuid) from public, anon;
revoke execute on function public.mis_notas_modulos() from public, anon;
revoke execute on function public.modulos_que_imparto() from public, anon;
grant execute on function public.enviar_notas(uuid, uuid) to authenticated;
grant execute on function public.validar_notas(uuid, uuid) to authenticated;
grant execute on function public.devolver_notas(uuid, uuid, text) to authenticated;
grant execute on function public.publicar_cambios(uuid, uuid) to authenticated;
grant execute on function public.mis_notas_modulos() to authenticated;
grant execute on function public.modulos_que_imparto() to authenticated;

-- 7. Disparadores
drop trigger if exists trg_reabrir_envios_nueva_evaluacion on public.manual_exam_definitions;
create trigger trg_reabrir_envios_nueva_evaluacion after insert on public.manual_exam_definitions
  for each row execute function public.fn_reabrir_envios_nueva_evaluacion();
drop trigger if exists trg_recalc_modulo_definiciones on public.manual_exam_definitions;
create trigger trg_recalc_modulo_definiciones after delete or update on public.manual_exam_definitions
  for each row execute function public.fn_trg_recalc_modulo();
drop trigger if exists trg_validar_suma_pesos on public.manual_exam_definitions;
create trigger trg_validar_suma_pesos before insert or update of weight_pct, module_id, kind on public.manual_exam_definitions
  for each row execute function public.fn_validar_suma_pesos();

drop trigger if exists trg_bloquear_notas_enviadas_scores on public.manual_exam_scores;
create trigger trg_bloquear_notas_enviadas_scores before insert or delete or update on public.manual_exam_scores
  for each row execute function public.fn_bloquear_notas_enviadas();
drop trigger if exists trg_recalc_evaluacion_general on public.manual_exam_scores;
create trigger trg_recalc_evaluacion_general after insert or delete or update on public.manual_exam_scores
  for each row execute function public.fn_trg_recalc_evaluacion_general();
drop trigger if exists trg_validar_escala_examen_manual on public.manual_exam_scores;
create trigger trg_validar_escala_examen_manual before insert or update on public.manual_exam_scores
  for each row execute function public.fn_validar_escala_examen_manual();

drop trigger if exists trg_asegurar_enrollment_estudiante on public.students;
create trigger trg_asegurar_enrollment_estudiante after insert or update of cohort_id on public.students
  for each row execute function public.fn_asegurar_enrollment_estudiante();
drop trigger if exists trg_asegurar_enrollments_cohorte on public.cohorts;
create trigger trg_asegurar_enrollments_cohorte after update of current_module_id on public.cohorts
  for each row execute function public.fn_asegurar_enrollments_cohorte();

drop trigger if exists trg_bloquear_notas_enviadas_participacion on public.module_enrollments;
create trigger trg_bloquear_notas_enviadas_participacion before update of class_participation_score, puntualidad_manual on public.module_enrollments
  for each row execute function public.fn_bloquear_notas_enviadas();
drop trigger if exists trg_puntualidad_manual on public.module_enrollments;
create trigger trg_puntualidad_manual after update of puntualidad_manual on public.module_enrollments
  for each row execute function public.fn_trg_puntualidad_manual();

drop trigger if exists trg_recalc_puntualidad_asistencia on public.attendance_events;
create trigger trg_recalc_puntualidad_asistencia after insert or delete or update on public.attendance_events
  for each row execute function public.fn_trg_recalc_puntualidad_asistencia();
drop trigger if exists trg_recalc_puntualidad_justificacion on public.attendance_justifications;
create trigger trg_recalc_puntualidad_justificacion after insert or delete on public.attendance_justifications
  for each row execute function public.fn_trg_recalc_puntualidad_asistencia();
drop trigger if exists trg_recalc_puntualidad_cierre_sesion on public.class_sessions;
create trigger trg_recalc_puntualidad_cierre_sesion after update on public.class_sessions
  for each row execute function public.fn_trg_recalc_puntualidad_cierre_sesion();

-- 8. Políticas (RLS)
drop policy if exists "direccion: administra examenes manuales" on public.manual_exam_definitions;
create policy "direccion: administra examenes manuales" on public.manual_exam_definitions for all
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "staff: leer examenes manuales" on public.manual_exam_definitions;
create policy "staff: leer examenes manuales" on public.manual_exam_definitions for select
  using ((select public.is_staff()));
drop policy if exists "profesor: administra evaluaciones de sus modulos" on public.manual_exam_definitions;
create policy "profesor: administra evaluaciones de sus modulos" on public.manual_exam_definitions for all
  using ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto()))
  with check ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto()));
drop policy if exists "estudiante: leer evaluaciones de modulos validados" on public.manual_exam_definitions;
create policy "estudiante: leer evaluaciones de modulos validados" on public.manual_exam_definitions for select
  using (
    (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.cohort_id = (select public.my_cohort_id()) and v.module_id = manual_exam_definitions.module_id
    )
  );

drop policy if exists "direccion: leer todas las notas de examen manual" on public.manual_exam_scores;
create policy "direccion: leer todas las notas de examen manual" on public.manual_exam_scores for select
  using ((select public.is_admin_up()));
drop policy if exists "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores;
create policy "profesor: calificar examen manual de su cohorte" on public.manual_exam_scores for all
  using (exists (select 1 from public.students s where s.id = manual_exam_scores.student_id and (select public.teaches_cohort(s.cohort_id))))
  with check (exists (select 1 from public.students s where s.id = manual_exam_scores.student_id and (select public.teaches_cohort(s.cohort_id))));
drop policy if exists "estudiante: leer sus notas de examen validadas" on public.manual_exam_scores;
create policy "estudiante: leer sus notas de examen validadas" on public.manual_exam_scores for select
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.definition_id = manual_exam_scores.definition_id and v.cohort_id = (select public.my_cohort_id())
    )
  );

drop policy if exists "estudiante: ver el estado de su cohorte" on public.grade_submissions;
create policy "estudiante: ver el estado de su cohorte" on public.grade_submissions for select to authenticated
  using (cohort_id = (select public.my_cohort_id()));
drop policy if exists "personal: ver envios de su cohorte" on public.grade_submissions;
create policy "personal: ver envios de su cohorte" on public.grade_submissions for select to authenticated
  using ((select public.teaches_cohort(grade_submissions.cohort_id)));

drop policy if exists "estudiante: ver lo validado de su cohorte" on public.grade_validated_evals;
create policy "estudiante: ver lo validado de su cohorte" on public.grade_validated_evals for select
  using (cohort_id = (select public.my_cohort_id()));
drop policy if exists "personal: ver lo validado de su cohorte" on public.grade_validated_evals;
create policy "personal: ver lo validado de su cohorte" on public.grade_validated_evals for select
  using ((select public.teaches_cohort(grade_validated_evals.cohort_id)));

drop policy if exists "estudiante: leer sus notas" on public.module_enrollments;
drop policy if exists "estudiante: leer sus notas validadas" on public.module_enrollments;
create policy "estudiante: leer sus notas validadas" on public.module_enrollments for select
  using (
    student_id = (select auth.uid())
    and (select public.estudiante_solvente())
    and exists (
      select 1 from public.grade_validated_evals v
      where v.cohort_id = module_enrollments.cohort_id and v.module_id = module_enrollments.module_id
    )
  );
drop policy if exists "personal: leer notas de su cohorte" on public.module_enrollments;
create policy "personal: leer notas de su cohorte" on public.module_enrollments for select to authenticated
  using ((select public.teaches_cohort(module_enrollments.cohort_id)));
drop policy if exists "personal: actualizar notas de su cohorte" on public.module_enrollments;
create policy "personal: actualizar notas de su cohorte" on public.module_enrollments for update to authenticated
  using ((select public.teaches_cohort(module_enrollments.cohort_id)))
  with check ((select public.teaches_cohort(module_enrollments.cohort_id)));
drop policy if exists "personal: escribir notas de su cohorte" on public.module_enrollments;
create policy "personal: escribir notas de su cohorte" on public.module_enrollments for insert to authenticated
  with check ((select public.teaches_cohort(module_enrollments.cohort_id)));

-- 9. Tarea nocturna de sábados puntuales (solo informativa)
select cron.unschedule('recalcular-puntualidad-nocturno') where exists (select 1 from cron.job where jobname = 'recalcular-puntualidad-nocturno');
select cron.schedule('recalcular-puntualidad-nocturno', '40 4 * * *', 'select public.fn_recalc_puntualidad_todos();');

-- 10. Matrículas del módulo actual de cada cohorte (para que el profesor vea a todos)
insert into public.module_enrollments (student_id, module_id, cohort_id, passing_threshold)
select s.id, c.current_module_id, c.id, 0
from public.students s
join public.cohorts c on c.id = s.cohort_id
where c.current_module_id is not null
on conflict (student_id, module_id) do nothing;
