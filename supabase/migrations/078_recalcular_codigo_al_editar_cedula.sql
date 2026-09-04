-- =============================================================================
-- ZR APP · MIGRACIÓN 078 · El código de carnet se recalcula al corregir la cédula
-- =============================================================================
-- A pedido explícito del coordinador: administración va a poder editar la
-- cédula de un estudiante (dato mal tipeado al inscribir), y "que se cambie
-- el código automáticamente, no que yo tenga que decírtelo". La migración
-- 044 ya recalculaba el código cuando se asignaba cohorte por primera vez,
-- pero nunca cuando cambiaba la cédula sobre un estudiante que YA tenía
-- código real — porque ese trigger vive en `students` y la cédula está en
-- `profiles`, tabla distinta.
--
-- No se toca la contraseña de auth.users aquí (nunca se escribe esa tabla
-- desde un trigger en este proyecto — demasiado sensible, GoTrue es frágil
-- ante filas mal formadas). Seguir usando "Restablecer contraseña" — ya
-- existe, ya usa la Edge Function correcta — inmediatamente después de
-- corregir una cédula.
-- =============================================================================

create or replace function public.fn_recalcular_student_code_por_cedula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort_id  uuid;
  v_enrollment date;
begin
  if new.cedula is distinct from old.cedula then
    select cohort_id, enrollment_date into v_cohort_id, v_enrollment
    from public.students
    where id = new.id;

    -- Sin fila en students (no es estudiante) o sin cohorte todavía (código
    -- sigue en "ZR-PENDIENTE-...", ver migración 044): nada que recalcular.
    if found and v_cohort_id is not null then
      update public.students
         set student_code = public.set_student_code_calc(new.id, v_cohort_id, v_enrollment)
       where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_recalcular_student_code_por_cedula
  after update on public.profiles
  for each row execute function public.fn_recalcular_student_code_por_cedula();
