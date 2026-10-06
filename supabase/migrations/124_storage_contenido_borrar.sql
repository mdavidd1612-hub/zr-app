-- =============================================================================
-- ZR APP · MIGRACIÓN 124 · Se puede borrar del bucket 'contenido'
-- =============================================================================
-- El bucket no tenía ninguna política DELETE, así que storage.remove() no
-- borraba nada (devuelve éxito sin eliminar): al borrar o reemplazar un
-- material, el archivo viejo se quedaba huérfano en Storage. Ahora pueden
-- borrar Dirección Académica/admin, y cada quien lo que subió (para limpiar un
-- intento de subida que falló).
-- =============================================================================

create policy "contenido: borrar lo propio o por direccion/admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contenido'
    and (
      (select public.is_academico())
      or (select public.is_admin_up())
      or owner = (select auth.uid())
    )
  );
