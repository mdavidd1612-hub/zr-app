-- 241 · Cada corte ve solo sus unidades (decisión del coordinador, 20-nov-2026:
-- "son entornos diferentes").
--
-- Antes una unidad era del MÓDULO: todos los cortes que cursan ese módulo la veían, y la regla de
-- la migración 208 dejaba ver el material enlazado en cualquier unidad. Ahora:
--   * units.cohort_id: el corte dueño de la unidad. Vacío = general (todos los cortes del módulo),
--     para no romper las unidades que ya existen.
--   * El estudiante solo ve unidades de su corte o generales, y lo que cuelga de ellas
--     (elementos, tareas, dudas frecuentes, material enlazado).
--   * La compuerta por orden, los avisos de unidad abierta/tarea nueva/unidad desbloqueada y la
--     importación de plantillas respetan el corte.
-- Personal (profesor, Dirección, admin) sigue viendo todas; la pantalla filtra por el corte elegido.

alter table public.units
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade;
create index if not exists idx_units_cohort on public.units (cohort_id);

comment on column public.units.cohort_id is
  'Corte dueño de la unidad. NULL = general, la ven todos los cortes del módulo (migr. 241).';

-- ── Políticas del estudiante ────────────────────────────────────────────────

drop policy if exists "estudiante: leer unidades abiertas de su modulo" on public.units;
create policy "estudiante: leer unidades abiertas de su modulo" on public.units
  for select to authenticated
  using (
    module_id in (select public.mis_modulos_cursados())
    and (cohort_id is null or cohort_id = (select public.mi_cohorte_estudiante()))
    and public.unit_effective_status(open_at, close_at, manual_status) = any (array['abierta', 'cerrada'])
  );

drop policy if exists "estudiante: leer elementos visibles de su modulo" on public.unit_items;
create policy "estudiante: leer elementos visibles de su modulo" on public.unit_items
  for select to authenticated
  using (
    exists (
      select 1 from public.units u
      where u.id = unit_items.unit_id
        and u.module_id in (select public.mis_modulos_cursados())
        and (u.cohort_id is null or u.cohort_id = (select public.mi_cohorte_estudiante()))
        and public.unit_item_is_visible(unit_items.visible, unit_items.visible_from, unit_items.visible_until,
                                        u.open_at, u.close_at, u.manual_status)
        and public.unit_prerequisite_met(u.id, (select auth.uid()))
    )
  );

drop policy if exists "estudiante: leer tareas de su modulo" on public.assignments;
create policy "estudiante: leer tareas de su modulo" on public.assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.units u
      where u.id = assignments.unit_id
        and u.module_id in (select public.mis_modulos_cursados())
        and (u.cohort_id is null or u.cohort_id = (select public.mi_cohorte_estudiante()))
    )
  );

drop policy if exists "estudiante: leer dudas faq de su modulo" on public.doubts;
create policy "estudiante: leer dudas faq de su modulo" on public.doubts
  for select to authenticated
  using (
    is_faq = true and unit_id is not null
    and exists (
      select 1 from public.units u
      where u.id = doubts.unit_id
        and u.module_id = (select public.my_module_id())
        and (u.cohort_id is null or u.cohort_id = (select public.mi_cohorte_estudiante()))
    )
  );

-- Material: el de su corte, el general, o el enlazado en una unidad de su corte/general.
-- (Antes, migr. 208: enlazado en CUALQUIER unidad, de cualquier corte.)
drop policy if exists "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;
create policy "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items
  for select to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select public.mis_modulos_cursados())
    and (
      cohort_id is null
      or cohort_id = public.mi_cohorte_estudiante()
      or exists (
        select 1 from public.unit_items ui
        join public.units u on u.id = ui.unit_id
        where ui.content_item_id = content_items.id
          and (u.cohort_id is null or u.cohort_id = public.mi_cohorte_estudiante())
      )
    )
    and (select public.estudiante_solvente())
    and (unit_id is null or public.unit_prerequisite_met(unit_id, (select auth.uid())))
  );

-- ── Compuerta por orden: la unidad anterior es la anterior DE SU CORTE (o general) ──

create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select case
    when p_student_id is distinct from auth.uid() and not public.is_staff() then false
    when (select public.is_staff()) then true
    else coalesce((
      select case cur.gate_mode
        when 'none' then true
        when 'exam' then (
          cur.gate_exam_id is null
          or not exists (
            select 1 from public.exams ge
            where ge.id = cur.gate_exam_id and ge.status in ('habilitado', 'cerrado', 'calificado')
              and (ge.cohort_id is null
                   or ge.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id))
          )
          or exists (
            select 1
            from public.exam_attempts a
            join public.exams ge on ge.id = a.exam_id
            where a.exam_id = cur.gate_exam_id
              and a.student_id = p_student_id
              and a.status = 'calificado'
              and a.total_score >= ge.passing_score
          )
        )
        else (
          with prev as (
            select p2.id from public.units p2
             where p2.module_id = cur.module_id and p2.order_index < cur.order_index
               and (p2.cohort_id is null
                    or p2.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id))
             order by p2.order_index desc limit 1
          ), certs as (
            select e.id, e.cohort_id, e.passing_score
              from prev
              join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
              join public.exams e on e.id = ui.exam_id and e.kind = 'certificacion'
                                 and e.status in ('habilitado', 'cerrado', 'calificado')
          )
          select
            not exists (
              select 1 from certs c
               where c.cohort_id is null
                  or c.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id)
            )
            or exists (
              select 1 from certs c
              join public.exam_attempts a on a.exam_id = c.id
             where a.student_id = p_student_id
               and a.status = 'calificado'
               and a.total_score >= c.passing_score
            )
        )
      end
      from public.units cur
      where cur.id = p_unit_id
    ), true)
  end;
$function$;

-- ── Avisos: solo a los cortes que ven la unidad ─────────────────────────────

create or replace function public.fn_avisar_unidades_abiertas()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into notifications (profile_id, type, title, body, payload, channel)
  select s.id, 'unidad_abierta', 'Se abrió una unidad: ' || u.title,
         'Ya puedes entrar y ver el material, las tareas y los exámenes.',
         jsonb_build_object('unit_id', u.id), 'push'
    from units u
    join cohorts c on c.current_module_id = u.module_id and c.status = 'activa'
                  and (u.cohort_id is null or u.cohort_id = c.id)
    join students s on s.cohort_id = c.id
   where u.open_at is not null and u.open_at <= now() and u.open_at > now() - interval '2 days'
     and not exists (select 1 from notifications n where n.profile_id = s.id and n.type = 'unidad_abierta'
                        and n.payload->>'unit_id' = u.id::text);
end $function$;

create or replace function public.fn_notify_tarea_nueva()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_module_id uuid;
  v_cohort_id uuid;
begin
  select u.module_id, u.cohort_id into v_module_id, v_cohort_id from units u where u.id = new.unit_id;
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
       and c.status = 'activa'
       and (v_cohort_id is null or c.id = v_cohort_id);
  end if;
  return new;
end;
$function$;

create or replace function public.fn_notify_unidad_desbloqueada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ex record; v_unit record; v_next record; v_cohorte uuid;
begin
  if new.status = 'calificado' and old.status is distinct from 'calificado' then
    select e.passing_score, e.kind, e.unit_id into v_ex from exams e where e.id = new.exam_id;
    if v_ex.kind::text = 'certificacion' and new.total_score >= v_ex.passing_score then
      select s.cohort_id into v_cohorte from students s where s.id = new.student_id;
      select u.id, u.title into v_next from units u
       where u.gate_exam_id = new.exam_id and (u.cohort_id is null or u.cohort_id = v_cohorte) limit 1;
      if v_next.id is null and v_ex.unit_id is not null then
        select module_id, order_index into v_unit from units where id = v_ex.unit_id;
        select u.id, u.title into v_next from units u
         where u.module_id = v_unit.module_id and u.order_index > v_unit.order_index and u.gate_mode = 'auto'
           and (u.cohort_id is null or u.cohort_id = v_cohorte)
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
end $function$;

-- ── Plantillas: la unidad importada queda en el corte elegido ───────────────
-- (Mismo cuerpo de la 207; solo se agrega cohort_id al crear la unidad.)
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.fn_importar_plantilla_unidad(uuid, uuid, uuid)'::regprocedure);
  if position('insert into public.units (module_id, title, order_index, created_by,' in v_def) = 0 then
    raise exception '241: no encontré el insert esperado en fn_importar_plantilla_unidad';
  end if;
  v_def := replace(v_def,
    'insert into public.units (module_id, title, order_index, created_by,',
    'insert into public.units (module_id, cohort_id, title, order_index, created_by,');
  v_def := replace(v_def,
    'values (p_module, v_t.payload->>''title'', v_orden, auth.uid(),',
    'values (p_module, p_cohort, v_t.payload->>''title'', v_orden, auth.uid(),');
  if position('values (p_module, p_cohort,' in v_def) = 0 then
    raise exception '241: no encontré el values esperado en fn_importar_plantilla_unidad';
  end if;
  execute v_def;
end $$;

-- ── Vista del recorrido del estudiante: expone el corte (la vista de recorrido del personal filtra
-- por él; el estudiante ya queda filtrado por la política de units, la vista es security_invoker).
create or replace view public.v_units_status with (security_invoker = true) as
 select id, module_id, title, order_index, open_at, close_at, manual_status, prerequisite_unit_id,
        created_by, created_at, updated_at,
        unit_effective_status(open_at, close_at, manual_status) as effective_status,
        unit_prerequisite_met(id, auth.uid()) as prerequisite_met,
        cohort_id
   from units u;
