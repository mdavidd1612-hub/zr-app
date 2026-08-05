-- =============================================================================
-- ZR APP · MIGRACIÓN 008 · Repositorio de contenido y feedback
-- =============================================================================
-- El contenido vive en Supabase Storage, bucket privado 'contenido'.
-- No se integra Google Classroom (ver ADR-004). Mientras dure la transición,
-- se puede apuntar a Classroom con content_items.type = 'enlace'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. content_items
-- -----------------------------------------------------------------------------
create table public.content_items (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.modules(id) on delete cascade,
  week_number       int,
  learning_guide_id uuid references public.learning_guides(id),
  title             text not null,
  description       text,
  type              public.content_type not null,
  storage_path      text,   -- ruta dentro del bucket 'contenido'
  external_url      text,   -- solo si type = 'enlace'
  size_bytes        bigint,
  uploaded_by       uuid not null references public.profiles(id),
  visible_from      timestamptz,
  is_published      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_content_source
    check (
      (type = 'enlace' and external_url is not null)
      or (type <> 'enlace' and storage_path is not null)
    )
);

create index idx_content_module on public.content_items (module_id, week_number);
create index idx_content_pub    on public.content_items (is_published) where is_published;

create trigger trg_content_updated
  before update on public.content_items
  for each row execute function public.set_updated_at();

create trigger trg_content_audit
  after insert or update or delete on public.content_items
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 2. content_views — alimenta el reporte de uso del repositorio
-- -----------------------------------------------------------------------------
create table public.content_views (
  id              uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  viewed_at       timestamptz not null default now()
);

create index idx_views_content on public.content_views (content_item_id);
create index idx_views_student on public.content_views (student_id);

-- -----------------------------------------------------------------------------
-- 3. feedback_micro — máximo 3 preguntas, menos de 20 segundos
-- -----------------------------------------------------------------------------
-- Apunta a la SESIÓN, no al evento de asistencia. Así puede dar feedback quien
-- asistió pero no llegó a escanear.
--
-- Formato de 'answers':
--   [{"q":"¿Se entendió la clase?","a":4},{"q":"¿El taller tenía lo necesario?","a":3}]
create table public.feedback_micro (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  session_id   uuid not null references public.class_sessions(id) on delete cascade,
  answers      jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index idx_feedback_session on public.feedback_micro (session_id);

-- Tope de preguntas, leído de system_config.
create or replace function public.fn_validate_feedback_micro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int := public.cfg_int('feedback.micro_max_questions', 3);
begin
  if jsonb_typeof(new.answers) <> 'array' then
    raise exception 'feedback_micro.answers debe ser un arreglo JSON.';
  end if;
  if jsonb_array_length(new.answers) > v_max then
    raise exception 'El feedback micro admite como máximo % preguntas.', v_max;
  end if;
  return new;
end;
$$;

create trigger trg_validate_feedback_micro
  before insert or update on public.feedback_micro
  for each row execute function public.fn_validate_feedback_micro();

-- -----------------------------------------------------------------------------
-- 4. Vista agregada de feedback para el profesor
-- -----------------------------------------------------------------------------
-- El profesor NUNCA ve respuestas individuales. Solo el promedio del grupo, y
-- solo si hay suficientes respuestas para que nadie sea identificable.
-- Si viera quién dijo qué, nadie diría la verdad.
create or replace view public.v_feedback_session_summary
with (security_invoker = true)
as
select
  f.session_id,
  count(*) as response_count,
  round(avg((ans->>'a')::numeric), 2) as avg_score,
  ans->>'q' as question
from public.feedback_micro f
cross join lateral jsonb_array_elements(f.answers) as ans
group by f.session_id, ans->>'q'
having count(*) >= public.cfg_int('feedback.min_responses_to_show', 3);

-- -----------------------------------------------------------------------------
-- 5. feedback_macro — por módulo
-- -----------------------------------------------------------------------------
create table public.feedback_macro (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  module_id    uuid not null references public.modules(id) on delete cascade,
  open_text    text,
  badge_issued boolean not null default false,  -- [FASE 2]
  badge_url    text,                            -- [FASE 2]
  submitted_at timestamptz not null default now(),
  unique (student_id, module_id)
);

alter table public.content_items  enable row level security;
alter table public.content_views  enable row level security;
alter table public.feedback_micro enable row level security;
alter table public.feedback_macro enable row level security;
