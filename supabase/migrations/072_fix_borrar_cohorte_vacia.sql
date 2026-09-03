-- Corrige un hueco encontrado en el chequeo de QA de la Fase 5, en la política
-- "vendedor: borrar cohortes vacias" (migración 046): usaba directamente
-- `not exists (select 1 from students where cohort_id = cohorts.id)` dentro
-- de la política. Ese subquery corre con los MISMOS permisos RLS del usuario
-- que ejecuta el DELETE — y un vendedor solo puede VER (RLS de `students`)
-- a los estudiantes que él mismo inscribió (`enrolled_by = auth.uid()`).
--
-- Resultado real: un vendedor podía "pasar" la política de borrado de un
-- programa que SÍ tiene estudiantes, siempre que esos estudiantes los haya
-- inscrito otra persona (otro vendedor o administración) — porque para su
-- sesión, ese `not exists` daba verdadero al no ver ninguna fila.
--
-- Hoy esto no borró datos reales porque `fk_students_cohort` (ON DELETE NO
-- ACTION) frena el DELETE físico con un error de llave foránea — pero eso es
-- suerte, no diseño: la política debía bastarse sola. Se corrige con una
-- función security definer que sí ve TODA la tabla students, sin RLS de por
-- medio, para que "programa vacío" signifique vacío de verdad, no "vacío
-- para mí".
create or replace function public.cohorte_esta_vacia(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.students where cohort_id = p_cohort_id);
$$;

drop policy "vendedor: borrar cohortes vacias" on public.cohorts;

create policy "vendedor: borrar cohortes vacias" on public.cohorts for delete
  using (
    (select public.is_vendedor())
    and public.cohorte_esta_vacia(id)
  );
