-- =============================================================================
-- ZR APP · MIGRACIÓN 068 · Catálogo de sedes
-- =============================================================================
-- Cierra R-20 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md.
--
-- `cohorts.sede` sigue siendo texto libre a propósito — convertirlo en FK
-- ahora mismo obligaría a tocar cada pantalla que ya lo lee/escribe como
-- texto (carga-ventas, programas, cohortes, EtiquetaSede) por un beneficio
-- chico mientras solo hay dos sedes reales. Lo que sí hacía falta, y es lo
-- que pidió el plan, es que las pantallas dejen de inventar la lista de
-- sedes contando qué texto usaron las cohortes que ya existen (si nadie
-- había creado una cohorte en una sede nueva, esa sede no aparecía en
-- ninguna parte para poder escribirla bien la primera vez). Ahora hay un
-- lugar único donde se declara "esta sede existe", independiente de si ya
-- tiene cohortes o no.
-- =============================================================================

create table public.sedes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.sedes is
  'Catálogo de sedes donde se dictan cohortes (R-20). cohorts.sede sigue siendo texto libre a propósito — esta tabla es la fuente de las OPCIONES que ofrecen las pantallas, no una FK.';

alter table public.sedes enable row level security;

create policy "todos: leer sedes activas"
  on public.sedes for select to authenticated
  using (activa or (select public.is_super()));

create policy "super: gestionar sedes"
  on public.sedes for all to authenticated
  using ((select public.is_super()))
  with check ((select public.is_super()));

insert into public.sedes (nombre) values ('La Morita'), ('UCV');
