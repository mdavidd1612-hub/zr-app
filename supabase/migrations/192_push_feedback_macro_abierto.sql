-- =============================================================================
-- ZR APP · MIGRACIÓN 192 · Push cuando Dirección Académica abre el feedback
-- de módulo (feedback_macro_windows)
-- =============================================================================
-- Hueco real encontrado en vivo el 7-nov-2026: "Abrir formulario" en
-- /feedback-modulos (alternarVentana) solo hace un upsert plano sobre
-- feedback_macro_windows -- nunca existió un trigger que avisara a los
-- estudiantes, a diferencia de fn_notify_hora_clase (migr. 106) o
-- fn_notify_modulo_cambiado (migr. 106), que sí notifican por push. Se
-- cierra ese hueco con el mismo patrón: insertar en notifications con
-- channel = 'push' explícito (si no, send-push -- función 7 -- no la
-- procesa, migr. 106).
--
-- Dispara solo al ABRIR (fila nueva con closed_at null, o una ya cerrada que
-- se reabre poniendo closed_at de vuelta en null) -- nunca al cerrar, y
-- nunca dos veces para la misma apertura gracias al "is distinct from".
-- =============================================================================

create or replace function public.fn_notify_feedback_macro_abierto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_modulo text;
begin
  if new.closed_at is null
     and (tg_op = 'INSERT' or old.closed_at is not null)
  then
    select name into v_nombre_modulo from public.modules where id = new.module_id;

    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'feedback_disponible',
           'Cuéntanos qué tal el módulo',
           'Ya puedes dar tu feedback de "' || coalesce(v_nombre_modulo, 'este módulo') || '". Es anónimo.',
           jsonb_build_object('cohort_id', new.cohort_id, 'module_id', new.module_id),
           'push'
    from public.students s
    where s.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_feedback_macro_abierto on public.feedback_macro_windows;
create trigger trg_notify_feedback_macro_abierto
after insert or update on public.feedback_macro_windows
for each row
execute function public.fn_notify_feedback_macro_abierto();
