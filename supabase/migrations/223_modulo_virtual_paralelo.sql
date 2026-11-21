-- Modulo VIRTUAL en paralelo (19-nov-2026): Ingles Tecnico 100 % virtual mientras
-- la cohorte cursa Fluidos presencial. Un tramo del calendario puede marcarse
-- 'virtual': cuenta para que el estudiante vea el modulo (mis_modulos_cursados),
-- para su estado (en curso/terminado) y para la ventana de notas del profesor,
-- pero NO toca la clase presencial: no cambia el modulo actual de la cohorte,
-- no reasigna sesiones del sabado, no sale en la agenda de clases y no cuenta
-- sabados para la puntualidad.
alter table public.cohort_module_calendar
  add column if not exists modalidad text not null default 'presencial'
  check (modalidad in ('presencial', 'virtual'));

create or replace function public.modulo_por_calendario(p_cohort uuid, p_fecha date)
returns uuid language sql stable set search_path to 'public' as $$
  select module_id from public.cohort_module_calendar
  where cohort_id = p_cohort and start_date <= p_fecha and modalidad = 'presencial'
  order by start_date desc
  limit 1;
$$;

create or replace function public.fn_agenda_clases(p_semanas integer default 8)
returns table(class_date date, hora text, modulo text, profesor text, salon text, cohort_id uuid, cohort_name text)
language sql stable security definer set search_path to 'public' as $$
  with yo as (select auth.uid() as id, (select auth_role()::text) as rol),
  visibles as (
    select c.* from public.cohorts c, yo
    where c.status = 'activa' and (
      (yo.rol = 'estudiante' and c.id = (select s.cohort_id from public.students s where s.id = yo.id))
      or (yo.rol = 'profesor' and (c.teacher_id = yo.id or exists (
            select 1 from public.teacher_module_assignments t where t.cohort_id = c.id and t.teacher_id = yo.id)))
      or yo.rol in ('admin', 'direccion_academica', 'super_admin')
    )
  ),
  sabados as (
    select d::date as f from generate_series(
      current_date + ((6 - extract(dow from current_date)::int + 7) % 7),
      current_date + ((6 - extract(dow from current_date)::int + 7) % 7) + (greatest(p_semanas,1) - 1) * 7,
      interval '7 days') d
  )
  select s.f, v.schedule,
         m.name,
         coalesce(
           (select p.full_name from public.teacher_module_assignments t join public.profiles p on p.id = t.teacher_id
             where t.cohort_id = v.id and t.module_id = m.id order by t.assigned_at desc limit 1),
           (select p.full_name from public.profiles p where p.id = v.teacher_id)),
         (select r.nombre from public.cohort_room_days d join public.rooms r on r.id = d.room_id
           where d.cohort_id = v.id and d.class_date <= s.f order by d.class_date desc limit 1),
         v.id, v.name
    from visibles v cross join sabados s
    left join lateral (
      select mm.id, mm.name from public.modules mm
       where mm.id = coalesce(
         (select cmc.module_id from public.cohort_module_calendar cmc
           where cmc.cohort_id = v.id and cmc.modalidad = 'presencial'
             and s.f between cmc.start_date and cmc.end_date
           order by cmc.start_date desc limit 1),
         v.current_module_id)
    ) m on true
   order by s.f, v.name;
$$;

-- Puntualidad: un modulo solo virtual para la cohorte no tiene sabados que contar.
create or replace function public.fn_recalc_puntualidad(p_student_id uuid, p_module_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_hoy      date := (now() at time zone 'America/Caracas')::date;
  v_cohorte  uuid;
  v_manual   numeric;
  v_contados int;
  v_auto     numeric;
  v_total    int;
begin
  select cohort_id into v_cohorte from public.students where id = p_student_id;

  if exists (select 1 from public.cohort_module_calendar k
             where k.cohort_id = v_cohorte and k.module_id = p_module_id and k.modalidad = 'virtual')
     and not exists (select 1 from public.cohort_module_calendar k
             where k.cohort_id = v_cohorte and k.module_id = p_module_id and k.modalidad = 'presencial') then
    return;
  end if;

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
  where k.cohort_id = v_cohorte and k.module_id = p_module_id and k.modalidad = 'presencial'
    and extract(dow from d) = 6;
  if v_total = 0 then
    select duration_weeks into v_total from public.modules where id = p_module_id;
  end if;

  update public.module_enrollments
  set puntualidad_sabados = v_contados,
      puntualidad_sabados_total = v_total
  where student_id = p_student_id and module_id = p_module_id;
end;
$$;
