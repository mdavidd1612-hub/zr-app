-- =============================================================================
-- ZR APP · MIGRACIÓN 009 · Notificaciones
-- =============================================================================
-- CATÁLOGO CERRADO DE FASE 1. Son cuatro tipos y nada más. No agregues otros
-- sin aprobación: el estudiante que recibe ocho avisos un sábado desinstala
-- la aplicación.
--
--   examen_habilitado       → el profesor publicó un examen
--   nota_publicada          → se calificó un intento
--   consentimiento_pendiente→ menor de edad sin consentimiento parental
--   feedback_disponible     → se cerró una sesión y se puede opinar
-- =============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in (
               'examen_habilitado',
               'nota_publicada',
               'consentimiento_pendiente',
               'feedback_disponible'
             )),
  title      text not null,
  body       text not null,
  payload    jsonb,           -- ej. {"exam_id":"..."} para saber a dónde navegar
  channel    public.notification_channel not null default 'in_app',
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notif_profile on public.notifications (profile_id, read_at);
create index idx_notif_unsent  on public.notifications (sent_at) where sent_at is null;

-- Suscripciones de Web Push, una por dispositivo.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_push_profile on public.push_subscriptions (profile_id);

-- -----------------------------------------------------------------------------
-- Notificación automática al publicar un examen
-- -----------------------------------------------------------------------------
create or replace function public.fn_notify_exam_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.status = 'habilitado' and old.status = 'oculto' then
    select 'Nuevo examen: ' || new.title into v_title;

    -- Si el examen es de una cohorte concreta, notifica solo a esa.
    -- Si no lo es, notifica a TODAS las cohortes que cursan ese módulo hoy.
    -- (Antes esto usaba "limit 1" y dejaba sin aviso a las demás cohortes.)
    insert into public.notifications (profile_id, type, title, body, payload)
    select s.id,
           'examen_habilitado',
           v_title,
           'Tu profesor habilitó un examen. Entra a la app para presentarlo.',
           jsonb_build_object('exam_id', new.id)
    from public.students s
    join public.cohorts c on c.id = s.cohort_id
    where (new.cohort_id is not null and s.cohort_id = new.cohort_id)
       or (new.cohort_id is null and c.current_module_id = new.module_id and c.status = 'activa');
  end if;
  return new;
end;
$$;

create trigger trg_notify_exam_published
  after update on public.exams
  for each row execute function public.fn_notify_exam_published();

-- -----------------------------------------------------------------------------
-- Notificación automática al calificar un intento
-- -----------------------------------------------------------------------------
create or replace function public.fn_notify_attempt_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_title text;
begin
  if new.status = 'calificado' and old.status is distinct from 'calificado' then
    select title into v_exam_title from public.exams where id = new.exam_id;

    insert into public.notifications (profile_id, type, title, body, payload)
    values (
      new.student_id,
      'nota_publicada',
      'Ya tienes nota',
      'Se calificó tu examen "' || coalesce(v_exam_title, '') || '".',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_attempt_graded
  after update on public.exam_attempts
  for each row execute function public.fn_notify_attempt_graded();

alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
