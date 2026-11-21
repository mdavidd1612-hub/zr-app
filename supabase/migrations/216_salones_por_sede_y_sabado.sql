-- Salones (18-nov-2026): el super_admin crea los salones de cada sede; Direccion
-- Academica elige en que salon tiene clase cada cohorte cada sabado. Estudiante y
-- profesor lo ven. Si un sabado no tiene salon propio, se repite el ultimo
-- asignado (asi no hay que cargarlo semana por semana).

create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  sede_id    uuid not null references public.sedes(id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) > 0),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sede_id, nombre)
);

alter table public.rooms enable row level security;

create policy "todos: ver salones" on public.rooms for select to authenticated using (true);
create policy "super: gestionar salones" on public.rooms for all to authenticated
  using ((select public.is_super())) with check ((select public.is_super()));

create table public.cohort_room_days (
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  class_date date not null,
  room_id    uuid not null references public.rooms(id) on delete restrict,
  set_by     uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (cohort_id, class_date)
);

alter table public.cohort_room_days enable row level security;

create policy "personal y su cohorte: ver salon del dia" on public.cohort_room_days for select to authenticated
  using ((select public.is_staff()) or cohort_id = (select public.my_cohort_id()));
create policy "direccion: gestionar salon del dia" on public.cohort_room_days for all to authenticated
  using ((select public.is_academico()) or (select public.is_super()))
  with check ((select public.is_academico()) or (select public.is_super()));

-- Salon de una cohorte en una fecha: el de esa fecha, o el ultimo anterior.
create or replace function public.fn_salon_de_clase(p_cohort uuid, p_fecha date)
returns text language sql stable security invoker set search_path = public as $$
  select r.nombre
    from public.cohort_room_days d join public.rooms r on r.id = d.room_id
   where d.cohort_id = p_cohort and d.class_date <= p_fecha
   order by d.class_date desc limit 1;
$$;

revoke execute on function public.fn_salon_de_clase(uuid, date) from public, anon;
grant execute on function public.fn_salon_de_clase(uuid, date) to authenticated;
