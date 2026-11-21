-- 193: Fusión Unidades (Aula Virtual) -> Notas (H.33, "núcleo cerrado").
--
-- Decisión del coordinador (7-nov-2026, ver CLAUDE.md §8.7/§8.6 bullet #3b):
-- la unidad NO es algo aparte de Notas -- es el mismo módulo, visto como aula
-- virtual. Antes el profesor iba a Notas -> "Registrar evaluación" -> creaba
-- la fila a mano. Ahora, al crear el examen o la tarea DENTRO de la unidad
-- (como ya hace hoy), ese examen/tarea YA ES la evaluación: aparece solo
-- como columna en Notas, sin que nadie lo registre dos veces. La nota de
-- cada estudiante se llena sola cuando el servidor califica el examen
-- digital, o cuando el profesor califica la tarea -- nunca se calcula en el
-- navegador (regla §6.2).
--
-- "Todo lo que tenga nota cuenta" (decisión explícita): no hace falta que el
-- profesor marque nada aparte -- basta con crear el examen o la tarea. El %
-- que vale en el módulo (weight) lo fija el profesor al crearlo/editarlo, en
-- la misma pantalla (no hay que volver a Notas). exams.weight ya existía sin
-- uso; se reutiliza. assignments no tenía -- se agrega.

-- -----------------------------------------------------------------------------
-- 1. Peso (%) de cada examen/tarea digital en la nota del módulo.
-- -----------------------------------------------------------------------------
alter table public.exams
  add constraint chk_exams_weight check (weight is null or (weight >= 0 and weight <= 100));

alter table public.assignments
  add column weight numeric check (weight is null or (weight >= 0 and weight <= 100));

-- -----------------------------------------------------------------------------
-- 2. "Tarea" como tipo de evaluación en Notas (antes solo examen/práctica/
--    prepráctica/exposición/participación/otro).
-- -----------------------------------------------------------------------------
alter table public.manual_exam_definitions drop constraint manual_exam_definitions_kind_check;
alter table public.manual_exam_definitions add constraint manual_exam_definitions_kind_check
  check (kind = any (array['examen','practica','prepractica','exposicion','participacion','otro','tarea']));

-- -----------------------------------------------------------------------------
-- 3. Vínculo: de qué examen/tarea digital viene cada evaluación de Notas.
--    Un solo origen por fila; nunca dos definiciones para el mismo origen.
-- -----------------------------------------------------------------------------
alter table public.manual_exam_definitions
  add column source_exam_id uuid references public.exams(id) on delete set null,
  add column source_assignment_id uuid references public.assignments(id) on delete set null,
  add constraint chk_manual_exam_un_solo_origen
    check (source_exam_id is null or source_assignment_id is null);

create unique index if not exists idx_manual_exam_def_source_exam
  on public.manual_exam_definitions (source_exam_id) where source_exam_id is not null;
create unique index if not exists idx_manual_exam_def_source_assignment
  on public.manual_exam_definitions (source_assignment_id) where source_assignment_id is not null;

-- -----------------------------------------------------------------------------
-- 4. exams -> manual_exam_definitions: crear/actualizar la evaluación al
--    guardar el examen (título, escala, nota mínima, peso). No calcula nada,
--    solo sincroniza metadatos -- la nota entra por el trigger del punto 6.
-- -----------------------------------------------------------------------------
create or replace function public.fn_sync_examen_a_notas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manual_exam_definitions
    (module_id, exam_date, title, scale_max, passing_min, created_by, kind, weight_pct, source_exam_id)
  values
    (new.module_id, coalesce(new.opens_at::date, current_date), new.title, new.max_score,
     new.passing_score, coalesce(new.teacher_id, new.published_by), 'examen',
     coalesce(new.weight, 0), new.id)
  on conflict (source_exam_id) where source_exam_id is not null
  do update set
    module_id = excluded.module_id,
    title = excluded.title,
    scale_max = excluded.scale_max,
    passing_min = excluded.passing_min,
    weight_pct = excluded.weight_pct;
  return new;
end;
$$;

drop trigger if exists trg_sync_examen_a_notas on public.exams;
create trigger trg_sync_examen_a_notas
  after insert or update of title, module_id, max_score, passing_score, weight on public.exams
  for each row execute function public.fn_sync_examen_a_notas();

-- -----------------------------------------------------------------------------
-- 5. assignments (tareas) -> manual_exam_definitions: mismo patrón. El
--    module_id se lee de la unidad (assignments no lo tiene directo).
-- -----------------------------------------------------------------------------
create or replace function public.fn_sync_tarea_a_notas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
begin
  select module_id into v_module_id from public.units where id = new.unit_id;
  if v_module_id is null then
    return new;
  end if;

  insert into public.manual_exam_definitions
    (module_id, exam_date, title, scale_max, passing_min, created_by, kind, weight_pct, source_assignment_id)
  values
    (v_module_id, coalesce(new.due_at::date, current_date), new.title, 20, 10,
     new.created_by, 'tarea', coalesce(new.weight, 0), new.id)
  on conflict (source_assignment_id) where source_assignment_id is not null
  do update set
    module_id = excluded.module_id,
    title = excluded.title,
    weight_pct = excluded.weight_pct;
  return new;
end;
$$;

drop trigger if exists trg_sync_tarea_a_notas on public.assignments;
create trigger trg_sync_tarea_a_notas
  after insert or update of title, unit_id, weight on public.assignments
  for each row execute function public.fn_sync_tarea_a_notas();

-- -----------------------------------------------------------------------------
-- 6. exam_attempts -> manual_exam_scores: la nota que cuenta es la mejor de
--    los intentos calificados (v_exam_best_score, migración 176, ya incluye
--    el tope de reintento del §7.4). Nunca baja sola; si hay un intento
--    mejor después, se actualiza.
-- -----------------------------------------------------------------------------
create or replace function public.fn_sync_nota_examen_digital()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def_id uuid;
  v_scale numeric;
  v_mejor numeric;
begin
  if new.status <> 'calificado' then
    return new;
  end if;

  select id, scale_max into v_def_id, v_scale from public.manual_exam_definitions where source_exam_id = new.exam_id;
  if v_def_id is null then
    return new;
  end if;

  select max(total_score) into v_mejor
    from public.exam_attempts
    where exam_id = new.exam_id and student_id = new.student_id and status = 'calificado';
  if v_mejor is null then
    return new;
  end if;

  -- Nunca más que la escala del examen en Notas (la escala de Notas la fija
  -- el propio examen -- ver punto 4; esto solo cubre un dato histórico
  -- anómalo, no cambia exam_attempts.total_score real).
  v_mejor := least(v_mejor, v_scale);

  insert into public.manual_exam_scores (definition_id, student_id, score, graded_by, graded_at)
  values (v_def_id, new.student_id, v_mejor, null, now())
  on conflict (definition_id, student_id)
  do update set score = excluded.score, graded_at = excluded.graded_at;
  return new;
end;
$$;

drop trigger if exists trg_sync_nota_examen_digital on public.exam_attempts;
create trigger trg_sync_nota_examen_digital
  after insert or update of status, total_score on public.exam_attempts
  for each row execute function public.fn_sync_nota_examen_digital();

-- -----------------------------------------------------------------------------
-- 7. submissions -> manual_exam_scores: la nota que cuenta es la de la
--    ENTREGA MÁS RECIENTE (mismo criterio que v_assignment_status, migración
--    178) -- si esa última versión todavía no tiene nota, se quita la nota
--    automática anterior (vuelve a "pendiente"), no se deja una vieja.
-- -----------------------------------------------------------------------------
create or replace function public.fn_sync_nota_tarea_digital()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def_id uuid;
  v_scale numeric;
  v_ultima_nota numeric;
begin
  select id, scale_max into v_def_id, v_scale from public.manual_exam_definitions where source_assignment_id = new.assignment_id;
  if v_def_id is null then
    return new;
  end if;

  select grade into v_ultima_nota
    from public.submissions
    where assignment_id = new.assignment_id and student_id = new.student_id
    order by version desc
    limit 1;

  if v_ultima_nota is null then
    delete from public.manual_exam_scores
      where definition_id = v_def_id and student_id = new.student_id;
  else
    -- Hoy calificar una tarea no valida un tope (a diferencia del examen
    -- digital) -- se limita aquí a la escala de Notas para no romper el
    -- cálculo del módulo si alguien escribe un número fuera de rango.
    v_ultima_nota := least(v_ultima_nota, v_scale);
    insert into public.manual_exam_scores (definition_id, student_id, score, graded_by, graded_at)
    values (v_def_id, new.student_id, v_ultima_nota, new.graded_by, coalesce(new.graded_at, now()))
    on conflict (definition_id, student_id)
    do update set score = excluded.score, graded_at = excluded.graded_at, graded_by = excluded.graded_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_nota_tarea_digital on public.submissions;
create trigger trg_sync_nota_tarea_digital
  after insert or update of grade on public.submissions
  for each row execute function public.fn_sync_nota_tarea_digital();

-- -----------------------------------------------------------------------------
-- 8. Backfill: lo que ya existe (exámenes/tareas de antes de esta migración,
--    incluido "601") se registra y se puebla de una vez -- no solo lo nuevo.
-- -----------------------------------------------------------------------------
update public.exams set weight = coalesce(weight, 0) where weight is null;
update public.assignments set weight = coalesce(weight, 0) where weight is null;

insert into public.manual_exam_scores (definition_id, student_id, score, graded_by, graded_at)
select d.id, b.student_id, least(b.best_score, d.scale_max), null, now()
from public.manual_exam_definitions d
join public.v_exam_best_score b on b.exam_id = d.source_exam_id
where d.source_exam_id is not null
on conflict (definition_id, student_id) do update set score = excluded.score;

insert into public.manual_exam_scores (definition_id, student_id, score, graded_by, graded_at)
select d.id, v.student_id, least(v.grade, d.scale_max), null, now()
from public.manual_exam_definitions d
join public.v_assignment_status v on v.assignment_id = d.source_assignment_id
where d.source_assignment_id is not null and v.grade is not null
on conflict (definition_id, student_id) do update set score = excluded.score;
