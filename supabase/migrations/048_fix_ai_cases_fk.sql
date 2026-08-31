-- =============================================================================
-- ZR APP · MIGRACIÓN 048 · ai_cases.generated_by → SET NULL ON DELETE
-- =============================================================================
-- Se nos pasó en la migración 040: igual que el resto de columnas "quién hizo
-- X" (migración 029), borrar un profesor no debe bloquearse porque generó un
-- caso alguna vez.
-- =============================================================================

alter table public.ai_cases
  drop constraint if exists ai_cases_generated_by_fkey;
alter table public.ai_cases
  add constraint ai_cases_generated_by_fkey
    foreign key (generated_by) references public.profiles(id) on delete set null;
