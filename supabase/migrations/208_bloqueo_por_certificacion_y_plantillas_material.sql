-- 208 · Bloqueo de una unidad por una certificación elegida + plantillas de material
-- (pedido del coordinador, 16-nov-2026).
--
-- Antes (migración 185): una unidad se bloqueaba SOLO por la certificación de
-- la unidad inmediatamente anterior. Ahora, al crear una unidad (o después, al
-- editarla) el profesor elige de cuál certificación depende, o ninguna:
--   gate_mode = 'auto'  (por defecto, lo que ya había): por orden, como en 185
--   gate_mode = 'exam'  depende de la certificación gate_exam_id
--   gate_mode = 'none'  se abre libre (solo cuenta la fecha de apertura)
-- El bloqueo por FECHA (open_at) es aparte y sigue aplicando siempre: para ver
-- una unidad hay que cumplir los dos.

alter table public.units
  add column if not exists gate_mode text not null default 'auto'
    check (gate_mode in ('auto', 'exam', 'none')),
  add column if not exists gate_exam_id uuid references public.exams(id) on delete set null;

create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_student_id is distinct from auth.uid() and not public.is_staff() then false
    when (select public.is_staff()) then true   -- el profesor/dirección nunca ve bloqueo
    else coalesce((
      select case cur.gate_mode
        when 'none' then true
        when 'exam' then (
          cur.gate_exam_id is null
          or not exists (
            select 1 from public.exams ge
            where ge.id = cur.gate_exam_id and ge.status in ('habilitado', 'cerrado', 'calificado')
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
        else not exists (
          select 1
          from public.units prev
          join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
          join public.exams e
            on e.id = ui.exam_id
           and e.kind = 'certificacion'
           and e.status in ('habilitado', 'cerrado', 'calificado')
          where prev.module_id = cur.module_id
            and prev.order_index = cur.order_index - 1
            and not exists (
              select 1 from public.exam_attempts a
              where a.exam_id = e.id
                and a.student_id = p_student_id
                and a.status = 'calificado'
                and a.total_score >= e.passing_score
            )
        )
      end
      from public.units cur
      where cur.id = p_unit_id
    ), true)
  end;
$$;

comment on function public.unit_prerequisite_met is
  'Compuerta (migración 208): por orden (auto), por una certificación elegida (exam) o libre (none). El personal nunca ve bloqueo.';

-- Plantillas de material: título, descripción y si es obligatorio, para crear
-- otros materiales parecidos sin volver a escribirlo todo. Cada profesor ve
-- solo las suyas.
create table if not exists public.material_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_templates enable row level security;

create policy "dueño: ver sus plantillas de material"
  on public.material_templates for select to authenticated
  using (owner_id = auth.uid());
create policy "personal: crear plantillas de material"
  on public.material_templates for insert to authenticated
  with check (owner_id = auth.uid() and public.is_staff());
create policy "dueño: editar sus plantillas de material"
  on public.material_templates for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dueño: borrar sus plantillas de material"
  on public.material_templates for delete to authenticated
  using (owner_id = auth.uid());
