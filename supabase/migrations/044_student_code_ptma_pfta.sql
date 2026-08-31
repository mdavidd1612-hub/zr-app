-- =============================================================================
-- ZR APP · MIGRACIÓN 044 · Código de carnet: formato PTMA/PFTA-AAAA-CC-CCC
-- =============================================================================
-- Reemplaza el formato genérico `ZR-2026-XXX` (migración 039) por el formato
-- real de la academia, tomado de la spec del coordinador:
--   <SEDE>-<AÑO>-<Nº DE COHORTE (2 dígitos)>-<3 dígitos de la cédula>
-- Ej.: PTMA-2026-04-482
--
-- El prefijo de sede sale del PROGRAMA de la cohorte del estudiante (PTMA o
-- PFTA), nunca del cliente. El Nº de cohorte es un correlativo fijo por
-- cohorte (cohorts.code_number, ver abajo) — evita tener que parsear números
-- romanos del nombre. docs/17_PLAN_CONSOLIDADO_CURRICULUM_Y_COORDINADOR.md,
-- Sprint 4.
-- =============================================================================

alter table public.cohorts add column code_number int;

comment on column public.cohorts.code_number is
  'Correlativo de 2 dígitos usado en el código de carnet de sus estudiantes (PTMA-2026-04-...). No es el orden de módulos, es un número fijo por cohorte.';

update public.cohorts set code_number = 1 where name = 'PTMA-2025-I';
update public.cohorts set code_number = 2 where name = 'PTMA-2025-II';
update public.cohorts set code_number = 3 where name = 'PTMA-2026-I';
update public.cohorts set code_number = 4 where name = 'PTMA-2026-II';
update public.cohorts set code_number = 1 where name = 'PFTA-2025-I';
update public.cohorts set code_number = 2 where name = 'PFTA-2026-I · turno mañana';
update public.cohorts set code_number = 3 where name = 'PFTA-2026-I · turno tarde';

-- Lógica común de armado del código, para poder reusarla tanto al insertar
-- (trigger BEFORE INSERT) como al asignar cohorte después (trigger BEFORE
-- UPDATE) — un trigger no se puede invocar directo desde otro.
create or replace function public.set_student_code_calc(p_id uuid, p_cohort_id uuid, p_enrollment_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sede_prefix boolean;
  v_year        int := extract(year from p_enrollment_date)::int;
  v_cohort_num  int;
  v_cedula      text;
  v_base_digits text;
  v_next_num    int;
  v_prefix      text;
  v_code        text;
  v_intentos    int := 0;
begin
  select pr.name like 'PTMA%', co.code_number
    into v_sede_prefix, v_cohort_num
    from public.cohorts co
    join public.programs pr on pr.id = co.program_id
   where co.id = p_cohort_id;

  -- Sin cohorte todavía no se puede armar el prefijo real — código
  -- provisional que se corrige solo en cuanto se asigne cohorte de verdad.
  if v_cohort_num is null then
    return 'ZR-PENDIENTE-' || substr(p_id::text, 1, 8);
  end if;

  v_prefix := case when v_sede_prefix then 'PTMA' else 'PFTA' end;

  select cedula into v_cedula from public.profiles where id = p_id;
  v_base_digits := right(regexp_replace(coalesce(v_cedula, ''), '\D', '', 'g'), 3);
  if v_base_digits = '' then
    v_base_digits := '000';
  end if;
  v_next_num := v_base_digits::int;

  loop
    v_code := v_prefix || '-' || v_year || '-' || lpad(v_cohort_num::text, 2, '0')
      || '-' || lpad((v_next_num % 1000)::text, 3, '0');

    if not exists (select 1 from public.students where student_code = v_code and id <> p_id) then
      exit;
    end if;

    v_next_num := v_next_num + 1;
    v_intentos := v_intentos + 1;
    if v_intentos > 50 then
      raise exception 'No se pudo generar un código de carnet único para %', v_prefix;
    end if;
  end loop;

  return v_code;
end;
$$;

create or replace function public.set_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.student_code is not null then
    return new;
  end if;

  new.student_code := public.set_student_code_calc(new.id, new.cohort_id, new.enrollment_date);
  return new;
end;
$$;

-- Cuando a un estudiante "pendiente" se le asigna cohorte por primera vez,
-- se le recalcula el código real.
create or replace function public.fn_recalcular_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cohort_id is not null and (old.cohort_id is null or old.student_code like 'ZR-PENDIENTE-%') then
    new.student_code := public.set_student_code_calc(new.id, new.cohort_id, new.enrollment_date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalcular_student_code on public.students;
create trigger trg_recalcular_student_code
  before update on public.students
  for each row execute function public.fn_recalcular_student_code();

-- Recalcula ya mismo los códigos de los estudiantes existentes que quedaron
-- reasignados a una cohorte real en la migración 043.
update public.students s
   set student_code = public.set_student_code_calc(s.id, s.cohort_id, s.enrollment_date)
 where s.cohort_id is not null;
