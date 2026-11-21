-- =============================================================================
-- ZR APP · MIGRACIÓN 231 · Apelaciones (rehabilitación de examen) por módulo
-- =============================================================================
-- Evaluación de UX del 20-nov-2026: el "Apelar nota" del estudiante (§8.28)
-- crea una fila en `exam_rehabilitation_requests`, pero:
--  - la política del personal era "cualquier fila de `teachers`": todo profesor
--    veía y podía responder apelaciones de módulos ajenos;
--  - Dirección Académica y super_admin no están en `teachers`: no las veían.
-- Ahora el personal ve y gestiona las apelaciones de los exámenes que puede ver
-- (la RLS de `exams` ya acota al profesor a sus módulos). Administración solo
-- lee (decisión del 20-nov-2026: no toca nada de notas).
-- =============================================================================

drop policy if exists "personal_lee_todas_rehab" on public.exam_rehabilitation_requests;

create policy "personal: gestiona apelaciones de sus examenes" on public.exam_rehabilitation_requests
  for all to authenticated
  using ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exams e where e.id = exam_rehabilitation_requests.exam_id))
  with check ((select public.is_staff()) and (select public.auth_role()) <> 'admin'
         and exists (select 1 from public.exams e where e.id = exam_rehabilitation_requests.exam_id));

create policy "admin: lee apelaciones" on public.exam_rehabilitation_requests
  for select to authenticated
  using ((select public.is_admin_up()));
