-- =============================================================================
-- ZR APP · MIGRACIÓN 067 · programs.siglas — cierra el hueco de R-21
-- =============================================================================
-- Antes de esto, `set_student_code_calc()` (migración 044) decidía el
-- prefijo del código de carnet con `pr.name like 'PTMA%'` y caía a 'PFTA'
-- para CUALQUIER programa que no empezara por 'PTMA' — incluido uno nuevo
-- que todavía no existe. El mismo defecto lo tenía `fn_set_cohort_code_number`
-- (migración 060) para el nombre de la cohorte, con `split_part(name,' ',1)`.
--
-- Los dos se arreglan aquí, antes de que exista una pantalla para crear
-- programas (R-21): sin esto, dar de alta un tercer programa sería peligroso
-- en silencio — sus estudiantes recibirían códigos 'PFTA-…' sin que nadie lo
-- notara hasta revisar un carnet de cerca.
-- =============================================================================

alter table public.programs
  add column siglas text;

-- 3 a 5 letras mayúsculas — lo que pidió la reunión (`PTMA` vs `PFTA` deben
-- distinguirse) y lo que necesita el prefijo del carnet.
alter table public.programs
  add constraint chk_programs_siglas_formato check (siglas ~ '^[A-Z]{3,5}$');

update public.programs set siglas = 'PTMA' where name like 'PTMA%';
update public.programs set siglas = 'PFTA' where name like 'PFTA%';

alter table public.programs
  alter column siglas set not null;

alter table public.programs
  add constraint programs_siglas_key unique (siglas);

comment on column public.programs.siglas is
  'Prefijo del código de carnet de sus estudiantes (PTMA-2026-02-XXX). Únicas, 3-5 letras mayúsculas. Nunca se deriva del nombre — eso fue el bug que dejaba caer cualquier programa nuevo a PFTA.';

-- -----------------------------------------------------------------------------
-- set_student_code_calc(): lee siglas, ya no adivina con LIKE
-- -----------------------------------------------------------------------------
create or replace function public.set_student_code_calc(p_id uuid, p_cohort_id uuid, p_enrollment_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_siglas      text;
  v_year        int := extract(year from p_enrollment_date)::int;
  v_cohort_num  int;
  v_cedula      text;
  v_base_digits text;
  v_next_num    int;
  v_code        text;
  v_intentos    int := 0;
begin
  select pr.siglas, co.code_number
    into v_siglas, v_cohort_num
    from public.cohorts co
    join public.programs pr on pr.id = co.program_id
   where co.id = p_cohort_id;

  if v_cohort_num is null then
    return 'ZR-PENDIENTE-' || substr(p_id::text, 1, 8);
  end if;

  select cedula into v_cedula from public.profiles where id = p_id;
  v_base_digits := right(regexp_replace(coalesce(v_cedula, ''), '\D', '', 'g'), 3);
  if v_base_digits = '' then
    v_base_digits := '000';
  end if;
  v_next_num := v_base_digits::int;

  loop
    v_code := v_siglas || '-' || v_year || '-' || lpad(v_cohort_num::text, 2, '0')
      || '-' || lpad((v_next_num % 1000)::text, 3, '0');

    if not exists (select 1 from public.students where student_code = v_code and id <> p_id) then
      exit;
    end if;

    v_next_num := v_next_num + 1;
    v_intentos := v_intentos + 1;
    if v_intentos > 50 then
      raise exception 'No se pudo generar un código de carnet único para %', v_siglas;
    end if;
  end loop;

  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- fn_set_cohort_code_number(): mismo arreglo para el NOMBRE de la cohorte
-- -----------------------------------------------------------------------------
create or replace function public.fn_set_cohort_code_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_siglas text;
begin
  if new.code_number is null then
    select coalesce(max(c.code_number), 0) + 1
      into new.code_number
      from public.cohorts c
     where c.program_id = new.program_id
       and extract(year from c.start_date) = extract(year from new.start_date);
  end if;

  if new.name is null or btrim(new.name) = '' then
    select p.siglas
      into v_siglas
      from public.programs p
     where p.id = new.program_id;

    new.name := coalesce(v_siglas, 'COHORTE')
      || '-' || extract(year from new.start_date)::int
      || '-' || public.a_romano(new.code_number);
  end if;

  return new;
end;
$$;
