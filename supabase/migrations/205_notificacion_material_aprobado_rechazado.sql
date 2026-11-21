-- Pedido explícito del coordinador (8-nov-2026): el profesor no se enteraba
-- cuando Dirección Académica aprobaba o rechazaba su material -- ya había
-- fix de UI (etiqueta en unidades-docente), faltaba avisarle de verdad.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check check (
  type = any (array[
    'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible',
    'profesor_pendiente','material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio',
    'notas_registradas','recordatorio_pago','recordatorio_notas','duda_nueva','duda_respondida',
    'tarea_nueva','tarea_calificada','material_aprobado','material_rechazado'
  ])
);

create or replace function public.fn_notify_material_revisado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_unit_id uuid;
begin
  if new.approval_status is distinct from old.approval_status
     and new.approval_status in ('aprobado', 'rechazado')
     and new.uploaded_by is not null then
    select ui.unit_id into v_unit_id
      from public.unit_items ui
     where ui.content_item_id = new.id
     limit 1;

    insert into public.notifications (profile_id, type, title, body, payload, channel)
    values (
      new.uploaded_by,
      case when new.approval_status = 'aprobado' then 'material_aprobado' else 'material_rechazado' end,
      case when new.approval_status = 'aprobado'
        then 'Aprobaron tu material: ' || new.title
        else 'Rechazaron tu material: ' || new.title
      end,
      case when new.approval_status = 'aprobado'
        then 'Ya lo ven tus estudiantes.'
        else coalesce(nullif(trim(new.review_message), ''), 'Entra a la unidad para ver el motivo.')
      end,
      jsonb_build_object('content_item_id', new.id, 'unit_id', v_unit_id),
      'push'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_material_revisado on public.content_items;
create trigger trg_notify_material_revisado
  after update on public.content_items
  for each row execute function public.fn_notify_material_revisado();

revoke execute on function public.fn_notify_material_revisado() from anon, authenticated;
