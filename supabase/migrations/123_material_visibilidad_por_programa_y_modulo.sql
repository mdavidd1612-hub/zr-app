-- =============================================================================
-- ZR APP · MIGRACIÓN 123 · Material: visibilidad por programa y módulo + mover
-- =============================================================================
-- Reunión de Dirección Académica (oct. 2026), decisiones confirmadas:
--   * "Corte" = cohorte = "Programa" en el lenguaje de la academia. Los módulos
--     YA son por programa (modules.program_id), así que programa + módulo de un
--     material salen de content_items.module_id -- no se duplican en columnas
--     que pudieran contradecirse.
--   * El estudiante ve el material de TODOS los módulos que ya cursó de su
--     programa (orden <= el módulo actual de su cohorte), nunca los que aún no
--     le tocan.
--   * El profesor ve el material de los módulos que dicta (más lo que él
--     mismo subió). Administración y Dirección Académica ven todo.
--   * Mover material/carpetas es solo DENTRO del mismo módulo.
-- Las políticas con subconsultas a content_items/modules corren con el RLS de
-- quien consulta, así que la política de Storage de la migración 122 hereda
-- estas reglas sola.
-- =============================================================================

-- Módulos que un estudiante ya cursó o está cursando (mismo programa, orden <= actual).
create or replace function public.mis_modulos_cursados()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.students s
  join public.cohorts c  on c.id = s.cohort_id
  join public.modules cur on cur.id = c.current_module_id
  join public.modules m   on m.program_id = cur.program_id and m.order_index <= cur.order_index
  where s.id = auth.uid();
$$;

-- Módulos que dicta un profesor: el actual de sus cohortes y los de sus sesiones.
create or replace function public.mis_modulos_docente()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.current_module_id from public.cohorts c
   where c.teacher_id = auth.uid() and c.current_module_id is not null
  union
  select s.module_id from public.class_sessions s
   where s.teacher_id = auth.uid() and s.module_id is not null;
$$;

-- ---------------------------------------------------------------- content_items
drop policy "estudiante: leer contenido publicado de su modulo" on public.content_items;
create policy "estudiante: leer contenido publicado de sus modulos cursados"
  on public.content_items for select
  to authenticated
  using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select public.mis_modulos_cursados())
  );

drop policy "personal: leer todo el contenido" on public.content_items;
create policy "direccion/admin: leer todo el contenido"
  on public.content_items for select
  to authenticated
  using ((select public.auth_role()) in ('admin', 'super_admin', 'direccion_academica'));
create policy "profesor: leer contenido de sus modulos"
  on public.content_items for select
  to authenticated
  using (
    (select public.auth_role()) = 'profesor'
    and (uploaded_by = (select auth.uid()) or module_id in (select public.mis_modulos_docente()))
  );

drop policy "personal: escribir contenido" on public.content_items;
create policy "direccion/admin: escribir contenido"
  on public.content_items for all
  to authenticated
  using ((select public.auth_role()) in ('admin', 'super_admin', 'direccion_academica'))
  with check ((select public.auth_role()) in ('admin', 'super_admin', 'direccion_academica'));
create policy "profesor: escribir contenido de sus modulos"
  on public.content_items for all
  to authenticated
  using (
    (select public.auth_role()) = 'profesor'
    and (uploaded_by = (select auth.uid()) or module_id in (select public.mis_modulos_docente()))
  )
  with check (
    (select public.auth_role()) = 'profesor'
    and module_id in (select public.mis_modulos_docente())
  );

-- -------------------------------------------------------------- content_folders
drop policy "estudiante: leer carpetas de su modulo" on public.content_folders;
create policy "estudiante: leer carpetas de sus modulos cursados"
  on public.content_folders for select
  to authenticated
  using (module_id in (select public.mis_modulos_cursados()));

drop policy "personal: leer todas las carpetas" on public.content_folders;
create policy "direccion/admin: leer todas las carpetas"
  on public.content_folders for select
  to authenticated
  using ((select public.auth_role()) in ('admin', 'super_admin', 'direccion_academica'));
create policy "profesor: leer carpetas de sus modulos"
  on public.content_folders for select
  to authenticated
  using (
    (select public.auth_role()) = 'profesor'
    and module_id in (select public.mis_modulos_docente())
  );

-- ------------------------------------------------------------------------ mover
-- Mover es solo dentro del mismo módulo y sin crear ciclos de carpetas.
create or replace function public.fn_validar_mover_item()
returns trigger
language plpgsql
as $$
begin
  if new.folder_id is distinct from old.folder_id and new.folder_id is not null then
    if (select module_id from public.content_folders where id = new.folder_id) is distinct from new.module_id then
      raise exception 'Solo se puede mover material a una carpeta del mismo módulo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_validar_mover_item
  before update of folder_id on public.content_items
  for each row execute function public.fn_validar_mover_item();

create or replace function public.fn_validar_mover_carpeta()
returns trigger
language plpgsql
as $$
declare
  padre uuid := new.parent_folder_id;
  saltos int := 0;
begin
  if new.parent_folder_id is not distinct from old.parent_folder_id then
    return new;
  end if;
  if new.parent_folder_id is null then
    return new;
  end if;
  if (select module_id from public.content_folders where id = new.parent_folder_id) is distinct from new.module_id then
    raise exception 'Solo se puede mover una carpeta dentro del mismo módulo.';
  end if;
  -- Subiendo por los padres no debe aparecer la propia carpeta.
  while padre is not null and saltos < 100 loop
    if padre = new.id then
      raise exception 'Una carpeta no se puede mover dentro de sí misma ni de sus subcarpetas.';
    end if;
    select parent_folder_id into padre from public.content_folders where id = padre;
    saltos := saltos + 1;
  end loop;
  return new;
end;
$$;

create trigger trg_validar_mover_carpeta
  before update of parent_folder_id on public.content_folders
  for each row execute function public.fn_validar_mover_carpeta();
