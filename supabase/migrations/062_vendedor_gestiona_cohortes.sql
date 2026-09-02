-- =============================================================================
-- ZR APP · MIGRACIÓN 062 · Ventas gestiona todas las cohortes, no solo las suyas
-- =============================================================================
-- La migración 060 le dio al vendedor permiso para corregir y borrar las
-- cohortes que él mismo había creado. En la práctica no alcanza: las siete
-- cohortes reales nacieron por migración, sin `created_by`, así que eran
-- justamente las que no podía tocar — y son las que más falta hace mantener.
--
-- Además faltaba la acción que de verdad se usa a fin de corte: **terminar**
-- una cohorte. Borrar no sirve para eso — una cohorte que ya dio clases tiene
-- asistencias, notas y estudiantes colgando, y esa historia no se tira. Lo que
-- se quiere es sacarla de la lista de inscripción dejándola en `finalizada`.
--
-- QUÉ PUEDE Y QUÉ NO PUEDE VENTAS
-- Puede: renombrar, cambiar sede, turno, días, horario, y abrir/terminar.
-- No puede: cambiar el programa, la fecha de inicio, el número de corte, el
-- profesor ni el módulo. Los tres primeros porque definen el código de carnet
-- ya entregado a los estudiantes; los dos últimos porque son decisiones
-- académicas, de Dirección Académica, no de ventas.
--
-- Eso no se puede expresar con RLS, que decide por fila y no por columna
-- (y los GRANT por columna en Supabase aplicarían a TODOS los autenticados,
-- no solo a ventas). Va como trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ver también las cohortes terminadas
-- -----------------------------------------------------------------------------
-- La política anterior filtraba `status = 'activa'`, así que en cuanto ventas
-- terminara una cohorte, esta desaparecía de su pantalla y ya no podía volver a
-- abrirla si se había equivocado. La pantalla de inscribir sigue ofreciendo solo
-- las activas: eso lo filtra la consulta, no el permiso.
drop policy "vendedor: leer cohortes activas" on public.cohorts;

create policy "vendedor: leer cohortes"
  on public.cohorts for select to authenticated
  using ((select public.is_vendedor()));

-- -----------------------------------------------------------------------------
-- 2. Corregir y borrar cualquier cohorte, no solo las propias
-- -----------------------------------------------------------------------------
drop policy "vendedor: editar sus cohortes" on public.cohorts;
drop policy "vendedor: borrar sus cohortes vacias" on public.cohorts;

create policy "vendedor: editar cohortes"
  on public.cohorts for update to authenticated
  using ((select public.is_vendedor()))
  with check ((select public.is_vendedor()));

-- Borrar sigue reservado a las cohortes vacías. Una con estudiantes se termina,
-- no se borra: ahí hay asistencias, notas y carnets emitidos.
create policy "vendedor: borrar cohortes vacias"
  on public.cohorts for delete to authenticated
  using (
    (select public.is_vendedor())
    and not exists (select 1 from public.students s where s.cohort_id = cohorts.id)
  );

-- -----------------------------------------------------------------------------
-- 3. Lo que ventas no puede cambiar aunque pueda editar la fila
-- -----------------------------------------------------------------------------
create or replace function public.fn_cohorts_guard_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo se aplica a ventas. Administración y Dirección Académica siguen
  -- pudiendo cambiar todo, y las Edge Functions (service_role, sin auth.uid())
  -- pasan de largo.
  if not (select public.is_vendedor()) then
    return new;
  end if;

  if (new.program_id, new.start_date, new.code_number)
     is distinct from
     (old.program_id, old.start_date, old.code_number)
  then
    raise exception 'El programa, la fecha de inicio y el número de corte definen el código de carnet de los estudiantes. Pídele el cambio a administración.';
  end if;

  if (new.teacher_id, new.current_module_id)
     is distinct from
     (old.teacher_id, old.current_module_id)
  then
    raise exception 'El profesor y el módulo de una cohorte los asigna Dirección Académica.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cohorts_guard_vendedor on public.cohorts;
create trigger trg_cohorts_guard_vendedor
  before update on public.cohorts
  for each row execute function public.fn_cohorts_guard_vendedor();
