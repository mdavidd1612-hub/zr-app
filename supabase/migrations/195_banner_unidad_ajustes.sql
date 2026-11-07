-- 195: Ajustes al banner de unidad (migración 194), pedidos en la misma
-- tarde del 7-nov-2026 después de ver el primer resultado:
--
-- 1. Se quita "aspecto" (moderno/clásico) -- decisión del coordinador:
--    "mejor siempre vamos a darle moderno, para que no sea tan disperso".
--    Un solo aspecto para toda la app, sin elegirlo por unidad.
-- 2. Se agrega banner_image_position: con qué foco vertical se recorta la
--    imagen (0 = arriba, 50 = centro, 100 = abajo) -- pedido explícito:
--    "que pueda agarrarla y subirla o bajarla para donde quiera", porque
--    una imagen cuadrada no entra entera en el rectángulo del banner.

alter table public.units drop column if exists banner_aspecto;

alter table public.units
  add column banner_image_position smallint not null default 50
    check (banner_image_position between 0 and 100);
