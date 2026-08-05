-- =============================================================================
-- ZR APP · MIGRACIÓN 007 · Evaluaciones digitales
-- =============================================================================
-- El tipo de pregunta pertenece a la PREGUNTA, no al examen: un examen real
-- mezcla opción múltiple, verdadero/falso y redacción.
--
-- REGLA DE SEGURIDAD MÁS IMPORTANTE DE ESTE ARCHIVO:
--   exam_questions.correct_answer JAMÁS puede llegar al navegador de un
--   estudiante. Se usa la vista v_exam_questions_student, que no tiene esa
--   columna, más las políticas de RLS de la migración 012.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. exams
-- -----------------------------------------------------------------------------
create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules(id),
  cohort_id        uuid references public.cohorts(id),
  teacher_id       uuid not null references public.teachers(id),
  title            text not null,
  instructions     text,
  status           public.exam_status not null default 'oculto',
  max_score        numeric(4,2) not null default 20,
  passing_score    numeric(4,2) not null default 10,
  opens_at         timestamptz,
  closes_at        timestamptz,
  duration_minutes int check (duration_minutes > 0),   -- null = sin límite
  published_by     uuid references public.teachers(id),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_exams_module on public.exams (module_id);
create index idx_exams_cohort on public.exams (cohort_id);
create index idx_exams_status on public.exams (status);

create trigger trg_exams_updated
  before update on public.exams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. exam_questions
-- -----------------------------------------------------------------------------
-- Formato de 'options'       (solo opcion_multiple):
--   [{"key":"a","text":"Bujía"},{"key":"b","text":"Bobina"}]
-- Formato de 'correct_answer':
--   opcion_multiple  → {"key":"b"}
--   verdadero_falso  → {"value":true}
--   redaccion_abierta→ null
create table public.exam_questions (
  id                uuid primary key default gen_random_uuid(),
  exam_id           uuid not null references public.exams(id) on delete cascade,
  order_index       int  not null,
  type              public.question_type not null,
  statement         text not null,
  options           jsonb,
  correct_answer    jsonb,
  points            numeric(4,2) not null check (points > 0),
  rubric            text,   -- guía de corrección para redacción abierta
  learning_guide_id uuid references public.learning_guides(id),
  created_at        timestamptz not null default now(),
  unique (exam_id, order_index),

  constraint chk_options_required
    check (type <> 'opcion_multiple' or options is not null),
  constraint chk_correct_answer_required
    check (type = 'redaccion_abierta' or correct_answer is not null)
);

create index idx_questions_exam on public.exam_questions (exam_id, order_index);

-- Vista que consume el estudiante. NO incluye correct_answer ni rubric.
create or replace view public.v_exam_questions_student
with (security_invoker = true)
as
select
  q.id,
  q.exam_id,
  q.order_index,
  q.type,
  q.statement,
  q.options,
  q.points
from public.exam_questions q;

-- -----------------------------------------------------------------------------
-- 3. Validación antes de publicar
-- -----------------------------------------------------------------------------
-- No se valida la suma de puntos con una restricción de tabla, porque las
-- preguntas se agregan una por una y quedaría bloqueada a mitad de camino.
-- Se valida en el momento de publicar, que es cuando importa.
create or replace function public.fn_validate_exam_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_sum   numeric;
begin
  if new.status = 'habilitado' and old.status = 'oculto' then
    select count(*), coalesce(sum(points), 0)
      into v_count, v_sum
    from public.exam_questions where exam_id = new.id;

    if v_count = 0 then
      raise exception 'No se puede publicar un examen sin preguntas.';
    end if;

    if v_sum <> new.max_score then
      raise exception
        'La suma de los puntos de las preguntas (%) no coincide con el puntaje máximo del examen (%).',
        v_sum, new.max_score;
    end if;

    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_validate_exam_publish
  before update on public.exams
  for each row execute function public.fn_validate_exam_publish();

-- -----------------------------------------------------------------------------
-- 4. exam_attempts
-- -----------------------------------------------------------------------------
create table public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  status       public.attempt_status not null default 'en_progreso',
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  total_score  numeric(4,2),
  graded_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (exam_id, student_id)
);

create index idx_attempts_student on public.exam_attempts (student_id);
create index idx_attempts_exam    on public.exam_attempts (exam_id);

-- -----------------------------------------------------------------------------
-- 5. exam_answers
-- -----------------------------------------------------------------------------
-- Formato de 'answer':
--   opcion_multiple   → {"key":"b"}
--   verdadero_falso   → {"value":true}
--   redaccion_abierta → {"text":"..."}
create table public.exam_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.exam_attempts(id) on delete cascade,
  question_id      uuid not null references public.exam_questions(id) on delete cascade,
  answer           jsonb,
  awarded_points   numeric(4,2) check (awarded_points >= 0),
  auto_graded      boolean not null default false,
  graded_by        uuid references public.teachers(id),
  graded_at        timestamptz,
  teacher_feedback text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index idx_answers_attempt on public.exam_answers (attempt_id);

create trigger trg_answers_updated
  before update on public.exam_answers
  for each row execute function public.set_updated_at();

create trigger trg_answers_audit
  after insert or update or delete on public.exam_answers
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 6. Cierre automático del intento
-- -----------------------------------------------------------------------------
-- Cuando ninguna respuesta queda sin puntaje, el intento pasa a 'calificado'
-- y se totaliza. Esto corre solo; el frontend no debe totalizar nada.
create or replace function public.fn_close_attempt_if_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending int;
  v_total   numeric;
begin
  select count(*) filter (where awarded_points is null),
         coalesce(sum(awarded_points), 0)
    into v_pending, v_total
  from public.exam_answers
  where attempt_id = new.attempt_id;

  if v_pending = 0 then
    update public.exam_attempts
       set status = 'calificado', total_score = v_total, graded_at = now()
     where id = new.attempt_id and status <> 'calificado';
  else
    update public.exam_attempts
       set total_score = v_total
     where id = new.attempt_id;
  end if;

  return new;
end;
$$;

create trigger trg_close_attempt
  after insert or update of awarded_points on public.exam_answers
  for each row execute function public.fn_close_attempt_if_graded();

alter table public.exams          enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts  enable row level security;
alter table public.exam_answers   enable row level security;
