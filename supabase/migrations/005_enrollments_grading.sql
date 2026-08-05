-- =============================================================================
-- ZR APP · MIGRACIÓN 005 · Inscripción a módulos y cálculo de notas
-- =============================================================================
-- Referencia: docs/09_DECISIONES_ARQUITECTONICAS.md · ADR-007
--
-- REGLAS DE LA ACADEMIA (no negociables):
--   · Escala sobre 20 puntos en todo el sistema.
--   · Una evaluación individual aprueba con 10 o más.
--   · Un módulo aprueba con 12 o más, EXCEPTO el primer módulo del programa,
--     que aprueba con 10 o más.
--   · La participación pesa mínimo 5% y la fija cada profesor.
--   · NO EXISTE reprobación automática por inasistencia. Está prohibida.
--     No agregues jamás un contador de faltas que dé de baja a nadie.
--
-- La fórmula reparte el peso de participación descontándolo por igual de teoría
-- y práctica, para que la suma dé exactamente 100%. Si Coordinación Académica
-- decide otra fórmula, se cambia SOLO esta función.
-- =============================================================================

create table public.module_enrollments (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.students(id) on delete cascade,
  module_id            uuid not null references public.modules(id),
  cohort_id            uuid not null references public.cohorts(id),

  theory_score         numeric(4,2) check (theory_score        between 0 and 20),
  practice_score       numeric(4,2) check (practice_score      between 0 and 20),
  participation_score  numeric(4,2) check (participation_score between 0 and 20),

  -- Peso de participación, decidido por el profesor. Mínimo 5%.
  participation_weight numeric(4,3) not null default 0.05
                       check (participation_weight >= 0.05 and participation_weight <= 0.30),

  -- Se COPIA al inscribir, no se calcula al vuelo. Así una nota histórica no
  -- cambia si mañana cambia la política de la academia.
  passing_threshold    numeric(4,2) not null,

  final_score          numeric(4,2),
  status               public.enrollment_status not null default 'en_curso',
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (student_id, module_id)
);

create index idx_enrollments_student on public.module_enrollments (student_id);
create index idx_enrollments_cohort  on public.module_enrollments (cohort_id);

-- -----------------------------------------------------------------------------
-- Cálculo de la nota final
-- -----------------------------------------------------------------------------
create or replace function public.calc_final_score(
  p_theory        numeric,
  p_practice      numeric,
  p_participation numeric,
  p_weight        numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_theory is null or p_practice is null or p_participation is null then null
    else round(
        p_theory        * ((1 - p_weight) / 2)
      + p_practice      * ((1 - p_weight) / 2)
      + p_participation * p_weight
    , 2)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Umbral de aprobación al inscribir
-- -----------------------------------------------------------------------------
create or replace function public.fn_set_passing_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order int;
begin
  if new.passing_threshold is null or new.passing_threshold = 0 then
    select order_index into v_order from public.modules where id = new.module_id;
    if v_order = 1 then
      new.passing_threshold := public.cfg_num('module.passing_threshold_first', 10);
    else
      new.passing_threshold := public.cfg_num('module.passing_threshold_default', 12);
    end if;
  end if;
  return new;
end;
$$;

-- ORDEN DE DISPARADORES: Postgres los ejecuta en orden ALFABÉTICO del nombre.
-- El umbral DEBE calcularse antes que la nota, o el recálculo compararía contra
-- un umbral nulo y marcaría 'reprobado' a quien acaba de inscribirse con notas.
-- Por eso los nombres llevan prefijo numérico. NO los renombres.
create trigger trg_01_set_passing_threshold
  before insert on public.module_enrollments
  for each row execute function public.fn_set_passing_threshold();

-- -----------------------------------------------------------------------------
-- Recalcular nota y estado en cada cambio
-- -----------------------------------------------------------------------------
create or replace function public.fn_recalc_enrollment()
returns trigger
language plpgsql
as $$
begin
  new.final_score := public.calc_final_score(
    new.theory_score, new.practice_score, new.participation_score, new.participation_weight
  );

  -- El estado solo se mueve automáticamente entre 'en_curso', 'aprobado' y
  -- 'reprobado'. 'retirado' lo pone un administrador a mano y no se toca aquí.
  if new.status <> 'retirado' then
    if new.final_score is null then
      new.status := 'en_curso';
      new.approved_at := null;
    elsif new.final_score >= new.passing_threshold then
      new.status := 'aprobado';
      new.approved_at := coalesce(new.approved_at, now());
    else
      new.status := 'reprobado';
      new.approved_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_02_recalc_enrollment
  before insert or update on public.module_enrollments
  for each row execute function public.fn_recalc_enrollment();

create trigger trg_03_enrollments_updated
  before update on public.module_enrollments
  for each row execute function public.set_updated_at();

-- Toda nota que cambia queda registrada con su valor anterior y posterior.
create trigger trg_enrollments_audit
  after insert or update or delete on public.module_enrollments
  for each row execute function public.fn_audit();

alter table public.module_enrollments enable row level security;
