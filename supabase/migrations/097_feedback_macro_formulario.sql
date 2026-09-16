-- =============================================================================
-- ZR APP · MIGRACIÓN 097 · Formulario de feedback por módulo
-- =============================================================================
-- Pedido explícito del coordinador (sept. 2026): la tabla `feedback_macro`
-- ya existía (migración 008) pero nunca se conectó a ninguna pantalla --
-- solo tenía un campo de texto libre. Esta migración la completa:
--
-- 1. `answers` (jsonb): preguntas cerradas, mismo formato que ya usa
--    `feedback_micro` -- [{"q":"...", "a":4}, ...]. `open_text` se queda
--    para un comentario final opcional.
-- 2. `feedback_macro_windows`: Dirección Académica "abre" el formulario para
--    una cohorte+módulo específicos (no puede ser global -- cada cohorte
--    termina un módulo en fecha distinta). El estudiante solo puede
--    responder mientras esté abierta.
-- 3. `v_feedback_macro_summary`: agregado por pregunta, nunca respuesta por
--    estudiante -- mismo criterio que `v_feedback_session_summary`
--    (feedback_micro): con menos de `feedback.min_responses_to_show`
--    respuestas, no se muestra nada (nadie identificable). Vista SIN
--    security_invoker a propósito: el profesor todavía no tiene permiso de
--    leer `feedback_macro` directamente (por diseño, nunca lo va a tener --
--    solo el agregado), así que el control de acceso vive en el WHERE de la
--    vista, no en RLS de la tabla base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Preguntas estructuradas
-- -----------------------------------------------------------------------------
alter table public.feedback_macro
  add column answers jsonb not null default '[]'::jsonb;

create or replace function public.fn_validate_feedback_macro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int := public.cfg_int('feedback.macro_max_questions', 6);
begin
  if jsonb_typeof(new.answers) <> 'array' then
    raise exception 'feedback_macro.answers debe ser un arreglo JSON.';
  end if;
  if jsonb_array_length(new.answers) > v_max then
    raise exception 'El feedback de módulo admite como máximo % preguntas.', v_max;
  end if;
  return new;
end;
$$;

create trigger trg_validate_feedback_macro
  before insert or update on public.feedback_macro
  for each row execute function public.fn_validate_feedback_macro();

-- Las preguntas en sí -- nunca hardcodeadas en el código (regla 5 de
-- AGENTS.md), editables desde Configuración sin desplegar nada nuevo.
-- Placeholder razonable hasta que el coordinador mande el set real.
insert into public.system_config (key, value, description, is_public) values
  ('feedback.macro_questions',
   '[
     {"id":"claridad",   "texto":"¿Qué tan claro estuvo el contenido del módulo?",              "tipo":"escala_1_5"},
     {"id":"utilidad",   "texto":"¿Qué tan útil te pareció para lo que vas a hacer en el taller?", "tipo":"escala_1_5"},
     {"id":"ritmo",      "texto":"¿El ritmo de las clases fue el adecuado?",                       "tipo":"escala_1_5"}
   ]'::jsonb,
   'Preguntas del formulario de feedback por módulo (escala 1-5). Editable sin desplegar código.',
   false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Ventana de feedback abierta, por cohorte + módulo
-- -----------------------------------------------------------------------------
create table public.feedback_macro_windows (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  module_id  uuid not null references public.modules(id) on delete cascade,
  opened_by  uuid references public.profiles(id) on delete set null,
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz,
  unique (cohort_id, module_id)
);

create index idx_fmw_cohort_module on public.feedback_macro_windows (cohort_id, module_id);

alter table public.feedback_macro_windows enable row level security;

create policy "academico: gestiona ventanas de feedback"
  on public.feedback_macro_windows for all to authenticated
  using ((select public.is_academico()))
  with check ((select public.is_academico()));

create policy "estudiante: lee la ventana de su cohorte"
  on public.feedback_macro_windows for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.cohort_id = feedback_macro_windows.cohort_id
  ));

create policy "profesor: lee ventanas de su modulo"
  on public.feedback_macro_windows for select to authenticated
  using (exists (
    select 1 from public.teacher_module_assignments tma
    where tma.module_id = feedback_macro_windows.module_id and tma.teacher_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- 3. El estudiante solo puede responder mientras la ventana de SU cohorte
--    para ESE módulo esté abierta -- antes se podía insertar en cualquier
--    momento para cualquier módulo, sin que nadie lo hubiera "desplegado".
-- -----------------------------------------------------------------------------
drop policy "estudiante: escribir feedback macro" on public.feedback_macro;
create policy "estudiante: escribir feedback macro"
  on public.feedback_macro for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1
      from public.students s
      join public.feedback_macro_windows w
        on w.cohort_id = s.cohort_id and w.module_id = feedback_macro.module_id
      where s.id = auth.uid() and w.closed_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Resumen agregado -- nunca respuesta por estudiante. Dirección Académica
--    ve cualquier cohorte/módulo; el profesor solo el suyo. Sin
--    security_invoker: el control de acceso vive aquí, no en la tabla base.
-- -----------------------------------------------------------------------------
create view public.v_feedback_macro_summary
as
select
  s.cohort_id,
  fm.module_id,
  c.name as cohort_name,
  m.name as module_name,
  q ->> 'q' as question,
  count(distinct fm.student_id) as response_count,
  round(avg((q ->> 'a')::numeric), 2) as avg_score
from public.feedback_macro fm
join public.students s on s.id = fm.student_id
join public.cohorts  c on c.id = s.cohort_id
join public.modules  m on m.id = fm.module_id
cross join lateral jsonb_array_elements(fm.answers) as q
where
  (select public.is_academico())
  or exists (
    select 1 from public.teacher_module_assignments tma
    where tma.module_id = fm.module_id and tma.teacher_id = auth.uid()
  )
group by s.cohort_id, fm.module_id, c.name, m.name, q ->> 'q'
having count(distinct fm.student_id) >= public.cfg_int('feedback.min_responses_to_show', 3);

grant select on public.v_feedback_macro_summary to authenticated;
