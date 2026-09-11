-- =============================================================================
-- ZR APP · MIGRACIÓN 091 · ZR Coffee: "Cantidad" repuesta además de la
-- existencia actual
-- =============================================================================
-- Administradora Cecilia mandó su hoja de Excel real ("Inventario y Control
-- de Ventas.xlsx"): lleva dos columnas de cantidad, no una sola --
-- "Cantidad" (lo que ha repuesto en total de ese producto) y "Cantidad
-- Restante" (lo que queda ahora mismo). La resta entre ambas es cuánto se ha
-- vendido en total, de un vistazo, sin tener que sumar el historial.
--
-- `zr_coffee_products.stock` (migración 090) ya es la "Cantidad Restante"
-- -- baja con cada venta (fn_zr_coffee_registrar_venta) y sube cuando se
-- repone. Esta migración agrega `total_repuesto` ("Cantidad"): solo sube,
-- cuando se crea el producto o se repone existencia; una venta nunca la
-- toca. Arranca igual al stock actual de cada producto -- a partir de hoy
-- ambas empiezan a divergir según se vaya vendiendo.
-- =============================================================================

alter table public.zr_coffee_products
  add column total_repuesto numeric(10,2) not null default 0 check (total_repuesto >= 0);

update public.zr_coffee_products set total_repuesto = stock;
