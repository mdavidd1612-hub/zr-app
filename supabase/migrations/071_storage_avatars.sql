-- R-51 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md, Fase 5): foto de perfil del
-- estudiante. Bucket privado — son fotos de menores de edad, no se sirven por
-- URL pública. `profiles.avatar_url` pasa a guardar la RUTA dentro del bucket
-- (ej. '<uid>/avatar.jpg'), no una URL; la app genera un signed URL al mostrarla.
--
-- Límite de tamaño y tipo de archivo se fuerzan aquí, en el bucket mismo —no
-- solo en el cliente— para que la regla no dependa de que nadie se salte la
-- validación del navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'Fotos de perfil', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

-- El dueño siempre puede ver su propia foto.
create policy "dueno-lee-su-avatar" on storage.objects for select
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- El personal (profesor, admin, super_admin, dirección académica) puede ver
-- cualquier foto: la necesitan para identificar a un estudiante en persona.
create policy "personal-lee-avatares" on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (public.is_staff() or public.is_academico())
  );

-- Solo el dueño sube o reemplaza su propia foto (ruta prefijada con su uid).
create policy "dueno-sube-su-avatar" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "dueno-actualiza-su-avatar" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1))
  with check (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));
