-- =============================================================================
-- ZR APP · MIGRACIÓN 184 · Arregla "new row violates row-level security
-- policy" al subir material (bucket 'contenido')
-- =============================================================================
-- Bug real reportado por el coordinador desde el principio de esta sesión,
-- reproducido y diagnosticado el 31-oct-2026 llamando directo a la API de
-- Storage con una sesión de profesor válida y recién verificada:
--
--   https://.../storage/v1/object/contenido/<ruta>   con header x-upsert:true
--   → 400 AccessDenied "new row violates row-level security policy"
--
--   La MISMA llamada SIN x-upsert → 200 OK.
--
-- Causa raíz: el cliente (lib/subida.ts, subirAlBucket) siempre sube con
-- `upsert: true` -- a propósito, para que reintentar una subida que se cortó
-- a mitad de camino no falle por "el archivo ya existe" (la ruta lleva un
-- UUID propio, así que reintentar sobre ella es seguro). Pero `upsert` hace
-- que Postgres resuelva la subida como
-- `INSERT ... ON CONFLICT (bucket_id, name) DO UPDATE`, y para decidir si
-- hay conflicto necesita poder LEER (política SELECT) el objeto que se
-- está subiendo. La política de lectura de 'contenido' (migración 122)
-- solo deja ver un archivo si ya existe su fila en content_items -- pero
-- esa fila se crea DESPUÉS de que el archivo ya está en el bucket (storage
-- primero, luego el insert en content_items). Un profesor nunca puede "ver"
-- su propio archivo todavía, así que el chequeo de conflicto de upsert
-- fallaba siempre, para TODA subida, sin excepción.
--
-- Arreglo: el dueño del objeto (quien lo subió) siempre puede verlo, además
-- de las condiciones que ya existían (Dirección Académica/admin, o que ya
-- tenga su fila en content_items). No afloja nada para nadie más -- sigue
-- sin poder ver el material de otro antes de que se publique.
-- =============================================================================

drop policy if exists "contenido: leer solo lo visible" on storage.objects;

create policy "contenido: leer solo lo visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contenido'
    and (
      (select public.is_academico())
      or (select public.is_admin_up())
      or (owner = (select auth.uid()))
      or exists (
        select 1 from public.content_items ci
        where ci.storage_path = storage.objects.name
      )
    )
  );
