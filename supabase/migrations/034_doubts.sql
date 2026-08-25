-- =============================================================================
-- ZR APP · MIGRACIÓN 034 · Dudas (Fase 0, docs/14_FASE0_PLAN_SPRINTS.md Sprint 5)
-- =============================================================================
-- El estudiante manda una duda corta; puede editarla o borrarla mientras es
-- suya. El profesor las agrupa y responde el sábado (esa pantalla de
-- profesor no se construye en esta fase, solo la tabla y el lado estudiante).
-- =============================================================================

create table public.doubts (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  body       text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_doubts_student on public.doubts (student_id);

create trigger trg_doubts_updated
  before update on public.doubts
  for each row execute function public.set_updated_at();

alter table public.doubts enable row level security;

-- El estudiante lee, crea, edita y borra únicamente sus propias dudas.
create policy doubts_select_own
  on public.doubts for select
  to authenticated
  using (student_id = auth.uid());

create policy doubts_insert_own
  on public.doubts for insert
  to authenticated
  with check (student_id = auth.uid());

create policy doubts_update_own
  on public.doubts for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy doubts_delete_own
  on public.doubts for delete
  to authenticated
  using (student_id = auth.uid());

-- Profesores y administración leen todas las dudas (para agruparlas y
-- responder el sábado). Sin política de escritura: no editan ni borran
-- dudas ajenas.
create policy doubts_select_staff
  on public.doubts for select
  to authenticated
  using (public.is_staff());
