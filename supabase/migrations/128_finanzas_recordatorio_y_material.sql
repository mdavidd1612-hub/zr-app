-- =============================================================================
-- ZR APP · MIGRACIÓN 128 · Finanzas: recordatorio recurrente + "No solvente" bloquea Material
-- =============================================================================
-- Reunión de sept. 2026:
--   1. A quien está en 'solvente_pendiente' (la administradora le dio chance)
--      se le recuerda cada día que sigue atrasado, hasta que lo pasen a
--      'solvente'. Aviso push por el mismo canal de notificaciones.
--   2. 'no_solvente' bloquea también el acceso a Materiales, no solo tomar
--      asistencia. Se aplica en la base (RLS), no solo ocultando botones; como
--      los archivos de Storage dependen de content_items (migración 122), el
--      bloqueo llega también a los archivos.
-- =============================================================================

-- ---------------------------------------------------------------- 1. Recordatorio
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
    'recordatorio_pago'
  ));

create or replace function public.fn_recordar_solvencia_pendiente()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.daily_notification_log
    where type = 'recordatorio_pago' and sent_on = current_date
  ) then
    return;
  end if;

  insert into public.notifications (profile_id, type, title, body, payload)
  select s.id,
         'recordatorio_pago',
         'Tienes un pago pendiente',
         'Sigues con un pago atrasado. Habla con administración para ponerte al día.',
         '{}'::jsonb
  from public.students s
  where s.payment_status = 'solvente_pendiente';

  insert into public.daily_notification_log (type) values ('recordatorio_pago');
end;
$$;

-- Todos los días a las 12:00 hora de Caracas (16:00 UTC).
select cron.schedule(
  'recordar-solvencia-pendiente-diario',
  '0 16 * * *',
  $$ select public.fn_recordar_solvencia_pendiente(); $$
);

-- --------------------------------------------------- 2. No solvente no ve Material
create or replace function public.estudiante_solvente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.payment_status <> 'no_solvente' from public.students s where s.id = auth.uid()),
    true
  );
$$;

drop policy "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;
create policy "estudiante: leer contenido publicado de sus modulos cursados"
  on public.content_items for select
  to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select public.mis_modulos_cursados())
    and (select public.estudiante_solvente())
  );

drop policy "estudiante: leer carpetas de sus modulos cursados" on public.content_folders;
create policy "estudiante: leer carpetas de sus modulos cursados"
  on public.content_folders for select
  to authenticated
  using (
    module_id in (select public.mis_modulos_cursados())
    and (select public.estudiante_solvente())
  );
