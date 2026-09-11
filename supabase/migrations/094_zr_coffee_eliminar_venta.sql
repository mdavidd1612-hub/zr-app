-- =============================================================================
-- ZR APP · MIGRACIÓN 094 · ZR Coffee: eliminar una venta registrada por error
-- =============================================================================
-- Pedido explícito del coordinador: en "Ventas por día", poder borrar una
-- venta que se cargó mal (producto equivocado, cantidad equivocada, etc.).
--
-- Igual que registrar una venta (fn_zr_coffee_registrar_venta, migración
-- 090), esto NUNCA se calcula en el navegador: borrar la fila sin más
-- dejaría la existencia del producto descontada de más, porque la venta ya
-- había restado esa cantidad del inventario al registrarse. Esta función
-- devuelve esa cantidad al inventario y borra la venta en la misma
-- transacción -- que dos personas borrando casi al mismo tiempo no dejen el
-- inventario inconsistente.
-- =============================================================================
create or replace function public.fn_zr_coffee_eliminar_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_cantidad numeric;
begin
  if not (select public.es_gestor_zr_coffee()) then
    raise exception 'No tienes acceso a ZR Coffee.';
  end if;

  select product_id, quantity into v_product_id, v_cantidad
  from public.zr_coffee_sales
  where id = p_venta_id
  for update;

  if v_product_id is null then
    raise exception 'Esa venta no existe.';
  end if;

  update public.zr_coffee_products
  set stock = stock + v_cantidad
  where id = v_product_id;

  delete from public.zr_coffee_sales where id = p_venta_id;
end;
$$;

grant execute on function public.fn_zr_coffee_eliminar_venta(uuid) to authenticated;
