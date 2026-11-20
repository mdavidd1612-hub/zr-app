-- Ficha unica por corte (19-nov-2026, propuesta B): Direccion Academica arma el
-- calendario de modulos de cada corte (incluido marcar un modulo como virtual en
-- paralelo, migracion 223) sin depender del super_admin. Antes solo el
-- super_admin podia escribir aqui (Configuracion).
create policy "direccion: administra el calendario" on public.cohort_module_calendar
  for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));
