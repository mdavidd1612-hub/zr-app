-- =============================================================================
-- ZR APP · MIGRACIÓN 092 · ZR Coffee: precio de venta editable a mano
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026): en el cuadro de inventario,
-- Cecilia tiene que poder escribir el "Precio de venta" directamente (no
-- solo dejar que salga solo del costo + el margen del 30%) -- por ejemplo
-- para redondear el precio en bolívares al momento de cobrar. Cuando no se
-- toca, el precio se sigue calculando solo a partir del costo y el margen
-- de `system_config` (comportamiento de la migración 090, sin cambios).
--
-- `sale_price` guarda ese precio manual, siempre en USD (mismo criterio que
-- `cost`: estable frente a la inflación -- la pantalla deja escribirlo en
-- bolívares y lo convierte con la tasa del día antes de guardar). Si es
-- null, el precio sigue siendo automático.
-- =============================================================================

alter table public.zr_coffee_products
  add column sale_price numeric(10,2) check (sale_price is null or sale_price >= 0);
