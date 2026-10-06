-- =============================================================================
-- ZR APP · MIGRACIÓN 126 · Notas: el profesor envía, Dirección Académica valida
-- =============================================================================
-- Reunión de sept. 2026: el profesor carga y confirma ("Enviar"), pero el
-- estudiante NO ve la nota hasta que Dirección Académica la valide.
--
--   (sin fila)  → el profesor está cargando; el estudiante no ve nada.
--   'enviado'   → el profesor confirmó; queda bloqueado para él y espera a
--                 Dirección Académica. El estudiante sigue sin ver nada.
--   'validado'  → Dirección Académica aprobó; el estudiante ya ve sus notas.
--
-- Dirección Académica puede "devolver" (borra la fila) para que el profesor
-- corrija. Todo pasa por funciones de servidor: nadie escribe la tabla
-- directamente desde el navegador (regla 2 de CLAUDE.md).
-- =============================================================================

create table public.grade_submissions (
  cohort_id    uuid not null references public.cohorts(id) on delete cascade,
  module_id    uuid not null references public.modules(id) on delete cascade,
  status       text not null check (status in ('enviado', 'validado')),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  primary key (cohort_id, module_id)
);

alter table public.grade_submissions enable row level security;

create policy "personal: ver envios de su cohorte"
  on public.grade_submissions for select
  to authenticated
  using ((select public.teaches_cohort(cohort_id)));

create policy "estudiante: ver el estado de su cohorte"
  on public.grade_submissions for select
  to authenticated
  using (cohort_id = (select public.my_cohort_id()));

-- ----------------------------------------------------------- acciones (RPC)
create or replace function public.enviar_notas(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.teaches_cohort(p_cohort)) then
    raise exception 'No tienes a cargo esta cohorte.';
  end if;
  if (select public.auth_role()) not in ('profesor', 'direccion_academica', 'super_admin', 'admin') then
    raise exception 'Solo el personal académico puede enviar notas.';
  end if;
  if exists (select 1 from public.grade_submissions where cohort_id = p_cohort and module_id = p_module and status = 'validado') then
    raise exception 'Estas notas ya fueron validadas.';
  end if;

  insert into public.grade_submissions (cohort_id, module_id, status, submitted_by)
  values (p_cohort, p_module, 'enviado', auth.uid())
  on conflict (cohort_id, module_id) do update
    set status = 'enviado', submitted_by = auth.uid(), submitted_at = now(),
        validated_by = null, validated_at = null;
end;
$$;

create or replace function public.validar_notas(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede validar notas.';
  end if;

  update public.grade_submissions
  set status = 'validado', validated_by = auth.uid(), validated_at = now()
  where cohort_id = p_cohort and module_id = p_module and status = 'enviado';

  if not found then
    raise exception 'No hay notas enviadas para validar.';
  end if;
end;
$$;

create or replace function public.devolver_notas(p_cohort uuid, p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_academico()) then
    raise exception 'Solo Dirección Académica puede devolver notas.';
  end if;
  delete from public.grade_submissions where cohort_id = p_cohort and module_id = p_module;
end;
$$;

-- ---------------------------------------- el estudiante solo ve lo validado
drop policy "estudiante: leer sus notas" on public.module_enrollments;
create policy "estudiante: leer sus notas validadas"
  on public.module_enrollments for select
  to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.grade_submissions g
      where g.cohort_id = module_enrollments.cohort_id
        and g.module_id = module_enrollments.module_id
        and g.status = 'validado'
    )
  );

-- ------------------------------- el profesor no toca notas ya enviadas
create or replace function public.fn_bloquear_notas_enviadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_module uuid;
  v_cohort uuid;
begin
  if (select public.auth_role()) <> 'profesor' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'manual_exam_scores' then
    v_student := coalesce(new.student_id, old.student_id);
    select module_id into v_module from public.manual_exam_definitions
      where id = coalesce(new.definition_id, old.definition_id);
  else
    v_student := coalesce(new.student_id, old.student_id);
    v_module := coalesce(new.module_id, old.module_id);
  end if;
  select cohort_id into v_cohort from public.students where id = v_student;

  if exists (
    select 1 from public.grade_submissions
    where cohort_id = v_cohort and module_id = v_module
  ) then
    raise exception 'Las notas ya fueron enviadas a Dirección Académica. Pide que te las devuelvan para corregir.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_bloquear_notas_enviadas_scores
  before insert or update or delete on public.manual_exam_scores
  for each row execute function public.fn_bloquear_notas_enviadas();

create trigger trg_bloquear_notas_enviadas_participacion
  before update of class_participation_score on public.module_enrollments
  for each row execute function public.fn_bloquear_notas_enviadas();
