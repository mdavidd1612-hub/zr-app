-- Calendario del estudiante (19-nov-2026): solo veia eventos de su modulo
-- presencial (my_module_id), asi que las fechas de Ingles virtual no salian en
-- /calendario ni en "Lo proximo". Ahora ve las de todos sus modulos cursados o
-- en curso (mis_modulos_cursados, migraciones 208/209/223), y de los examenes
-- solo los que puede ver (los de su corte: la RLS de exams se aplica dentro).
drop policy if exists "estudiante: leer calendario de su modulo" on public.calendar_events;
create policy "estudiante: leer calendario de sus modulos" on public.calendar_events
  for select to authenticated
  using (
    module_id in (select public.mis_modulos_cursados())
    and (source_type <> 'exam' or exists (select 1 from public.exams e where e.id = calendar_events.source_id))
  );
