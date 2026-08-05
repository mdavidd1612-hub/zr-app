-- =============================================================================
-- ZR APP · MIGRACIÓN 014 · Mapa de dominio (competencias del estudiante)
-- =============================================================================
-- Añadido a Fase 1 por decisión del 30/07/2026.
-- Justificación: docs/13_DISENO_DE_PRODUCTO_ESTUDIANTE.md §3.2
--
-- Es la única parte del sistema que ataca directamente la PERCEPCIÓN DE
-- COMPETENCIA, que la propia documentación de la academia identifica como la
-- variable que más predice motivación sostenida (docs/06_ §1).
--
-- Un estudiante de mecánica no quiere puntos. Quiere saber que ya sabe hacer
-- algo. Esta tabla es la que se lo muestra.
--
-- ALCANCE DE FASE 1: solo estado de dominio por competencia.
-- NO se construyen puntos, insignias, canjes ni rachas. Eso es Fase 2.
-- =============================================================================

create type public.mastery_status as enum (
  'no_iniciado',
  'en_progreso',
  'dominado'
);

-- Cómo se verificó el dominio. En Fase 1 solo existe la evaluación práctica:
-- es la única fuente que no depende de que el estudiante se autocalifique.
create type public.mastery_source as enum (
  'evaluacion_practica',   -- el profesor lo marca tras la práctica de taller
  'evaluacion_teorica',    -- derivado de una pregunta ligada a la competencia
  'micro_learning'         -- [FASE 2] no se usa todavía
);

create table public.mastery_map (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students(id) on delete cascade,
  learning_guide_id uuid not null references public.learning_guides(id) on delete cascade,
  status            public.mastery_status not null default 'no_iniciado',
  dominated_via     public.mastery_source,
  marked_by         uuid references public.teachers(id),
  marked_at         timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (student_id, learning_guide_id)
);

create index idx_mastery_student on public.mastery_map (student_id);
create index idx_mastery_guide   on public.mastery_map (learning_guide_id);

create trigger trg_mastery_updated
  before update on public.mastery_map
  for each row execute function public.set_updated_at();

create trigger trg_mastery_audit
  after insert or update or delete on public.mastery_map
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- Coherencia: si se marca 'dominado', hay que decir cómo se verificó
-- -----------------------------------------------------------------------------
create or replace function public.fn_mastery_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'dominado' then
    if new.dominated_via is null then
      raise exception 'Para marcar una competencia como dominada hay que indicar cómo se verificó.';
    end if;
    new.marked_at := coalesce(new.marked_at, now());
  else
    new.dominated_via := null;
    new.marked_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_mastery_guard
  before insert or update on public.mastery_map
  for each row execute function public.fn_mastery_guard();

-- -----------------------------------------------------------------------------
-- Vista: mapa de dominio del estudiante en su módulo actual
-- -----------------------------------------------------------------------------
-- Devuelve TODAS las competencias del módulo, tenga o no fila en mastery_map.
-- Así el estudiante ve la lista completa desde el primer día, con lo pendiente
-- marcado como pendiente en vez de con la pantalla vacía.
create or replace view public.v_mi_dominio
with (security_invoker = true)
as
select
  s.id                                        as student_id,
  lg.module_id,
  m.name                                      as module_name,
  lg.id                                       as learning_guide_id,
  lg.week_number,
  lg.order_in_week,
  lg.sub_competency_name,
  coalesce(mm.status, 'no_iniciado')          as status,
  mm.dominated_via,
  mm.marked_at
from public.students s
join public.cohorts c        on c.id = s.cohort_id
join public.modules m        on m.id = c.current_module_id
join public.learning_guides lg on lg.module_id = m.id
left join public.mastery_map mm
       on mm.student_id = s.id and mm.learning_guide_id = lg.id
order by lg.week_number, lg.order_in_week;

-- -----------------------------------------------------------------------------
-- Vista: qué toca el próximo sábado
-- -----------------------------------------------------------------------------
-- No necesita ninguna tabla nueva. El dato ya existe en learning_guides y hoy
-- se transmite de palabra al final de la clase, cuando ya nadie está prestando
-- atención. Ver docs/13_ §3.1.
create or replace view public.v_proximo_sabado
with (security_invoker = true)
as
select distinct on (s.id)
  s.id                              as student_id,
  cs.id                             as session_id,
  cs.session_date,
  cs.week_number,
  m.name                            as module_name,
  lg.sub_competency_name,
  lg.pre_practice_description,
  lg.practice_description,
  lg.id                             as learning_guide_id
from public.students s
join public.cohorts c         on c.id = s.cohort_id
join public.class_sessions cs on cs.cohort_id = c.id
join public.modules m         on m.id = cs.module_id
left join public.learning_guides lg
       on lg.module_id = cs.module_id
      and lg.week_number = cs.week_number
      and lg.order_in_week = 1
where cs.session_date >= current_date
  and cs.status in ('programada','abierta')
order by s.id, cs.session_date asc;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.mastery_map enable row level security;

create policy "estudiante: leer su dominio"
  on public.mastery_map for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer dominio de su cohorte"
  on public.mastery_map for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy "personal: marcar dominio de su cohorte"
  on public.mastery_map for insert to authenticated
  with check ((select public.can_see_student(student_id)));

create policy "personal: actualizar dominio de su cohorte"
  on public.mastery_map for update to authenticated
  using ((select public.can_see_student(student_id)))
  with check ((select public.can_see_student(student_id)));

-- El estudiante NUNCA escribe su propio dominio. Solo el profesor, tras la
-- práctica de taller. Si el estudiante pudiera marcarse a sí mismo, el mapa
-- dejaría de significar nada.

grant select, insert, update, delete on public.mastery_map to authenticated;
grant select on public.v_mi_dominio      to authenticated;
grant select on public.v_proximo_sabado  to authenticated;
