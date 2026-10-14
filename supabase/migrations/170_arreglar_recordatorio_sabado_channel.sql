-- 170: la 168 fallaba al insertar — el `select distinct` con el literal 'push'
-- no se convertía solo al tipo notification_channel de la columna `channel`
-- (funcionó en publicar_notas_profesor porque ahí no hay DISTINCT). Error real
-- encontrado al probar el recordatorio en producción tras subirlo (13 oct.).
create or replace function public.fn_recordar_cargar_notas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.daily_notification_log
    where type = 'recordatorio_notas' and sent_on = current_date
  ) then
    return;
  end if;

  insert into public.notifications (profile_id, type, title, body, payload, channel)
  select distinct a.teacher_id,
         'recordatorio_notas',
         'Toca cargar notas 📋',
         'No olvides montar la nota de esta semana en «' || m.name || '» · ' || c.name || '.',
         jsonb_build_object('cohort_id', c.id, 'module_id', m.id),
         'push'::public.notification_channel
  from public.teacher_module_assignments a
  join public.modules m on m.id = a.module_id
  join public.cohorts c on c.id = coalesce(a.cohort_id, (
         select k.cohort_id from public.cohort_module_calendar k
          where k.module_id = a.module_id
          order by k.start_date desc limit 1
       ))
  where c.status = 'activa'
    and public.estado_modulo_cohorte(c.id, m.id) = 'en_curso';

  insert into public.daily_notification_log (type) values ('recordatorio_notas');
end;
$$;
revoke execute on function public.fn_recordar_cargar_notas() from public, anon, authenticated;
