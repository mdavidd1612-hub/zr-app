-- =============================================================================
-- ZR APP · MIGRACIÓN 108 · Notas -- panel de Dirección Académica
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026). Dos piezas nuevas, ninguna
-- de las dos toca notas por estudiante -- "el que evalúa es el profesor":
--
--   1. module_evaluation_field_defs — campos evaluativos EXTRA para la
--      sección "General - Por Módulo", más allá de los tres que ya existían
--      (theory_score/practice_score/participation_score, migración 005).
--      Dirección Académica solo define el NOMBRE del campo, nunca un valor
--      por estudiante.
--   2. manual_exam_definitions — el registro de "Por Examen": módulo, fecha,
--      título, escala (por defecto 1-20) y mínimo aprobatorio (por defecto
--      12). Es DISTINTO de `exams`/`exam_attempts` (el examen digital
--      autocalificado, migración 007) -- este es el registro de exámenes que
--      el profesor califica a mano.
--
-- IMPORTANTE, decisión pendiente de confirmar (no inventada, dejada explícita
-- para que Dirección Académica la resuelva): los campos EXTRA que se agreguen
-- aquí NO entran en el cálculo automático de `final_score`
-- (`calc_final_score`, migración 005, fórmula fija con exactamente teoría/
-- práctica/participación). Se guardan y se muestran, pero no alteran la nota
-- final hasta que se decida explícitamente cómo pesarlos.
--
-- El profesor sigue viendo sus estudiantes filtrados por su propia cohorte
-- (public.teaches_cohort, migración 011/087) -- no se toca ese mecanismo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Campos evaluativos extra (solo definición, sin valores por estudiante)
-- -----------------------------------------------------------------------------
create table public.module_evaluation_field_defs (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique check (key ~ '^[a-z0-9_]+$'),
  label      text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.module_evaluation_field_defs enable row level security;

create policy "staff: leer campos evaluativos extra"
  on public.module_evaluation_field_defs for select
  using ((select public.is_staff()));

create policy "direccion: administra campos evaluativos extra"
  on public.module_evaluation_field_defs for all
  using ((select public.is_admin_up()))
  with check ((select public.is_admin_up()));

-- Valores por estudiante de esos campos extra -- los llena el profesor.
create table public.module_evaluation_extra_scores (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.module_enrollments(id) on delete cascade,
  field_def_id  uuid not null references public.module_evaluation_field_defs(id) on delete cascade,
  score         numeric(4,2) check (score between 0 and 20),
  graded_by     uuid references public.profiles(id),
  graded_at     timestamptz not null default now(),
  unique (enrollment_id, field_def_id)
);

create index idx_extra_scores_enrollment on public.module_evaluation_extra_scores (enrollment_id);

alter table public.module_evaluation_extra_scores enable row level security;

create policy "estudiante: leer sus propios extras"
  on public.module_evaluation_extra_scores for select
  using (exists (
    select 1 from public.module_enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy "profesor: calificar extras de su cohorte"
  on public.module_evaluation_extra_scores for all
  using (exists (
    select 1 from public.module_enrollments e
    where e.id = enrollment_id and (select public.teaches_cohort(e.cohort_id))
  ))
  with check (exists (
    select 1 from public.module_enrollments e
    where e.id = enrollment_id and (select public.teaches_cohort(e.cohort_id))
  ));

create policy "direccion: leer todos los extras"
  on public.module_evaluation_extra_scores for select
  using ((select public.is_admin_up()));

-- -----------------------------------------------------------------------------
-- 2. Registro de exámenes manuales ("Por Examen")
-- -----------------------------------------------------------------------------
create table public.manual_exam_definitions (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references public.modules(id),
  exam_date     date not null,
  title         text not null check (length(trim(title)) > 0),
  scale_max     numeric(4,2) not null default 20 check (scale_max > 0),
  passing_min   numeric(4,2) not null default 12 check (passing_min >= 0),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),

  constraint chk_manual_exam_umbral check (passing_min <= scale_max)
);

create index idx_manual_exam_module on public.manual_exam_definitions (module_id);

alter table public.manual_exam_definitions enable row level security;

create policy "staff: leer examenes manuales"
  on public.manual_exam_definitions for select
  using ((select public.is_staff()));

create policy "direccion: administra examenes manuales"
  on public.manual_exam_definitions for all
  using ((select public.is_admin_up()))
  with check ((select public.is_admin_up()));

-- Notas por estudiante de esos exámenes -- las llena el profesor.
create table public.manual_exam_scores (
  id            uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.manual_exam_definitions(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  score         numeric(4,2) not null check (score >= 0),
  graded_by     uuid references public.profiles(id),
  graded_at     timestamptz not null default now(),
  unique (definition_id, student_id)
);

create index idx_manual_exam_scores_def on public.manual_exam_scores (definition_id);
create index idx_manual_exam_scores_student on public.manual_exam_scores (student_id);

-- Un check normal no puede consultar otra tabla (la escala vive en la
-- definición) -- se valida con un trigger en vez de un constraint.
create or replace function public.fn_validar_escala_examen_manual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escala numeric;
begin
  select scale_max into v_escala from public.manual_exam_definitions where id = new.definition_id;
  if v_escala is not null and new.score > v_escala then
    raise exception 'La nota (%) no puede superar la escala del examen (%).', new.score, v_escala;
  end if;
  return new;
end;
$$;

create trigger trg_validar_escala_examen_manual
  before insert or update on public.manual_exam_scores
  for each row execute function public.fn_validar_escala_examen_manual();

alter table public.manual_exam_scores enable row level security;

create policy "estudiante: leer sus propias notas de examen manual"
  on public.manual_exam_scores for select
  using (student_id = auth.uid());

create policy "profesor: calificar examen manual de su cohorte"
  on public.manual_exam_scores for all
  using (exists (
    select 1 from public.students s
    where s.id = student_id and (select public.teaches_cohort(s.cohort_id))
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_id and (select public.teaches_cohort(s.cohort_id))
  ));

create policy "direccion: leer todas las notas de examen manual"
  on public.manual_exam_scores for select
  using ((select public.is_admin_up()));

-- -----------------------------------------------------------------------------
-- 3. Notificación a Dirección Académica cuando el profesor registra notas
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente',
    'material_nuevo',
    'modulo_cambiado',
    'hora_clase',
    'hora_refrigerio',
    'notas_registradas'
  ));

-- Dos variantes: cada tabla dispara con columnas distintas (record NEW no
-- admite un campo que la tabla no tiene, ni con coalesce).
create or replace function public.fn_notify_notas_registradas_directo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_estudiante text;
begin
  select p.full_name into v_nombre_estudiante
  from public.profiles p where p.id = new.student_id;

  insert into public.notifications (profile_id, type, title, body, payload)
  select prof.id,
         'notas_registradas',
         'Notas registradas',
         'El profesor registró notas de ' || coalesce(v_nombre_estudiante, 'un estudiante') || '.',
         '{}'::jsonb
  from public.profiles prof
  where prof.role in ('direccion_academica', 'super_admin');

  return new;
end;
$$;

create or replace function public.fn_notify_notas_registradas_extra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_estudiante text;
begin
  select p.full_name into v_nombre_estudiante
  from public.module_enrollments e
  join public.profiles p on p.id = e.student_id
  where e.id = new.enrollment_id;

  insert into public.notifications (profile_id, type, title, body, payload)
  select prof.id,
         'notas_registradas',
         'Notas registradas',
         'El profesor registró notas de ' || coalesce(v_nombre_estudiante, 'un estudiante') || '.',
         '{}'::jsonb
  from public.profiles prof
  where prof.role in ('direccion_academica', 'super_admin');

  return new;
end;
$$;

create trigger trg_notify_notas_extra
  after insert or update on public.module_evaluation_extra_scores
  for each row execute function public.fn_notify_notas_registradas_extra();

create trigger trg_notify_notas_examen_manual
  after insert or update on public.manual_exam_scores
  for each row execute function public.fn_notify_notas_registradas_directo();

-- También cuando el profesor llena teoría/práctica/participación en la
-- pantalla "General" (module_enrollments ya existe desde la migración 005).
create trigger trg_notify_notas_general
  after update of theory_score, practice_score, participation_score
  on public.module_enrollments
  for each row execute function public.fn_notify_notas_registradas_directo();
