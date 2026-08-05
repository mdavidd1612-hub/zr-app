-- T-011: Storage Buckets y RLS
-- Crea dos buckets privados: contenido (PDFs) y consentimientos (documentos firmados)

-- Bucket 1: contenido (solo lectura para estudiantes, escritura solo profesor/admin)
insert into storage.buckets (id, name, public)
values ('contenido', 'Contenido académico', false);

-- RLS para lectura: cualquier estudiante/profesor/admin autenticado
create policy "estudiantes-leen-contenido" on storage.objects for select
  using (bucket_id = 'contenido' and auth.role() = 'authenticated');

-- RLS para escritura: solo profesor/admin
create policy "profesor-escribe-contenido" on storage.objects for insert
  with check (
    bucket_id = 'contenido'
    and (
      select role from public.profiles where id = auth.uid()
    ) in ('profesor', 'admin', 'super_admin')
  );

create policy "profesor-actualiza-contenido" on storage.objects for update
  using (bucket_id = 'contenido')
  with check (
    (
      select role from public.profiles where id = auth.uid()
    ) in ('profesor', 'admin', 'super_admin')
  );

-- Bucket 2: consentimientos (privado, solo lectura admin, escritura estudiante)
insert into storage.buckets (id, name, public)
values ('consentimientos', 'Documentos de consentimiento', false);

-- RLS para lectura: solo admin/super_admin
create policy "admin-lee-consentimientos" on storage.objects for select
  using (
    bucket_id = 'consentimientos'
    and (
      select role from public.profiles where id = auth.uid()
    ) in ('admin', 'super_admin')
  );

-- RLS para escritura: el estudiante solo escribe su propio documento
create policy "estudiante-escribe-su-consentimiento" on storage.objects for insert
  with check (
    bucket_id = 'consentimientos'
    and auth.uid()::text = (string_to_array(name, '/')[1])
  );

-- No permitir delete de consentimientos (auditoría)
-- (no hay policy, por lo que por defecto está denegado)
