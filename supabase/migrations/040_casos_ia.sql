-- =============================================================================
-- ZR APP · MIGRACIÓN 040 · Casos generados por IA + registro de quién los trabajó
-- =============================================================================
-- Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint D). Dos tablas:
--  1. ai_cases — un caso por día de semana (1=lunes…5=viernes) y módulo,
--     generado por la Edge Function `generar-casos` (NVIDIA NIM). Reemplaza
--     al banco fijo de lib/casos-fase0.ts cuando existe uno para el módulo
--     actual del estudiante.
--  2. case_completions — quién trabajó el caso cada día. Antes solo vivía
--     en localStorage del estudiante (Fase 0 estudiante, Sprint 2); el
--     profesor necesita el % agregado, así que ahora también se guarda acá.
--     Nunca se expone el nombre del estudiante al profesor — solo el conteo.
-- =============================================================================

create table public.ai_cases (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules(id) on delete cascade,
  weekday      int  not null check (weekday between 1 and 5), -- 1=lunes … 5=viernes
  titulo       text not null,
  escenario    text not null,
  preguntas    jsonb not null, -- [{pregunta, opciones[], correcta}, ...]
  reflexion    text not null,
  referencia   jsonb not null, -- {que, porQueNo[], quedaClaro}
  generated_by uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  unique (module_id, weekday)
);

create table public.case_completions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  case_date   date not null,
  weekday     int  not null check (weekday between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (student_id, case_date)
);

create index idx_case_completions_date on public.case_completions (case_date);

alter table public.ai_cases enable row level security;
alter table public.case_completions enable row level security;

-- ai_cases: todo el mundo autenticado lee (es contenido del módulo, no hay
-- nada sensible); solo personal puede escribir (la Edge Function usa la
-- clave de servicio, así que esto es un respaldo por si se lee/escribe
-- directo desde el cliente en algún momento).
create policy leer_casos_ia
  on public.ai_cases for select
  to authenticated
  using (true);

create policy staff_escribe_casos_ia
  on public.ai_cases for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- case_completions: el estudiante solo registra y lee lo suyo. El personal
-- lee todo (para el % agregado), nunca escribe a nombre de otro.
create policy estudiante_registra_su_caso
  on public.case_completions for insert
  to authenticated
  with check (student_id = auth.uid());

create policy estudiante_lee_su_caso
  on public.case_completions for select
  to authenticated
  using (student_id = auth.uid());

create policy staff_lee_casos_completados
  on public.case_completions for select
  to authenticated
  using (public.is_staff());
