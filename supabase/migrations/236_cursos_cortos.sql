-- 236 · Cursos cortos (20-nov-2026, decisión del coordinador: "tipo nuevo: curso").
-- Cursos sueltos (motos, pintura...) que no son un programa con módulos.
-- Por ahora solo para planificar: salen en Calendario general → Planificación.
create table if not exists public.short_courses (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  sede text,
  turno text,
  start_date date not null,
  end_date date not null,
  teacher_name text,
  class_weekdays smallint[] default '{6}',
  class_start time,
  class_end time,
  notas text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table public.short_courses enable row level security;
create policy "staff ve cursos cortos" on public.short_courses for select to authenticated using (public.is_staff());
create policy "direccion gestiona cursos cortos" on public.short_courses for all to authenticated
  using (public.is_academico()) with check (public.is_academico());
create index if not exists short_courses_fechas on public.short_courses (start_date, end_date);
create index if not exists short_courses_created_by on public.short_courses (created_by);
