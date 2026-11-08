-- Reunión 7-nov-2026 sobre Unidades: fixes de RLS, borrado huérfano, tonos de banner y notificaciones faltantes.

-- 1) El profesor (no solo dirección/admin) no podía subir/editar/borrar el banner de su propia unidad.
--    Las políticas de storage del bucket banners-unidad usaban is_academico()/is_admin_up(),
--    que excluyen 'profesor'. units ya usa is_staff() para todo (ALL) -- se alinea el bucket.
drop policy if exists "banners-unidad: subir" on storage.objects;
drop policy if exists "banners-unidad: actualizar" on storage.objects;
drop policy if exists "banners-unidad: borrar" on storage.objects;

create policy "banners-unidad: subir" on storage.objects
  for insert with check (bucket_id = 'banners-unidad' and is_staff());

create policy "banners-unidad: actualizar" on storage.objects
  for update using (bucket_id = 'banners-unidad' and is_staff())
  with check (bucket_id = 'banners-unidad' and is_staff());

create policy "banners-unidad: borrar" on storage.objects
  for delete using (bucket_id = 'banners-unidad' and is_staff());

-- 2) Más tonalidades por color de banner (pedido: 3 tonos por color, no solo uno).
alter table units drop constraint units_banner_color_check;
alter table units add constraint units_banner_color_check check (
  banner_color is null or banner_color = any (array[
    'azul_claro','azul','azul_oscuro',
    'verde_claro','verde','verde_oscuro',
    'morado_claro','morado','morado_oscuro',
    'grafito_claro','grafito','grafito_oscuro',
    'vino_claro','vino','vino_oscuro'
  ])
);

-- 3) Borrar un examen/tarea desde su constructor dejaba "huérfana" su fila en
--    manual_exam_definitions (source_exam_id/source_assignment_id -> null por el ON DELETE
--    SET NULL de la FK), ocupando % de la nota del módulo para siempre sin que nadie la viera
--    ya en Unidades. Si nunca se calificó (no hay fila en manual_exam_scores), se borra entera;
--    si ya tiene una nota real puesta, se deja intacta (nunca se borra una nota real).
create or replace function fn_limpiar_definicion_huerfana_examen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from manual_exam_definitions d
   where d.source_exam_id = old.id
     and not exists (select 1 from manual_exam_scores s where s.definition_id = d.id);
  return old;
end;
$$;

create or replace function fn_limpiar_definicion_huerfana_tarea()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from manual_exam_definitions d
   where d.source_assignment_id = old.id
     and not exists (select 1 from manual_exam_scores s where s.definition_id = d.id);
  return old;
end;
$$;

drop trigger if exists trg_limpiar_definicion_huerfana_examen on exams;
create trigger trg_limpiar_definicion_huerfana_examen
  before delete on exams
  for each row execute function fn_limpiar_definicion_huerfana_examen();

drop trigger if exists trg_limpiar_definicion_huerfana_tarea on assignments;
create trigger trg_limpiar_definicion_huerfana_tarea
  before delete on assignments
  for each row execute function fn_limpiar_definicion_huerfana_tarea();

-- 4) Notificación push/in-app faltante: tarea nueva agregada a una unidad (mismo patrón que
--    fn_notify_material_nuevo, migración 106).
create or replace function fn_notify_tarea_nueva()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_module_id uuid;
begin
  select u.module_id into v_module_id from units u where u.id = new.unit_id;
  if v_module_id is not null then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'tarea_nueva',
           'Nueva tarea: ' || new.title,
           'Tu profesor asignó una tarea nueva. Entra a la app para verla.',
           jsonb_build_object('assignment_id', new.id, 'unit_id', new.unit_id),
           'push'
      from public.students s
      join public.cohorts c on c.id = s.cohort_id
     where c.current_module_id = v_module_id
       and c.status = 'activa';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_tarea_nueva on assignments;
create trigger trg_notify_tarea_nueva
  after insert on assignments
  for each row execute function fn_notify_tarea_nueva();

-- 5) Notificación push/in-app faltante: tarea calificada (mismo patrón que fn_notify_attempt_graded,
--    migración 149, pero para submissions en vez de exam_attempts).
create or replace function fn_notify_tarea_calificada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_title text;
begin
  if new.grade is not null and old.grade is distinct from new.grade then
    select a.title into v_title from assignments a where a.id = new.assignment_id;
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    values (
      new.student_id,
      'tarea_calificada',
      'Calificaron tu tarea: ' || coalesce(v_title, ''),
      'Tu tarea fue calificada con ' || to_char(new.grade, 'FM999999990.00') || '. Entra a la app para verla.',
      jsonb_build_object('submission_id', new.id, 'assignment_id', new.assignment_id, 'grade', new.grade),
      'push'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_tarea_calificada on submissions;
create trigger trg_notify_tarea_calificada
  after update of grade on submissions
  for each row execute function fn_notify_tarea_calificada();

-- 6) Mismo patrón de advisory ya documentado en §8.8/§8.10: SECURITY DEFINER
--    expuesto por PostgREST vía RPC a anon/authenticated -- no es explotable
--    (son triggers, nunca se llaman así), pero se revoca igual.
revoke execute on function fn_limpiar_definicion_huerfana_examen() from anon, authenticated;
revoke execute on function fn_limpiar_definicion_huerfana_tarea() from anon, authenticated;
revoke execute on function fn_notify_tarea_nueva() from anon, authenticated;
revoke execute on function fn_notify_tarea_calificada() from anon, authenticated;
