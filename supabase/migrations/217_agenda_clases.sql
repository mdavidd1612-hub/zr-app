-- Agenda de clases (18-nov-2026): para cada sabado proximo, hora (cohorts.schedule),
-- modulo (calendario de modulos o el actual), profesor (asignacion del modulo en
-- Cobertura) y salon (migracion 216). Un estudiante solo ve su cohorte; un profesor,
-- las suyas; el personal academico, todas las activas. Solo lectura.

create or replace function public.fn_agenda_clases(p_semanas int default 8)
returns table (class_date date, hora text, modulo text, profesor text, salon text, cohort_id uuid, cohort_name text)
language sql stable security definer set search_path = public as $$
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
           where cmc.cohort_id = v.id and s.f between cmc.start_date and cmc.end_date limit 1),
         v.current_module_id)
    ) m on true
   order by s.f, v.name;
$$;

revoke execute on function public.fn_agenda_clases(int) from public, anon;
grant execute on function public.fn_agenda_clases(int) to authenticated;
