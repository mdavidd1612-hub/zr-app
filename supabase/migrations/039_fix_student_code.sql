-- =============================================================================
-- ZR APP · MIGRACIÓN 039 · Arregla la generación del código de carnet
-- =============================================================================
-- 035_student_code.sql contaba filas (count(*) + 1) para el siguiente
-- correlativo. Eso rompe apenas se borra un estudiante: el conteo baja,
-- pero el código más alto ya usado sigue igual, así que el siguiente
-- registro intenta reusar un código que ya existe y el registro falla
-- (23505 duplicate key) — es lo que le pasó al profesor de prueba.
--
-- Se cambia a tomar el MÁXIMO correlativo ya usado ese año (no la cantidad
-- de filas), y se agrega un reintento por si dos altas chocan al mismo
-- tiempo — con eso ya no importa cuántos estudiantes se borren.
-- =============================================================================

create or replace function public.set_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from new.enrollment_date)::int;
  v_prefix text := 'ZR-' || v_year || '-';
  v_next   int;
  v_intentos int := 0;
begin
  if new.student_code is not null then
    return new;
  end if;

  loop
    select coalesce(max(substring(student_code from length(v_prefix) + 1)::int), 0) + 1
    into v_next
    from public.students
    where student_code like v_prefix || '%';

    new.student_code := v_prefix || lpad(v_next::text, 3, '0');

    -- Si otra alta tomó ese mismo número justo ahora, se reintenta con el
    -- máximo actualizado en vez de fallar el registro completo.
    if not exists (select 1 from public.students where student_code = new.student_code) then
      exit;
    end if;

    v_intentos := v_intentos + 1;
    if v_intentos > 20 then
      raise exception 'No se pudo generar un código de carnet único para %', v_prefix;
    end if;
  end loop;

  return new;
end;
$$;
