-- 237 · Cursos cortos = programa de un solo módulo (20-nov-2026, coordinador:
-- "se crean igual, se registran igual, tienen un profesor... como si fuera un
-- solo módulo"). Reemplaza la tabla suelta `short_courses` de la 236.
--
-- Un curso es una fila de `programs` con tipo = 'curso' y exactamente un
-- módulo. Sus cortes (cohorts) usan todo lo existente: inscripción, carnet,
-- asistencia, Unidades, exámenes, notas, cobertura y calendario.

drop table if exists public.short_courses;

alter table public.programs
  add column if not exists tipo text not null default 'programa'
  check (tipo in ('programa', 'curso'));

-- Antes cada sede tenía un único programa (R-20). Un curso se dicta en una
-- sede que ya tiene su programa, así que la sede deja de ser única. Los
-- programas largos siguen naciendo con su sede en /catalogo.
alter table public.programs drop constraint if exists programs_sede_id_key;
create index if not exists programs_sede_id_idx on public.programs (sede_id);

create or replace function public.crear_curso(
  p_nombre text, p_siglas text, p_sede uuid, p_semanas int, p_descripcion text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica o super admin pueden crear cursos.';
  end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre del curso.'; end if;
  if coalesce(p_semanas, 0) < 1 then raise exception 'La duración debe ser de al menos 1 semana.'; end if;

  insert into public.programs (name, siglas, sede_id, tipo, total_modules, total_duration_months)
  values (trim(p_nombre), upper(trim(p_siglas)), p_sede, 'curso', 1, greatest(1, ceil(p_semanas / 4.0)::int))
  returning id into v_id;

  insert into public.modules (program_id, order_index, name, description, duration_weeks, inces_homologado)
  values (v_id, 1, trim(p_nombre), nullif(trim(coalesce(p_descripcion, '')), ''), p_semanas, false);

  return v_id;
end;
$$;
revoke execute on function public.crear_curso(text, text, uuid, int, text) from anon;
