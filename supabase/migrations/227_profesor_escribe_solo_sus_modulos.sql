-- =============================================================================
-- ZR APP · MIGRACIÓN 227 · El profesor solo modifica unidades de los módulos que dicta
-- =============================================================================
-- Hallazgo de la prueba de escenarios del 20-nov-2026 (cuentas reales de
-- staging, permisos reales): las políticas de escritura de `units`,
-- `unit_items`, `assignments` y la de calificar `submissions` usaban solo
-- `is_staff()`. Resultado: CUALQUIER profesor podía renombrar una unidad, quitar
-- sus elementos, crear/borrar tareas o calificar entregas de un módulo que no
-- dicta (p. ej. el profesor de Introducción renombró una unidad de Inglés, y el
-- de Fluidos vació una unidad de Inglés).
--
-- Ahora: Dirección, super_admin y admin siguen igual (`is_admin_up()`); el
-- profesor solo escribe donde el módulo está en `modulos_que_imparto()` (la
-- misma regla que ya usan `exams` y `manual_exam_definitions`). La LECTURA no
-- cambia.
-- =============================================================================

-- units
drop policy if exists "personal: escribir unidades" on public.units;
create policy "personal: escribir unidades" on public.units for all to authenticated
  using ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto())))
  with check ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and module_id in (select public.modulos_que_imparto())));

-- unit_items
drop policy if exists "personal: escribir elementos de unidad" on public.unit_items;
create policy "personal: escribir elementos de unidad" on public.unit_items for all to authenticated
  using ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.units u
               where u.id = unit_items.unit_id and u.module_id in (select public.modulos_que_imparto()))))
  with check ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.units u
               where u.id = unit_items.unit_id and u.module_id in (select public.modulos_que_imparto()))));

-- assignments (tareas)
drop policy if exists "personal: escribir tareas" on public.assignments;
create policy "personal: escribir tareas" on public.assignments for all to authenticated
  using ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.units u
               where u.id = assignments.unit_id and u.module_id in (select public.modulos_que_imparto()))))
  with check ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.units u
               where u.id = assignments.unit_id and u.module_id in (select public.modulos_que_imparto()))));

-- submissions: calificar entregas
drop policy if exists "personal: calificar entregas" on public.submissions;
create policy "personal: calificar entregas" on public.submissions for update to authenticated
  using ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.assignments a join public.units u on u.id = a.unit_id
               where a.id = submissions.assignment_id and u.module_id in (select public.modulos_que_imparto()))))
  with check ((select public.is_admin_up())
         or ((select public.auth_role()) = 'profesor' and exists (
              select 1 from public.assignments a join public.units u on u.id = a.unit_id
               where a.id = submissions.assignment_id and u.module_id in (select public.modulos_que_imparto()))));
