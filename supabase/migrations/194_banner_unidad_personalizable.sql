-- 194: Banner de unidad personalizable (Odoo-style, pedido #4 del coordinador
-- 31-oct/7-nov-2026, construido el 7-nov-2026 a pedido explícito: "constrúyelo
-- ahora"). Antes era opcional/descartable ("si hace que la app cargue mal,
-- descártalo") -- se construye con cuidado: imagen opcional, color opcional,
-- aspecto clásico/moderno. El profesor (y Dirección/super_admin, que
-- administran la unidad igual) lo configura desde "Editar unidad"; lo ve
-- CUALQUIER perfil que entre a esa unidad (estudiante incluido) -- por eso la
-- imagen va en un bucket público: es un banner decorativo, no un documento.

alter table public.units
  add column banner_image_path text,
  add column banner_color text check (
    banner_color is null or banner_color = any (array['azul','verde','morado','grafito','vino'])
  ),
  add column banner_aspecto text not null default 'moderno' check (banner_aspecto = any (array['moderno','clasico']));

insert into storage.buckets (id, name, public)
values ('banners-unidad', 'banners-unidad', true)
on conflict (id) do nothing;

-- Solo profesor/dirección/super_admin (is_academico()/is_admin_up(), mismo
-- criterio que el resto de Aula Virtual) puede subir/cambiar/borrar un
-- banner. La lectura no necesita política -- el bucket es público, Storage
-- sirve el archivo directo sin pasar por RLS en el GET.
create policy "banners-unidad: subir"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'banners-unidad'
    and ((select is_academico()) or (select is_admin_up()))
  );

create policy "banners-unidad: actualizar"
  on storage.objects for update to authenticated
  using (bucket_id = 'banners-unidad' and ((select is_academico()) or (select is_admin_up())))
  with check (bucket_id = 'banners-unidad' and ((select is_academico()) or (select is_admin_up())));

create policy "banners-unidad: borrar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banners-unidad' and ((select is_academico()) or (select is_admin_up())));
