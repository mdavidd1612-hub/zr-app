-- 14-nov-2026: el estudiante ve las unidades de TODOS los módulos que ya cursó
-- (y el actual), no solo el actual. Los que todavía no empiezan siguen ocultos.
-- Antes units/unit_items/assignments/exams usaban my_module_id() (un solo módulo).
--
-- Además: el material enlazado a una unidad se ve aunque lo haya subido otra
-- cohorte del mismo módulo (las unidades son del módulo, compartidas entre
-- cohortes). Bug visto en vivo: un estudiante de PTMA-II veía "Todavía no
-- disponible" en todo el material que se había subido con la cohorte PTMA-III.

drop policy if exists "estudiante: leer unidades abiertas de su modulo" on public.units;
create policy "estudiante: leer unidades abiertas de su modulo"
  on public.units for select to authenticated
  using (
    module_id in (select public.mis_modulos_cursados())
    and unit_effective_status(open_at, close_at, manual_status) = any (array['abierta'::text, 'cerrada'::text])
  );

drop policy if exists "estudiante: leer elementos visibles de su modulo" on public.unit_items;
create policy "estudiante: leer elementos visibles de su modulo"
  on public.unit_items for select to authenticated
  using (exists (
    select 1 from public.units u
     where u.id = unit_items.unit_id
       and u.module_id in (select public.mis_modulos_cursados())
       and public.unit_item_is_visible(unit_items.visible, unit_items.visible_from, unit_items.visible_until, u.open_at, u.close_at, u.manual_status)
       and public.unit_prerequisite_met(u.id, auth.uid())
  ));

drop policy if exists "estudiante: leer tareas de su modulo" on public.assignments;
create policy "estudiante: leer tareas de su modulo"
  on public.assignments for select to authenticated
  using (exists (
    select 1 from public.units u
     where u.id = assignments.unit_id
       and u.module_id in (select public.mis_modulos_cursados())
  ));

drop policy if exists "estudiante: leer examenes habilitados" on public.exams;
create policy "estudiante: leer examenes habilitados"
  on public.exams for select to authenticated
  using (
    status = any (array['habilitado'::exam_status, 'cerrado'::exam_status, 'calificado'::exam_status])
    and (
      cohort_id = (select public.my_cohort_id())
      or (cohort_id is null and module_id in (select public.mis_modulos_cursados()))
    )
  );

drop policy if exists "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;
create policy "estudiante: leer contenido publicado de sus modulos cursados"
  on public.content_items for select to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select public.mis_modulos_cursados())
    and (
      cohort_id is null
      or cohort_id = public.mi_cohorte_estudiante()
      or exists (select 1 from public.unit_items ui where ui.content_item_id = content_items.id)
    )
    and (select public.estudiante_solvente())
    and (unit_id is null or public.unit_prerequisite_met(unit_id, auth.uid()))
  );
