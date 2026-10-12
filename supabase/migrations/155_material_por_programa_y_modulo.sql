-- 155: el material y las carpetas pertenecen a un PROGRAMA (cohorte) y a un módulo.
--
-- Cada cohorte (PTMA-2026-II, PTMA-2026-I…) es un programa distinto y puede tener
-- otro profesor en el mismo módulo. Un profesor ve y sube material solo de los
-- (programa + módulo) que dicta, y de ese material solo lo suyo y lo que subió
-- Dirección Académica / administración — nunca lo de otro profesor.
--
-- cohort_id NULL = material general: sirve a todos los programas del módulo
-- (así el material que ya existe no se pierde ni cambia).

alter table public.content_items
  add column if not exists cohort_id uuid references public.cohorts(id) on delete set null;
alter table public.content_folders
  add column if not exists cohort_id uuid references public.cohorts(id) on delete set null;

create index if not exists content_items_cohort_idx on public.content_items(cohort_id);
create index if not exists content_folders_cohort_idx on public.content_folders(cohort_id);

-- Pares (programa, módulo) que dicta el profesor que consulta.
create or replace function public.mis_asignaciones_docente()
returns table (cohort_id uuid, module_id uuid)
language sql stable security definer set search_path = public as $$
  -- asignación explícita a una cohorte
  select a.cohort_id, a.module_id
    from public.teacher_module_assignments a
   where a.teacher_id = auth.uid() and a.cohort_id is not null
  union
  -- asignación general (anterior a 153): vale para todas las cohortes de ese programa
  select c.id, a.module_id
    from public.teacher_module_assignments a
    join public.modules m on m.id = a.module_id
    join public.cohorts c on c.program_id = m.program_id
   where a.teacher_id = auth.uid() and a.cohort_id is null
  union
  -- profesor de cohorte anterior al modelo por módulo
  select c.id, c.current_module_id
    from public.cohorts c
   where c.teacher_id = auth.uid() and c.current_module_id is not null
  union
  select s.cohort_id, s.module_id
    from public.class_sessions s
   where s.teacher_id = auth.uid() and s.module_id is not null;
$$;

-- ¿Puede el profesor actual ver este material? Debe dictar ese módulo en ese
-- programa, y el material ser suyo o de Dirección / administración.
create or replace function public.profesor_ve_material(p_cohort uuid, p_module uuid, p_uploaded_by uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.mis_asignaciones_docente() x
            where x.module_id = p_module and (p_cohort is null or x.cohort_id = p_cohort)
         )
     and (
           p_uploaded_by = auth.uid()
           or exists (
                select 1 from public.profiles p
                 where p.id = p_uploaded_by
                   and p.role in ('direccion_academica', 'super_admin', 'admin')
              )
         );
$$;

-- ¿Dicta este módulo en este programa? (para subir)
create or replace function public.profesor_dicta(p_cohort uuid, p_module uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_cohort is not null and exists (
    select 1 from public.mis_asignaciones_docente() x
     where x.module_id = p_module and x.cohort_id = p_cohort
  );
$$;

-- Programa (cohorte) del estudiante que consulta.
create or replace function public.mi_cohorte_estudiante()
returns uuid
language sql stable security definer set search_path = public as $$
  select s.cohort_id from public.students s where s.id = auth.uid();
$$;

-- ── content_items ────────────────────────────────────────────────────────────
drop policy if exists "profesor: escribir contenido de sus modulos" on public.content_items;
drop policy if exists "profesor: leer contenido de sus modulos" on public.content_items;
drop policy if exists "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;

create policy "profesor: leer contenido de su programa y modulo" on public.content_items
  for select using (
    (select auth_role()) = 'profesor'
    and (uploaded_by = (select auth.uid())
         or public.profesor_ve_material(cohort_id, module_id, uploaded_by))
  );

create policy "profesor: escribir contenido de su programa y modulo" on public.content_items
  for all using (
    (select auth_role()) = 'profesor'
    and (uploaded_by = (select auth.uid())
         or public.profesor_ve_material(cohort_id, module_id, uploaded_by))
  )
  with check (
    (select auth_role()) = 'profesor'
    and uploaded_by = (select auth.uid())
    and public.profesor_dicta(cohort_id, module_id)
  );

create policy "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items
  for select using (
    is_published
    and (visible_from is null or visible_from <= now())
    and module_id in (select mis_modulos_cursados())
    and (cohort_id is null or cohort_id = public.mi_cohorte_estudiante())
    and (select estudiante_solvente())
  );

-- ── content_folders ──────────────────────────────────────────────────────────
drop policy if exists "profesor: leer carpetas de sus modulos" on public.content_folders;
drop policy if exists "estudiante: leer carpetas de sus modulos cursados" on public.content_folders;

create policy "profesor: leer carpetas de su programa y modulo" on public.content_folders
  for select using (
    (select auth_role()) = 'profesor'
    and public.profesor_ve_material(cohort_id, module_id, created_by)
  );

create policy "estudiante: leer carpetas de sus modulos cursados" on public.content_folders
  for select using (
    module_id in (select mis_modulos_cursados())
    and (cohort_id is null or cohort_id = public.mi_cohorte_estudiante())
    and (select estudiante_solvente())
  );

-- ── aviso de material nuevo: solo a los estudiantes de ese programa ─────────
create or replace function public.fn_notify_material_nuevo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.is_published = true and old.is_published is distinct from true then
    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select s.id,
           'material_nuevo',
           'Nuevo material: ' || new.title,
           'Tu profesor subió material nuevo. Entra a la app para verlo.',
           jsonb_build_object('content_item_id', new.id),
           'push'
      from public.students s
      join public.cohorts c on c.id = s.cohort_id
     where c.current_module_id = new.module_id
       and c.status = 'activa'
       and (new.cohort_id is null or s.cohort_id = new.cohort_id);
  end if;
  return new;
end;
$$;
