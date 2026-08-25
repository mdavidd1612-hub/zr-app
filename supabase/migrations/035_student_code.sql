-- =============================================================================
-- ZR APP · MIGRACIÓN 035 · Código de carnet del estudiante
-- =============================================================================
-- Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 6): cada estudiante recibe un
-- código consecutivo tipo ZR-2026-001, ZR-2026-002… al crearse su perfil.
-- Se genera en el servidor (trigger), nunca en el cliente — regla 2 y 5 de
-- AGENTS.md. El correlativo es por año de inscripción (enrollment_date), y
-- se calcula contando cuántos estudiantes ya tienen código de ese año — a la
-- escala de esta academia (decenas de altas por año) no hace falta más.
-- =============================================================================

alter table public.students
  add column student_code text unique;

create or replace function public.set_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from new.enrollment_date)::int;
  v_next int;
begin
  if new.student_code is not null then
    return new;
  end if;

  select count(*) + 1 into v_next
  from public.students
  where student_code like 'ZR-' || v_year || '-%';

  new.student_code := 'ZR-' || v_year || '-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

create trigger trg_students_code
  before insert on public.students
  for each row execute function public.set_student_code();

-- Backfill: los estudiantes que ya existen también reciben su código,
-- en orden de inscripción, para no dejar carnets sin código.
do $$
declare
  r record;
  v_year int;
  v_seq int;
begin
  for r in
    select id, enrollment_date
    from public.students
    where student_code is null
    order by enrollment_date, created_at
  loop
    v_year := extract(year from r.enrollment_date)::int;
    select count(*) + 1 into v_seq
    from public.students
    where student_code like 'ZR-' || v_year || '-%';

    update public.students
    set student_code = 'ZR-' || v_year || '-' || lpad(v_seq::text, 3, '0')
    where id = r.id;
  end loop;
end $$;
