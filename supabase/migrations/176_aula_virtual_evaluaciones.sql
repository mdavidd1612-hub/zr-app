-- =============================================================================
-- ZR APP · MIGRACIÓN 176 · Aula Virtual — Fase 3: evaluaciones
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §1: se extiende el motor de exámenes ya existente
-- (exams/exam_questions/exam_attempts/exam_answers, migración 007) en vez de
-- crear 'quizzes' desde cero. exams.max_score YA es la escala configurable
-- que pedía el documento (sobre 20, sobre 100, lo que sea) y
-- exams.passing_score YA es la nota mínima -- no se duplican como columnas
-- nuevas.
--
-- 'Requiere intervención' (documento §7.4) se modela como estado CALCULADO
-- (ver unit_prerequisite_met más abajo), no como un valor nuevo de
-- attempt_status: ese enum describe el ciclo de vida de UN intento
-- (en_progreso/entregado/calificado), no la situación general del
-- estudiante frente al examen. Así se evita el ALTER TYPE ... ADD VALUE en
-- dos partes (AGENTS.md §11.4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. exams — columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.exams
  add column unit_id               uuid references public.units(id),
  add column kind                  text not null default 'formativo'
                                      check (kind in ('formativo','certificacion')),
  add column weight                numeric(5,2),             -- % en la nota de la unidad/módulo; null = no pondera
  add column max_attempts          int  not null default 2 check (max_attempts >= 1),
  add column cooldown_hours        int  not null default 24 check (cooldown_hours >= 0),
  add column questions_per_attempt int  check (questions_per_attempt > 0),  -- null = todas las preguntas del banco
  add column show_answers_after_close boolean not null default false;

create index idx_exams_unit on public.exams (unit_id) where unit_id is not null;

comment on column public.exams.kind is
  'formativo: no bloquea nada, es práctica. certificacion: exige passing_score para habilitar la unidad siguiente (spec §7.1, §7.6).';

-- El tope por intento SÍ es global (aplica igual a todos los exámenes, no es
-- un campo editable por examen como sí lo son max_attempts/cooldown_hours) --
-- va en system_config, no como columna.
insert into public.system_config (key, value, description, is_public) values
  ('aula.intento_cap_1', '100', '% máximo de la nota que puede obtener el primer intento de un examen (spec/07_AULA_VIRTUAL.md §7.4).', true),
  ('aula.intento_cap_2', '80', '% máximo de la nota que puede obtener el segundo intento en adelante (spec §7.4).', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. exam_attempts — columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.exam_attempts
  add column attempt_number    int  not null default 1,
  add column seed              int  not null default floor(random() * 2000000000)::int,
  add column expires_at        timestamptz,
  add column score_cap_applied numeric(5,2);  -- % del máximo que se aplicó a ESTE intento (spec §7.4: 100% el primero, 80% el segundo)

-- La 007 creó exam_attempts con unique(exam_id, student_id) -- un examen de
-- un solo intento siempre. El documento pide varios intentos con tope; se
-- reemplaza por unique(exam_id, student_id, attempt_number), que sigue
-- impidiendo dos filas para el mismo número de intento.
alter table public.exam_attempts
  drop constraint exam_attempts_exam_id_student_id_key,
  add constraint exam_attempts_exam_student_attempt_key unique (exam_id, student_id, attempt_number);

-- -----------------------------------------------------------------------------
-- 3. intervention_grants — "Requiere intervención" (spec §7.4)
-- -----------------------------------------------------------------------------
-- Corrección lógica del documento original: si reprueba todos los intentos,
-- el estudiante quedaría bloqueado para siempre. El profesor puede otorgar
-- un intento EXTRA (no resetea el contador, lo aumenta), con motivo, y queda
-- en el historial -- nunca se borra. Va ANTES de fn_exam_attempt_prepare
-- porque esa función ya la consulta.
create table public.intervention_grants (
  id         uuid primary key default gen_random_uuid(),
  exam_id    uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  granted_by uuid not null references public.teachers(id),
  reason     text not null,
  created_at timestamptz not null default now()
);

create index idx_intervention_exam_student on public.intervention_grants (exam_id, student_id);

-- -----------------------------------------------------------------------------
-- 4. Preparar un intento nuevo: cuenta, tope de intentos, espera entre
--    intentos, temporizador y qué % de la nota se le permite a este intento
-- -----------------------------------------------------------------------------
-- spec §7.5: el temporizador corre en SERVIDOR (expires_at se calcula aquí,
-- el cliente solo lo muestra). spec §7.4: intento 1 hasta 100%, intento 2
-- hasta 80% (configurable), con 24h de por medio -- todo leído de
-- system_config o de la fila del examen, nunca un número suelto en código.
create or replace function public.fn_exam_attempt_prepare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam         public.exams;
  v_previos      int;
  v_ultimo_envio timestamptz;
  v_extra        int;
begin
  select * into v_exam from public.exams where id = new.exam_id;

  select count(*), max(submitted_at)
    into v_previos, v_ultimo_envio
  from public.exam_attempts
  where exam_id = new.exam_id and student_id = new.student_id;

  select count(*) into v_extra
  from public.intervention_grants
  where exam_id = new.exam_id and student_id = new.student_id;

  if v_previos >= (v_exam.max_attempts + v_extra) then
    raise exception 'Ya agotaste tus intentos para este examen.';
  end if;

  if v_previos > 0 then
    if v_ultimo_envio is null then
      raise exception 'Todavía tienes un intento en progreso.';
    end if;
    if now() < v_ultimo_envio + make_interval(hours => v_exam.cooldown_hours) then
      raise exception 'Debes esperar % horas desde tu intento anterior.', v_exam.cooldown_hours;
    end if;
  end if;

  new.attempt_number := v_previos + 1;
  new.score_cap_applied := case
    when new.attempt_number <= 1 then public.cfg_num('aula.intento_cap_1', 100)
    else public.cfg_num('aula.intento_cap_2', 80)
  end;
  if v_exam.duration_minutes is not null then
    new.expires_at := now() + make_interval(mins => v_exam.duration_minutes);
  end if;

  return new;
end;
$$;

create trigger trg_exam_attempt_prepare
  before insert on public.exam_attempts
  for each row execute function public.fn_exam_attempt_prepare();

-- -----------------------------------------------------------------------------
-- 5. Aplicar el tope de nota a ESTE intento
-- -----------------------------------------------------------------------------
-- fn_close_attempt_if_graded (007) ya totaliza total_score cuando las
-- respuestas quedan calificadas, con un UPDATE sobre esta misma tabla -- este
-- disparador BEFORE UPDATE intercepta ESE mismo UPDATE (y cualquier otro) y
-- recorta total_score al tope que le tocaba a este intento. No se edita 007.
create or replace function public.fn_cap_attempt_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max numeric;
begin
  if new.total_score is not null and new.score_cap_applied is not null then
    select max_score into v_max from public.exams where id = new.exam_id;
    if v_max is not null then
      new.total_score := least(new.total_score, round(v_max * new.score_cap_applied / 100, 2));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_cap_attempt_score
  before update of total_score on public.exam_attempts
  for each row execute function public.fn_cap_attempt_score();

-- -----------------------------------------------------------------------------
-- 6. Qué nota cuenta con varios intentos: la mayor, ya con el tope aplicado
--    (spec §7.4, valor por defecto de la pregunta abierta §16.4)
-- -----------------------------------------------------------------------------
create or replace view public.v_exam_best_score
with (security_invoker = true)
as
select exam_id, student_id, max(total_score) as best_score
from public.exam_attempts
where status = 'calificado'
group by exam_id, student_id;

-- -----------------------------------------------------------------------------
-- 7. Banco de preguntas al azar, orden distinto por estudiante
-- -----------------------------------------------------------------------------
-- spec §7.3 y criterio de aceptación (§17): dos estudiantes ven las preguntas
-- en distinto orden; recargar no cambia el orden del mismo estudiante. El
-- orden sale de un hash de la semilla del intento + el id de la pregunta --
-- determinístico para el mismo intento, distinto entre intentos.
create or replace function public.fn_attempt_questions(p_attempt_id uuid)
returns setof public.v_exam_questions_student
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_seed    int;
  v_limit   int;
begin
  select a.exam_id, a.seed into v_exam_id, v_seed
  from public.exam_attempts a where a.id = p_attempt_id;

  select e.questions_per_attempt into v_limit
  from public.exams e where e.id = v_exam_id;

  return query
    select q.*
    from public.v_exam_questions_student q
    where q.exam_id = v_exam_id
    order by md5(v_seed::text || q.id::text)
    limit coalesce(v_limit, 2147483647);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Cierre automático de intentos vencidos (pg_cron, cada minuto)
-- -----------------------------------------------------------------------------
-- spec §7.5: autoenvío al vencer el tiempo, calificado con lo que había
-- contestado. Se autocalifica aquí lo objetivamente verificable (opción
-- múltiple, verdadero/falso) -- redacción abierta sigue pendiente de un
-- profesor, igual que ya hace fn_close_attempt_if_graded (007) para
-- cualquier entrega manual.
create or replace function public.fn_submit_expired_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
begin
  for v_attempt in
    select id, exam_id
    from public.exam_attempts
    where status = 'en_progreso' and expires_at is not null and expires_at < now()
  loop
    update public.exam_answers ea
    set awarded_points = case when ea.answer = eq.correct_answer then eq.points else 0 end,
        auto_graded = true,
        graded_at = now()
    from public.exam_questions eq
    where ea.question_id = eq.id
      and ea.attempt_id = v_attempt.id
      and eq.type in ('opcion_multiple','verdadero_falso')
      and ea.awarded_points is null;

    -- Preguntas que ni siquiera se alcanzaron a responder: cuentan 0, no se
    -- quedan sin calificar para siempre (si no, el intento nunca cierra).
    insert into public.exam_answers (attempt_id, question_id, answer, awarded_points, auto_graded, graded_at)
    select v_attempt.id, eq.id, null, 0, true, now()
    from public.exam_questions eq
    where eq.exam_id = v_attempt.exam_id
      and not exists (
        select 1 from public.exam_answers ea
        where ea.attempt_id = v_attempt.id and ea.question_id = eq.id
      );

    -- No pisar 'calificado' si el trigger de 007 ya cerró el intento con las
    -- escrituras de arriba (ej. no había preguntas de redacción pendientes).
    update public.exam_attempts
    set status = case when status = 'calificado' then status else 'entregado' end,
        submitted_at = coalesce(submitted_at, now())
    where id = v_attempt.id;
  end loop;
end;
$$;

select cron.schedule(
  'aula-virtual-cerrar-intentos-vencidos',
  '* * * * *',
  $$ select public.fn_submit_expired_attempts(); $$
);

-- -----------------------------------------------------------------------------
-- 9. Prerrequisito real entre unidades (reemplaza el placeholder de la Fase 1)
-- -----------------------------------------------------------------------------
-- Hallazgo real de seguridad (revisión propia, oct. 2026): al ser SECURITY
-- DEFINER, esta función salta la RLS de exam_attempts a propósito -- pero
-- eso también significa que, sin esta guarda, cualquier estudiante
-- autenticado podría consultar si OTRO estudiante aprobó su certificación
-- (llamándola vía /rest/v1/rpc con cualquier p_student_id). Se restringe a
-- "pregúntame por mí mismo" o "soy personal preguntando por cualquiera".
create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_student_id is distinct from auth.uid() and not public.is_staff() then false
    when (select prerequisite_unit_id from public.units where id = p_unit_id) is null then true
    else exists (
      select 1
      from public.unit_items ui
      join public.exams e on e.id = ui.exam_id
      join public.exam_attempts a on a.exam_id = e.id and a.student_id = p_student_id
      where ui.unit_id = (select prerequisite_unit_id from public.units where id = p_unit_id)
        and ui.type = 'quiz'
        and e.kind = 'certificacion'
        and a.status = 'calificado'
        and a.total_score >= e.passing_score
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- 10. RLS
-- -----------------------------------------------------------------------------
alter table public.intervention_grants enable row level security;

create policy "estudiante: leer sus intentos extra otorgados"
  on public.intervention_grants for select to authenticated
  using (student_id = auth.uid());

create policy "personal: gestionar intentos extra"
  on public.intervention_grants for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
