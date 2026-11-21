-- Falta encontrada al construir el borrado de unidades (7-nov-2026): el
-- bucket 'tareas' tenia politicas de leer (estudiante lee la suya, personal
-- lee todas) y subir (estudiante sube la suya), pero NINGUNA de borrar -- ni
-- para el estudiante ni para el personal. Sin politica, RLS bloquea el
-- DELETE para todos, asi que eliminar una unidad nunca iba a poder limpiar
-- los archivos de las entregas en Storage (quedarian huerfanos para
-- siempre). Se agrega la de personal, que es quien borra unidades.
create policy "personal: borra entregas"
  on storage.objects for delete
  using (bucket_id = 'tareas' and is_staff());

-- RPC que borra una unidad completa (pedido explicito del coordinador,
-- 7-nov-2026: "si quiero eliminar ingles 1"). Se hace server-side, no desde
-- el cliente con varios deletes sueltos, para que la limpieza de Storage y
-- el borrado de filas queden en una sola operacion atomica -- si algo falla
-- a mitad de camino, security definer + exception revierte todo.
--
-- Lo que la base ya hace sola via ON DELETE CASCADE al borrar la fila de
-- units: unit_items, assignments, submissions. Lo que NO hace sola (y esta
-- funcion si hace): borrar los bloques de texto (content_items tipo
-- 'texto', enlazados solo via unit_items, quedarian huerfanos en la base).
-- Material y examenes REUTILIZADOS (no 'texto') nunca se borran, solo se
-- desenlazan solos por el cascade de unit_items -- pueden estar en otra
-- unidad. Los archivos de Storage (entregas, banner) los borra el cliente
-- antes de llamar a este RPC, con las rutas que lee mientras las filas
-- todavia existen.
create or replace function fn_eliminar_unidad(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'No autorizado';
  end if;

  -- Bloques de texto de esta unidad: se borran a mano (no cuelgan de units
  -- por FK propia, solo vía unit_items, que se va a borrar en cascada).
  delete from content_items ci
  where ci.type = 'texto'
    and ci.id in (
      select ui.content_item_id from unit_items ui
      where ui.unit_id = p_unit_id and ui.content_item_id is not null
    );

  -- La fila de la unidad: arrastra en cascada unit_items, assignments y
  -- submissions. Los archivos de Storage no los toca Postgres -- se limpian
  -- aparte, desde el cliente, con las rutas que ya se leyeron antes de esto.
  delete from units where id = p_unit_id;
end;
$$;

revoke all on function fn_eliminar_unidad(uuid) from public;
revoke execute on function fn_eliminar_unidad(uuid) from anon;
grant execute on function fn_eliminar_unidad(uuid) to authenticated;
