-- =============================================================================
-- ZR APP · MIGRACIÓN 122 · El bucket 'contenido' solo entrega archivos visibles
-- =============================================================================
-- Hallazgo (oct. 2026): la política "estudiantes-leen-contenido" dejaba leer
-- y LISTAR cualquier objeto del bucket a cualquier usuario autenticado. Aunque
-- content_items filtraba qué material veía cada estudiante, el archivo en sí
-- no estaba protegido: un estudiante podía listar el bucket (incluido lo que
-- no es material, como PDFs de consentimiento de menores) y pedir URL firmadas.
--
-- Ahora un objeto solo se puede leer si:
--   a) existe una fila en content_items con ese storage_path que el usuario
--      ya puede ver por RLS de content_items (publicado, de su módulo, etc.), o
--   b) es Dirección Académica / admin / super_admin.
-- La subquery corre con el RLS del usuario que consulta, así que cualquier
-- cambio futuro de visibilidad en content_items protege el archivo
-- automáticamente.
-- =============================================================================

create index if not exists idx_content_items_storage_path
  on public.content_items (storage_path);

drop policy if exists "estudiantes-leen-contenido" on storage.objects;

create policy "contenido: leer solo lo visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contenido'
    and (
      (select public.is_academico())
      or (select public.is_admin_up())
      or exists (
        select 1 from public.content_items ci
        where ci.storage_path = storage.objects.name
      )
    )
  );
