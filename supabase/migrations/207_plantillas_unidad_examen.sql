-- Reunión del 14-nov-2026: plantillas del profesor.
--  * unit_templates: "Guardar plantilla" de una unidad (con todo su contenido) y
--    "Agregar unidad ya creada" en otro programa/módulo. Solo la ve su dueño.
--  * exam_templates: cada examen que el profesor guarda (borrador o publicado)
--    queda como plantilla suya para reutilizarlo ("Usar examen ya creado").

create table public.unit_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index unit_templates_owner_idx on public.unit_templates (owner_id, created_at desc);
alter table public.unit_templates enable row level security;
create policy "dueño: plantillas de unidad"
  on public.unit_templates for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table public.exam_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exam_templates_owner_title_idx on public.exam_templates (owner_id, lower(title));
alter table public.exam_templates enable row level security;
create policy "dueño: plantillas de examen"
  on public.exam_templates for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Guardar: foto de la unidad y de todo lo que lleva dentro.
create or replace function public.fn_guardar_plantilla_unidad(p_unit uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_u       public.units%rowtype;
  v_payload jsonb;
  v_id      uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Solo el personal docente puede guardar plantillas.';
  end if;
  select * into v_u from public.units where id = p_unit;
  if not found then
    raise exception 'La unidad no existe.';
  end if;

  select jsonb_build_object(
    'title', v_u.title,
    'banner_image_path', v_u.banner_image_path,
    'banner_color', v_u.banner_color,
    'banner_image_position', v_u.banner_image_position,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', ui.type,
          'required', ui.required,
          'content', case when ci.id is not null then
            to_jsonb(ci) - array['id','module_id','cohort_id','unit_id','uploaded_by','reviewed_by',
                                 'created_at','updated_at','folder_id','learning_guide_id','check_quiz_id']
          end,
          'exam', case when e.id is not null then
            (to_jsonb(e) - array['id','module_id','cohort_id','teacher_id','unit_id','published_by',
                                 'published_at','created_at','updated_at'])
            || jsonb_build_object('questions', coalesce((
                 select jsonb_agg(to_jsonb(q) - array['id','exam_id','learning_guide_id','created_at'] order by q.order_index)
                 from public.exam_questions q where q.exam_id = e.id), '[]'::jsonb))
          end,
          'assignment', case when a.id is not null then
            to_jsonb(a) - array['id','unit_id','created_by','created_at','updated_at']
          end
        ) order by ui.order_index)
      from public.unit_items ui
      left join public.content_items ci on ci.id = ui.content_item_id
      left join public.exams e on e.id = ui.exam_id
      left join public.assignments a on a.id = ui.assignment_id
      where ui.unit_id = p_unit
    ), '[]'::jsonb)
  ) into v_payload;

  insert into public.unit_templates (owner_id, title, payload)
  values (auth.uid(), v_u.title, v_payload)
  returning id into v_id;
  return v_id;
end;
$$;

-- Importar: crea una unidad nueva en el módulo/cohorte elegidos con copia de todo.
-- Los exámenes llegan ocultos y las tareas con 0 % (el profesor los publica y
-- les pone su % en el módulo nuevo, así nunca se pasa del 100 %).
create or replace function public.fn_importar_plantilla_unidad(p_template uuid, p_module uuid, p_cohort uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t       public.unit_templates%rowtype;
  v_unit    uuid;
  v_orden   int;
  v_item    jsonb;
  v_n       int := 0;
  v_ci      public.content_items;
  v_ex      public.exams;
  v_as      public.assignments;
  v_q       jsonb;
  v_qr      public.exam_questions;
  v_ci_id   uuid;
  v_ex_id   uuid;
  v_as_id   uuid;
begin
  select * into v_t from public.unit_templates where id = p_template and owner_id = auth.uid();
  if not found then
    raise exception 'No encontré esa plantilla en tu cuenta.';
  end if;
  if not ((select public.is_academico()) or (select public.is_admin_up()) or public.profesor_dicta(p_cohort, p_module)) then
    raise exception 'No puedes agregar contenido a este módulo.';
  end if;

  select coalesce(max(order_index), 0) + 1 into v_orden from public.units where module_id = p_module;
  insert into public.units (module_id, title, order_index, created_by, banner_image_path, banner_color, banner_image_position)
  values (p_module, v_t.payload->>'title', v_orden, auth.uid(),
          v_t.payload->>'banner_image_path', v_t.payload->>'banner_color',
          nullif(v_t.payload->>'banner_image_position', '')::smallint)
  returning id into v_unit;

  for v_item in select value from jsonb_array_elements(v_t.payload->'items') loop
    v_n := v_n + 1;
    v_ci_id := null; v_ex_id := null; v_as_id := null;

    if v_item->'content' is not null and jsonb_typeof(v_item->'content') = 'object' then
      v_ci := jsonb_populate_record(null::public.content_items, v_item->'content');
      v_ci.id := gen_random_uuid();
      v_ci.module_id := p_module;
      v_ci.cohort_id := p_cohort;
      v_ci.unit_id := null;
      v_ci.uploaded_by := auth.uid();
      v_ci.created_at := now();
      v_ci.updated_at := now();
      insert into public.content_items select v_ci.*;
      v_ci_id := v_ci.id;
    end if;

    if v_item->'exam' is not null and jsonb_typeof(v_item->'exam') = 'object' then
      v_ex := jsonb_populate_record(null::public.exams, v_item->'exam');
      v_ex.id := gen_random_uuid();
      v_ex.module_id := p_module;
      v_ex.cohort_id := p_cohort;
      v_ex.teacher_id := auth.uid();
      v_ex.unit_id := v_unit;
      v_ex.status := 'oculto';
      v_ex.published_by := null;
      v_ex.published_at := null;
      v_ex.weight := 0;
      v_ex.created_at := now();
      v_ex.updated_at := now();
      insert into public.exams select v_ex.*;
      v_ex_id := v_ex.id;
      for v_q in select value from jsonb_array_elements(coalesce(v_item->'exam'->'questions', '[]'::jsonb)) loop
        v_qr := jsonb_populate_record(null::public.exam_questions, v_q);
        v_qr.id := gen_random_uuid();
        v_qr.exam_id := v_ex_id;
        v_qr.created_at := now();
        insert into public.exam_questions select v_qr.*;
      end loop;
    end if;

    if v_item->'assignment' is not null and jsonb_typeof(v_item->'assignment') = 'object' then
      v_as := jsonb_populate_record(null::public.assignments, v_item->'assignment');
      v_as.id := gen_random_uuid();
      v_as.unit_id := v_unit;
      v_as.created_by := auth.uid();
      v_as.weight := 0;
      v_as.created_at := now();
      v_as.updated_at := now();
      insert into public.assignments select v_as.*;
      v_as_id := v_as.id;
    end if;

    insert into public.unit_items (unit_id, type, order_index, content_item_id, exam_id, assignment_id, required)
    values (v_unit, (v_item->>'type')::public.unit_item_type, v_n, v_ci_id, v_ex_id, v_as_id,
            coalesce((v_item->>'required')::boolean, false));
  end loop;

  return v_unit;
end;
$$;

revoke all on function public.fn_guardar_plantilla_unidad(uuid) from public, anon;
revoke all on function public.fn_importar_plantilla_unidad(uuid, uuid, uuid) from public, anon;
grant execute on function public.fn_guardar_plantilla_unidad(uuid) to authenticated;
grant execute on function public.fn_importar_plantilla_unidad(uuid, uuid, uuid) to authenticated;
