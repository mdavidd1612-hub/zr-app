-- =============================================================================
-- ZR APP · MIGRACIÓN 089 · Dirección Académica puede subir material (storage)
-- =============================================================================
-- Bug real de producción (sept. 2026): dirección académica podía crear
-- carpetas y content_items (esas políticas ya se actualizaron en la
-- migración 023, cuando is_staff()/is_admin_up() aprendieron a reconocer
-- este rol) pero el bucket de storage 'contenido' se quedó con las
-- políticas originales de la migración 015, que solo dejan escribir a
-- 'profesor', 'admin' y 'super_admin'. Resultado: "new row violates row-
-- level security policy" al intentar subir el archivo real, aunque la fila
-- de content_items sí se hubiera podido crear.
-- =============================================================================

drop policy if exists "profesor-escribe-contenido" on storage.objects;
create policy "profesor-escribe-contenido" on storage.objects for insert
  with check (
    bucket_id = 'contenido'
    and (
      select role from public.profiles where id = auth.uid()
    ) in ('profesor', 'admin', 'super_admin', 'direccion_academica')
  );

drop policy if exists "profesor-actualiza-contenido" on storage.objects;
create policy "profesor-actualiza-contenido" on storage.objects for update
  using (bucket_id = 'contenido')
  with check (
    (
      select role from public.profiles where id = auth.uid()
    ) in ('profesor', 'admin', 'super_admin', 'direccion_academica')
  );
