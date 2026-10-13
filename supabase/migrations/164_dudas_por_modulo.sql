-- 164: las dudas de un estudiante pertenecen al MÓDULO en que se escribieron.
-- Hallazgo en producción (13 oct. 2026): Isaac (módulo 1) veía las dudas del módulo 2 de
-- Carlos, porque la 159 solo las separaba por programa (cohorte), no por módulo.
--
-- La duda queda marcada con el módulo que la cohorte cursaba al escribirla; cada profesor
-- ve solo las de (programa + módulo) que dicta. Administración y Dirección ven todas.
alter table public.doubts add column if not exists module_id uuid references public.modules(id) on delete set null;
create index if not exists doubts_module_idx on public.doubts(module_id);

-- Las que ya existen: el módulo del calendario ese día, o el actual de la cohorte.
update public.doubts d
   set module_id = coalesce(
         public.modulo_por_calendario(s.cohort_id, (d.created_at at time zone 'America/Caracas')::date),
         c.current_module_id)
  from public.students s
  join public.cohorts c on c.id = s.cohort_id
 where s.id = d.student_id and d.module_id is null;

-- Las nuevas se marcan solas con el módulo vigente de la cohorte del estudiante.
create or replace function public.fn_doubts_modulo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.module_id is null then
    select coalesce(public.modulo_por_calendario(s.cohort_id, (now() at time zone 'America/Caracas')::date), c.current_module_id)
      into new.module_id
      from public.students s
      join public.cohorts c on c.id = s.cohort_id
     where s.id = new.student_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_doubts_modulo() from public, anon, authenticated;

drop trigger if exists trg_doubts_modulo on public.doubts;
create trigger trg_doubts_modulo before insert on public.doubts
  for each row execute function public.fn_doubts_modulo();

drop policy if exists doubts_select_staff on public.doubts;
create policy doubts_select_staff on public.doubts
  for select using (
    (select auth_role()) in ('admin', 'super_admin', 'direccion_academica')
    or (
      (select auth_role()) = 'profesor'
      and exists (
        select 1
          from public.students s
          join public.mis_asignaciones_docente() x
            on x.cohort_id = s.cohort_id and x.module_id = doubts.module_id
         where s.id = doubts.student_id
      )
    )
  );
