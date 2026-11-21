-- Notificaciones que faltaban (auditoria del 17-nov-2026): cada accion importante
-- avisa a quien le toca, por la campanita y por push (channel = 'push', lo envia
-- send-push cada 5 min). Mismo patron que fn_notify_tarea_nueva (migr. 199).
--
--   tarea_entregada      estudiante entrega una tarea         -> profesor de la tarea
--   material_por_aprobar profesor sube material nuevo         -> Direccion Academica y Administracion
--   unidad_desbloqueada  estudiante aprueba la certificacion  -> ese estudiante
--   unidad_abierta       llega la fecha de apertura           -> estudiantes del modulo
--   recordatorio_entrega examen/tarea en las proximas 24 h    -> estudiantes del modulo que no han entregado

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'examen_habilitado','nota_publicada','consentimiento_pendiente','feedback_disponible','profesor_pendiente',
  'material_nuevo','modulo_cambiado','hora_clase','hora_refrigerio','notas_registradas','recordatorio_pago',
  'recordatorio_notas','duda_nueva','duda_respondida','tarea_nueva','tarea_calificada','material_aprobado',
  'material_rechazado','examen_por_corregir',
  'tarea_entregada','material_por_aprobar','unidad_desbloqueada','unidad_abierta','recordatorio_entrega'
]::text[]));

-- 1. Entrega de tarea -> profesor
create or replace function public.fn_notify_tarea_entregada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_a record; v_nombre text;
begin
  select a.title, a.unit_id, a.created_by into v_a from assignments a where a.id = new.assignment_id;
  if v_a.created_by is null then return new; end if;
  select full_name into v_nombre from profiles where id = new.student_id;
  insert into notifications (profile_id, type, title, body, payload, channel)
  values (v_a.created_by, 'tarea_entregada', 'Nueva entrega: ' || coalesce(v_a.title, ''),
          coalesce(v_nombre, 'Un estudiante') || ' entregó su tarea y espera tu calificación.',
          jsonb_build_object('assignment_id', new.assignment_id, 'unit_id', v_a.unit_id, 'submission_id', new.id), 'push');
  return new;
end $$;
drop trigger if exists trg_notify_tarea_entregada on public.submissions;
create trigger trg_notify_tarea_entregada after insert on public.submissions
  for each row execute function public.fn_notify_tarea_entregada();

-- 2. Material nuevo pendiente de revision -> Direccion y Administracion
create or replace function public.fn_notify_material_por_aprobar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approval_status = 'pendiente' and new.type::text <> 'texto' then
    insert into notifications (profile_id, type, title, body, payload, channel)
    select p.id, 'material_por_aprobar', 'Material por aprobar: ' || coalesce(new.title, ''),
           'Un profesor subió material nuevo que espera tu revisión.',
           jsonb_build_object('content_item_id', new.id, 'module_id', new.module_id), 'push'
      from profiles p
     where p.role in ('direccion_academica', 'admin') and p.id is distinct from new.uploaded_by;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_material_por_aprobar on public.content_items;
create trigger trg_notify_material_por_aprobar after insert on public.content_items
  for each row execute function public.fn_notify_material_por_aprobar();

-- 3. Certificacion aprobada -> se abre la unidad siguiente
create or replace function public.fn_notify_unidad_desbloqueada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ex record; v_unit record; v_next record;
begin
  if new.status = 'calificado' and old.status is distinct from 'calificado' then
    select e.passing_score, e.kind, e.unit_id into v_ex from exams e where e.id = new.exam_id;
    if v_ex.kind::text = 'certificacion' and new.total_score >= v_ex.passing_score then
      -- unidad que depende de este examen, o la siguiente en orden
      select u.id, u.title into v_next from units u where u.gate_exam_id = new.exam_id limit 1;
      if v_next.id is null and v_ex.unit_id is not null then
        select module_id, order_index into v_unit from units where id = v_ex.unit_id;
        select u.id, u.title into v_next from units u
         where u.module_id = v_unit.module_id and u.order_index > v_unit.order_index and u.gate_mode = 'auto'
         order by u.order_index limit 1;
      end if;
      if v_next.id is not null and not exists (
        select 1 from notifications n where n.profile_id = new.student_id and n.type = 'unidad_desbloqueada'
           and n.payload->>'unit_id' = v_next.id::text) then
        insert into notifications (profile_id, type, title, body, payload, channel)
        values (new.student_id, 'unidad_desbloqueada', '¡Aprobaste! Se abrió: ' || v_next.title,
                'Pasaste la certificación y ya puedes entrar a la siguiente unidad.',
                jsonb_build_object('unit_id', v_next.id), 'push');
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_unidad_desbloqueada on public.exam_attempts;
create trigger trg_notify_unidad_desbloqueada after update on public.exam_attempts
  for each row execute function public.fn_notify_unidad_desbloqueada();

-- 4. Unidad que llega a su fecha de apertura -> estudiantes del modulo (cron)
create or replace function public.fn_avisar_unidades_abiertas()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, type, title, body, payload, channel)
  select s.id, 'unidad_abierta', 'Se abrió una unidad: ' || u.title,
         'Ya puedes entrar y ver el material, las tareas y los exámenes.',
         jsonb_build_object('unit_id', u.id), 'push'
    from units u
    join cohorts c on c.current_module_id = u.module_id and c.status = 'activa'
    join students s on s.cohort_id = c.id
   where u.open_at is not null and u.open_at <= now() and u.open_at > now() - interval '2 days'
     and not exists (select 1 from notifications n where n.profile_id = s.id and n.type = 'unidad_abierta'
                        and n.payload->>'unit_id' = u.id::text);
end $$;

-- 5. Examen/tarea en las proximas 24 h -> quien no ha entregado (cron)
create or replace function public.fn_recordar_entregas()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, type, title, body, payload, channel)
  select s.id, 'recordatorio_entrega',
         case when ev.source_type = 'exam' then 'Mañana tienes un examen: ' else 'Mañana vence una tarea: ' end || ev.title,
         'No lo dejes para última hora. Entra a tu calendario para ver los detalles.',
         jsonb_build_object('event_id', ev.id), 'push'
    from calendar_events ev
    join cohorts c on c.current_module_id = ev.module_id and c.status = 'activa'
    join students s on s.cohort_id = c.id
   where ev.source_type in ('exam', 'assignment')
     and ev.event_at > now() and ev.event_at <= now() + interval '24 hours'
     and not exists (select 1 from notifications n where n.profile_id = s.id and n.type = 'recordatorio_entrega'
                        and n.payload->>'event_id' = ev.id::text)
     and not exists (select 1 from submissions sb where ev.source_type = 'assignment' and sb.assignment_id = ev.source_id and sb.student_id = s.id)
     and not exists (select 1 from exam_attempts a where ev.source_type = 'exam' and a.exam_id = ev.source_id and a.student_id = s.id and a.status <> 'abandonado');
end $$;

select cron.schedule('unidades-abiertas-cada-10-min', '*/10 * * * *', 'select public.fn_avisar_unidades_abiertas();');
select cron.schedule('recordar-entregas-cada-hora', '0 * * * *', 'select public.fn_recordar_entregas();');

-- Solo el servidor las ejecuta (cron/triggers); no se exponen como RPC.
revoke execute on function public.fn_avisar_unidades_abiertas() from anon, authenticated, public;
revoke execute on function public.fn_recordar_entregas() from anon, authenticated, public;
