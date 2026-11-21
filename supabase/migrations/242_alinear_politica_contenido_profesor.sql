-- 242 · Alinea la política de escritura de material del profesor con la que se probó en staging
-- (21-nov-2026, ensayo del paso a producción).
--
-- En staging la política de la 155 se había cambiado a mano (sin migración): el profesor que
-- dicta el módulo puede editar cualquier material de ese módulo y corte (p. ej. asociar un
-- mini-chequeo o corregir el título de un material que subió Dirección o que llegó con el
-- traslado a Unidades), no solo el que subió él. Producción seguía con la versión de la 155,
-- que solo dejaba guardar si uploaded_by era el propio profesor. Esta migración deja las dos
-- bases iguales a lo que se probó.
drop policy if exists "profesor: escribir contenido de su programa y modulo" on public.content_items;
create policy "profesor: escribir contenido de su programa y modulo" on public.content_items
  for all
  using (
    ((select public.auth_role()) = 'profesor'::public.user_role)
    and ((uploaded_by = (select auth.uid())) or public.profesor_ve_material(cohort_id, module_id, uploaded_by))
  )
  with check (
    ((select public.auth_role()) = 'profesor'::public.user_role)
    and public.profesor_dicta(cohort_id, module_id)
  );
