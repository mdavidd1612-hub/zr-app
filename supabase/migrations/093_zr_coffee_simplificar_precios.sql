-- =============================================================================
-- ZR APP · MIGRACIÓN 093 · ZR Coffee: precios simples, sin selector de moneda
-- =============================================================================
-- El selector de moneda ($ / Bs) por celda de la migración 092 salió mal:
-- confundía más de lo que ayudaba (el costo "se cambiaba solo" de moneda al
-- guardar, por el redondeo del viaje Bs -> USD -> Bs) y no era lo que pidió
-- el coordinador. Pedido explícito de vuelta: que el cuadro sea una copia
-- literal de la hoja de Cecilia ("Inventario y Control de Ventas.xlsx"),
-- sin conversión de moneda escondida -- cada número es el que ella escribe,
-- tal cual, en la moneda que ella ya usa (bolívares).
--
-- Se quita `sale_price` (precio de venta fijado a mano, migración 092) y se
-- reemplaza por `margin_pct`: el % de ganancia de CADA producto, editable
-- por fila -- igual que en su hoja, donde "Precio de Venta" y "Monto de
-- Ganancia" son fórmulas sobre "Costo" y "% de Ganancia", no números
-- sueltos. Si `margin_pct` es null, se usa el margen general de
-- `system_config` (zr_coffee.margen_ganancia_pct) como antes.
-- =============================================================================

alter table public.zr_coffee_products drop column sale_price;

alter table public.zr_coffee_products
  add column margin_pct numeric(6,2) check (margin_pct is null or margin_pct >= 0);

comment on column public.zr_coffee_products.cost is
  'Costo del producto, en la moneda que use la administración (bolívares) -- sin conversión automática.';
comment on column public.zr_coffee_products.margin_pct is
  'Porcentaje de ganancia de ESTE producto. Si es null, se usa zr_coffee.margen_ganancia_pct (system_config).';
