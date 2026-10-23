-- =============================================================================
-- ZR APP · MIGRACIÓN 178 · Aula Virtual — Fase 5: tareas
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §8. Aquí se cierra el enganche que la 174 dejó
-- pendiente a propósito: unit_items.assignment_id no tenía FK porque
-- assignments no existía todavía.
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values
  ('aula.tarea_max_mb', '10', 'Tamaño máximo en MB de una entrega de tarea (spec/07_AULA_VIRTUAL.md §8).', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 1. assignments
-- -----------------------------------------------------------------------------
create table public.assignments (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  title      text not null,
  instructions text,
  due_at     timestamptz,
  max_mb     int not null default 10 check (max_mb > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assignments_unit on public.assignments (unit_id);

create trigger trg_assignments_updated
  before update on public.assignments
  for each row execute function public.set_updated_at();

create trigger trg_assignments_audit
  after insert or update or delete on public.assignments
  for each row execute function public.fn_audit();

-- Ahora sí se puede cerrar la FK pendiente de la 174.
alter table public.unit_items
  add constraint fk_unit_items_assignment foreign key (assignment_id) references public.assignments(id) on delete cascade;

-- -----------------------------------------------------------------------------
-- 2. submissions
-- -----------------------------------------------------------------------------
-- spec §8: se permite reemplazar la entrega hasta la fecha límite, con
-- historial de versiones (nunca se pisa ni se borra una entrega vieja).
-- "Estados: pendiente, entregada, tardía, calificada" -- 'pendiente' es la
-- AUSENCIA de fila (nadie entrega una tarea "pendiente", la entrega existe
-- o no existe todavía), así que no es una columna; entregada/tardía/
-- calificada sí se calculan de las columnas (ver v_assignment_status).
--
-- mime_type: spec §8 pide "validar el tipo real del archivo, no solo la
-- extensión" -- eso significa leer los primeros bytes del archivo (firma
-- %PDF-), algo que solo se puede hacer donde se recibe el archivo (una
-- Edge Function), nunca en SQL ni en el navegador. Esta columna es la
-- prueba de que esa validación de verdad ocurrió: la Edge Function de
-- subida debe escribir aquí el tipo que ENCONTRÓ en los bytes, no el que el
-- cliente dijo que era, y el check de abajo solo acepta 'application/pdf'.
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  file_path     text not null,
  mime_type     text not null check (mime_type = 'application/pdf'),
  size_bytes    bigint not null check (size_bytes > 0),
  version       int not null default 1,
  submitted_at  timestamptz not null default now(),
  grade         numeric(5,2),
  feedback      text,
  graded_by     uuid references public.teachers(id),
  graded_at     timestamptz,
  unique (assignment_id, student_id, version)
);

create index idx_submissions_assignment on public.submissions (assignment_id);
create index idx_submissions_student on public.submissions (student_id);

-- -----------------------------------------------------------------------------
-- 3. Reenvío solo antes de la fecha límite; la primera entrega siempre se
--    acepta (tardía si hace falta, pero se acepta -- spec no bloquea la
--    primera entrega por atraso, solo las versiones de reemplazo)
-- -----------------------------------------------------------------------------
create or replace function public.fn_submission_prepare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due   timestamptz;
  v_count int;
begin
  select due_at into v_due from public.assignments where id = new.assignment_id;

  select count(*) into v_count
  from public.submissions
  where assignment_id = new.assignment_id and student_id = new.student_id;

  if v_count > 0 and v_due is not null and now() > v_due then
    raise exception 'Ya pasó la fecha límite -- no puedes reemplazar tu entrega.';
  end if;

  new.version := v_count + 1;
  return new;
end;
$$;

create trigger trg_submission_prepare
  before insert on public.submissions
  for each row execute function public.fn_submission_prepare();

-- -----------------------------------------------------------------------------
-- 4. Vista del profesor (spec §8): cédula, nombre, módulo, programa, unidad,
--    fecha y hora de entrega, estado -- de la entrega más reciente de cada
--    estudiante, no de todas las versiones.
-- -----------------------------------------------------------------------------
create or replace view public.v_assignment_status
with (security_invoker = true)
as
select
  a.id as assignment_id,
  a.title as assignment_title,
  a.due_at,
  s.id as student_id,
  p.cedula,
  p.full_name,
  pr.name as program_name,
  m.name as module_name,
  u.title as unit_title,
  sub.id as submission_id,
  sub.file_path,
  sub.submitted_at,
  sub.grade,
  case
    when sub.id is null then 'pendiente'
    when sub.grade is not null then 'calificada'
    when a.due_at is not null and sub.submitted_at > a.due_at then 'tardia'
    else 'entregada'
  end as status
from public.assignments a
join public.units u on u.id = a.unit_id
join public.modules m on m.id = u.module_id
join public.programs pr on pr.id = m.program_id
join public.cohorts c on c.current_module_id = m.id
join public.students s on s.cohort_id = c.id
join public.profiles p on p.id = s.id
left join lateral (
  select * from public.submissions
  where assignment_id = a.id and student_id = s.id
  order by version desc
  limit 1
) sub on true;

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "estudiante: leer tareas de su modulo"
  on public.assignments for select to authenticated
  using (
    exists (
      select 1 from public.units u
      where u.id = unit_id and u.module_id = (select public.my_module_id())
    )
  );

create policy "personal: leer tareas"
  on public.assignments for select to authenticated
  using ((select public.is_staff()));

create policy "personal: escribir tareas"
  on public.assignments for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "estudiante: leer sus entregas"
  on public.submissions for select to authenticated
  using (student_id = auth.uid());

create policy "estudiante: entregar su tarea"
  on public.submissions for insert to authenticated
  with check (student_id = auth.uid());

create policy "personal: leer entregas"
  on public.submissions for select to authenticated
  using ((select public.is_staff()));

create policy "personal: calificar entregas"
  on public.submissions for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- -----------------------------------------------------------------------------
-- 6. Bucket de almacenamiento
-- -----------------------------------------------------------------------------
-- Mismo patrón que 'contenido'/'consentimientos' (015): privado, carpeta por
-- estudiante (auth.uid()/...), personal lee todo.
insert into storage.buckets (id, name, public)
values ('tareas', 'Entregas de tareas', false)
on conflict (id) do nothing;

create policy "estudiante: sube su entrega"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tareas'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "estudiante: lee su entrega"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tareas'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "personal: lee todas las entregas"
  on storage.objects for select to authenticated
  using (bucket_id = 'tareas' and (select public.is_staff()));

-- Sin policy de delete: igual que consentimientos, ninguna entrega se borra
-- (historial de versiones, spec §8).
