-- =============================================================================
-- ZR APP · MIGRACIÓN 025 · Rehabilitación de exámenes
-- ============================================================================
-- El estudiante solicita rehabilitación si su examen quedó abandonado
-- o si tiene una justificación válida. El profesor (o dirección académica)
-- acepta o rechaza la solicitud. Si la acepta, el intento vuelve a
-- 'en_progreso' con un nuevo límite de tiempo.
-- ============================================================================

create type public.rehabilitation_status as enum ('pendiente', 'aprobada', 'rechazada');

create table public.exam_rehabilitation_requests (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.exam_attempts(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  exam_id         uuid not null references public.exams(id) on delete cascade,
  reason          text not null,
  status          public.rehabilitation_status not null default 'pendiente',
  requested_at    timestamptz not null default now(),
  responded_by    uuid references public.teachers(id),
  responded_at    timestamptz,
  response_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_rehab_attempt on public.exam_rehabilitation_requests(attempt_id);
create index idx_rehab_student on public.exam_rehabilitation_requests(student_id);
create index idx_rehab_status on public.exam_rehabilitation_requests(status);

create trigger trg_rehab_updated
  before update on public.exam_rehabilitation_requests
  for each row execute function public.set_updated_at();

alter table public.exam_rehabilitation_requests enable row level security;

-- Solo el estudiante del intento puede ver su solicitud
create policy "estudiante_lee_su_rehab"
  on public.exam_rehabilitation_requests
  for select
  using (auth.uid() = student_id);

-- Solo personal puede ver todas las solicitudes (para calificar/aprobar)
create policy "personal_lee_todas_rehab"
  on public.exam_rehabilitation_requests
  for all
  using (exists (
    select 1 from public.teachers t
    where t.id = auth.uid()
  ));
