-- 168: recordatorio push cada sábado a los profesores con un módulo en curso,
-- para que carguen la nota de la semana. Mismo patrón que los demás avisos
-- automáticos (daily_notification_log + pg_cron).
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente',
    'material_nuevo',
    'modulo_cambiado',
    'hora_clase',
    'hora_refrigerio',
    'notas_registradas',
    'recordatorio_pago',
    'recordatorio_notas'
  ));

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
         'push'
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

-- Todos los sábados a las 12:00 hora de Caracas (16:00 UTC) — cuando ya pasó la clase.
select cron.schedule(
  'recordar-cargar-notas-sabado',
  '0 16 * * 6',
  $$ select public.fn_recordar_cargar_notas(); $$
);
