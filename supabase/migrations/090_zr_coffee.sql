-- =============================================================================
-- ZR APP · MIGRACIÓN 090 · ZR Coffee (inventario y ventas de la cantina)
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026), a partir de las
-- especificaciones que dio administradora Cecilia por audio: la cantina de
-- la academia vende bebidas, snacks y dulces. Necesita un inventario digital
-- (producto, cantidad, costo, margen del 30%, precio de venta) y un registro
-- de ventas diarias que vaya descontando existencias, en vez de la hoja de
-- papel que usan hoy.
--
-- NO es lo mismo que "Contabilidad del fondo de refrigerios", prohibido en
-- Fase 1 (AGENTS.md §7): eso es dinero relacionado con el estudiante
-- (financiamiento, cuotas). Esto es una herramienta interna de
-- administración para su propio negocio de cantina -- no toca ninguna tabla
-- de estudiantes, notas ni inscripción. Confirmado explícitamente con el
-- coordinador antes de construirlo.
--
-- Visibilidad: SOLO la cuenta de Cecilia, no todo el rol `admin` -- pedido
-- explícito ("ninguna otra administración puede ver esto"). Los roles de la
-- app siempre fueron por ROL, nunca por cuenta individual; esta es la
-- primera vez que hace falta eso, así que se resuelve con una lista de
-- gestores (`zr_coffee_managers`) en vez de forzar el modelo de roles a
-- soportar excepciones de una sola persona.
--
-- Moneda: costo y precio de venta se guardan en USD (estable frente a la
-- inflación). La tasa del día convierte a bolívares para mostrar cuánto
-- cobrar -- así nadie tiene que reescribir precios en Bs cada vez que la
-- tasa cambia. Cada venta guarda la tasa que se usó ese día, para que el
-- historial no cambie de valor si la tasa de hoy es distinta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quién puede entrar a ZR Coffee
-- -----------------------------------------------------------------------------
create table public.zr_coffee_managers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);

create or replace function public.es_gestor_zr_coffee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.zr_coffee_managers where profile_id = auth.uid());
$$;

alter table public.zr_coffee_managers enable row level security;

create policy "gestor: ve la lista" on public.zr_coffee_managers
  for select to authenticated
  using ((select public.es_gestor_zr_coffee()) or (select public.is_super()));

create policy "super: administra gestores" on public.zr_coffee_managers
  for all to authenticated
  using ((select public.is_super())) with check ((select public.is_super()));

-- Cecilia es la única gestora hoy. `select ... where exists` en vez de un
-- UUID fijo: así la migración no falla en un entorno (como zr-staging) donde
-- esa cuenta todavía no existe -- simplemente no inserta nada ahí.
insert into public.zr_coffee_managers (profile_id)
select id from public.profiles where cedula = 'V-14586820'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Productos
-- -----------------------------------------------------------------------------
create table public.zr_coffee_products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) > 0),
  cost       numeric(10,2) not null check (cost >= 0),
  stock      numeric(10,2) not null default 0 check (stock >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_zr_coffee_products_updated
  before update on public.zr_coffee_products
  for each row execute function public.set_updated_at();

alter table public.zr_coffee_products enable row level security;

create policy "gestor: gestiona productos" on public.zr_coffee_products
  for all to authenticated
  using ((select public.es_gestor_zr_coffee())) with check ((select public.es_gestor_zr_coffee()));

-- -----------------------------------------------------------------------------
-- 3. Tasa de cambio del día (una fila por fecha)
-- -----------------------------------------------------------------------------
create table public.zr_coffee_tasa_cambio (
  fecha          date primary key,
  tasa           numeric(10,4) not null check (tasa > 0),
  registrado_por uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

create trigger trg_zr_coffee_tasa_updated
  before update on public.zr_coffee_tasa_cambio
  for each row execute function public.set_updated_at();

alter table public.zr_coffee_tasa_cambio enable row level security;

create policy "gestor: gestiona tasa" on public.zr_coffee_tasa_cambio
  for all to authenticated
  using ((select public.es_gestor_zr_coffee())) with check ((select public.es_gestor_zr_coffee()));

-- -----------------------------------------------------------------------------
-- 4. Ventas
-- -----------------------------------------------------------------------------
create table public.zr_coffee_sales (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.zr_coffee_products(id) on delete restrict,
  quantity       numeric(10,2) not null check (quantity > 0),
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  total          numeric(12,2) generated always as (quantity * unit_price) stored,
  tasa_usada     numeric(10,4),
  sold_at        date not null default current_date,
  registered_by  uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_zr_coffee_sales_fecha on public.zr_coffee_sales (sold_at);
create index idx_zr_coffee_sales_producto on public.zr_coffee_sales (product_id);

alter table public.zr_coffee_sales enable row level security;

create policy "gestor: lee ventas" on public.zr_coffee_sales
  for select to authenticated
  using ((select public.es_gestor_zr_coffee()));

-- Las ventas se insertan únicamente a través de fn_zr_coffee_registrar_venta
-- (más abajo), que descuenta el inventario de forma atómica -- nunca se
-- calculan existencias en el navegador (regla 2 de AGENTS.md, aplicada aquí
-- aunque no sea nota ni QR: la razón es la misma, que dos ventas casi
-- simultáneas no dejen el inventario en negativo).
create policy "gestor: borra ventas" on public.zr_coffee_sales
  for delete to authenticated
  using ((select public.es_gestor_zr_coffee()));

-- -----------------------------------------------------------------------------
-- 5. Margen de ganancia -- número de negocio, nunca escrito en el código
--    (regla 5 de AGENTS.md).
-- -----------------------------------------------------------------------------
insert into public.system_config (key, value, description, is_public) values
  ('zr_coffee.margen_ganancia_pct', '30'::jsonb,
   'Porcentaje de ganancia sobre el costo para calcular el precio de venta en ZR Coffee.',
   false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Registrar una venta, de forma atómica
-- -----------------------------------------------------------------------------
create or replace function public.fn_zr_coffee_registrar_venta(
  p_product_id uuid,
  p_cantidad numeric,
  p_precio_unitario numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_actual numeric;
  v_tasa numeric;
  v_venta_id uuid;
begin
  if not (select public.es_gestor_zr_coffee()) then
    raise exception 'No tienes acceso a ZR Coffee.';
  end if;

  if p_cantidad <= 0 then
    raise exception 'La cantidad vendida debe ser mayor a cero.';
  end if;

  select stock into v_stock_actual
  from public.zr_coffee_products
  where id = p_product_id
  for update;

  if v_stock_actual is null then
    raise exception 'Ese producto no existe.';
  end if;

  if v_stock_actual < p_cantidad then
    raise exception 'No hay suficiente existencia: quedan % y se intentaron vender %.', v_stock_actual, p_cantidad;
  end if;

  select tasa into v_tasa from public.zr_coffee_tasa_cambio where fecha = current_date;

  update public.zr_coffee_products
  set stock = stock - p_cantidad
  where id = p_product_id;

  insert into public.zr_coffee_sales (product_id, quantity, unit_price, tasa_usada, registered_by)
  values (p_product_id, p_cantidad, p_precio_unitario, v_tasa, auth.uid())
  returning id into v_venta_id;

  return v_venta_id;
end;
$$;

grant execute on function public.fn_zr_coffee_registrar_venta(uuid, numeric, numeric) to authenticated;
