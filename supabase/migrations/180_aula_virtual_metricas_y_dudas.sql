-- =============================================================================
-- ZR APP · MIGRACIÓN 180 · Aula Virtual — Fase 7: métricas y dudas
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §10-11. Nota importante (009_notifications.sql):
-- el catálogo de notificaciones está CERRADO en Fase 1 ("no agregues otros
-- sin aprobación"). Por eso esta migración NO agrega notificaciones nuevas
-- para dudas/respuestas -- spec §10 las pide, pero eso necesita aprobación
-- aparte, no se asume aquí. Tampoco se agregan imágenes adjuntas (spec
-- §10): ninguna de las dos es necesaria para que Dudas por unidad/material
-- y el estado abierta/respondida/resuelta funcionen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. activity_log — mismo patrón que audit_log (002), pero de ACCIONES de
--    negocio (para métricas), no de cambios de fila
-- -----------------------------------------------------------------------------
-- "Lo que depende de que un programador se acuerde de escribirlo, se
-- olvida" (002) -- por eso casi todo esto lo alimentan disparadores, no
-- llamadas manuales desde el cliente. La única excepción real es "abrió
-- unidad" (una navegación, no una escritura en la base): para esa,
-- fn_log_activity es la única puerta, y por eso nadie tiene permiso de
-- insertar directo en la tabla.
create table public.activity_log (
  id               bigserial primary key,
  student_id       uuid references public.students(id) on delete set null,
  actor_profile_id uuid references public.profiles(id),
  action           text not null,
  entity           text not null,
  entity_id        uuid,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index idx_activity_student on public.activity_log (student_id, created_at desc);
create index idx_activity_entity  on public.activity_log (entity, entity_id);

alter table public.activity_log enable row level security;

create policy "estudiante: leer su actividad"
  on public.activity_log for select to authenticated
  using (student_id = auth.uid());

create policy "personal: leer actividad"
  on public.activity_log for select to authenticated
  using ((select public.is_staff()));

-- Sin política de insert/update/delete para nadie: solo entra por
-- fn_log_activity o por los disparadores de abajo (ambos SECURITY DEFINER,
-- no dependen de RLS).

-- Puerta para eventos que no tienen una escritura natural en la base (ej.
-- "abrió unidad", que es solo navegación del lado del cliente).
create or replace function public.fn_log_activity(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id, metadata)
  values (
    case when public.is_student() then auth.uid() else null end,
    auth.uid(), p_action, p_entity, p_entity_id, p_metadata
  );
end;
$$;

-- Disparadores: estos SÍ tienen una escritura natural en la base, así que
-- se registran solos -- nadie tiene que acordarse de llamarlos.
create or replace function public.fn_log_material_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id)
    values (new.student_id, new.student_id, 'vio_material', 'content_items', new.content_item_id);
  elsif new.completed_at is not null and old.completed_at is null then
    insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id)
    values (new.student_id, new.student_id, 'completo_material', 'content_items', new.content_item_id);
  end if;
  return new;
end;
$$;

create trigger trg_log_material_progress
  after insert or update of completed_at on public.material_progress
  for each row execute function public.fn_log_material_progress();

create or replace function public.fn_log_exam_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id, metadata)
    values (new.student_id, new.student_id, 'inicio_examen', 'exams', new.exam_id, jsonb_build_object('attempt_number', new.attempt_number));
  elsif new.status <> 'en_progreso' and old.status = 'en_progreso' then
    insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id, metadata)
    values (new.student_id, new.student_id, 'entrego_examen', 'exams', new.exam_id, jsonb_build_object('attempt_number', new.attempt_number));
  end if;
  return new;
end;
$$;

create trigger trg_log_exam_attempt
  after insert or update of status on public.exam_attempts
  for each row execute function public.fn_log_exam_attempt();

create or replace function public.fn_log_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id, metadata)
  values (new.student_id, new.student_id, 'subio_tarea', 'assignments', new.assignment_id, jsonb_build_object('version', new.version));
  return new;
end;
$$;

create trigger trg_log_submission
  after insert on public.submissions
  for each row execute function public.fn_log_submission();

-- -----------------------------------------------------------------------------
-- 2. Dudas: ligarlas a una unidad o a un material/examen/tarea específico
-- -----------------------------------------------------------------------------
alter table public.doubts
  add column unit_id           uuid references public.units(id) on delete set null,
  add column content_item_id   uuid references public.content_items(id) on delete set null,
  add column exam_id           uuid references public.exams(id) on delete set null,
  add column assignment_id     uuid references public.assignments(id) on delete set null,
  add column is_faq            boolean not null default false;

alter table public.doubts
  add constraint chk_doubt_single_ref check (
    (case when unit_id is not null then 1 else 0 end)
    + (case when content_item_id is not null then 1 else 0 end)
    + (case when exam_id is not null then 1 else 0 end)
    + (case when assignment_id is not null then 1 else 0 end)
    <= 1
  );

create type public.doubt_status as enum ('abierta', 'respondida', 'resuelta');

alter table public.doubts
  add column status public.doubt_status not null default 'abierta';

create index idx_doubts_unit on public.doubts (unit_id) where unit_id is not null;

-- Preguntas frecuentes visibles para todo el grupo (spec §10) -- el
-- profesor marca is_faq; el estudiante sigue viendo solo las SUYAS más las
-- que sean FAQ de su propio módulo (nunca dudas ajenas que no sean FAQ).
create policy "estudiante: leer dudas faq de su modulo"
  on public.doubts for select to authenticated
  using (
    is_faq = true
    and unit_id is not null
    and exists (select 1 from public.units u where u.id = unit_id and u.module_id = (select public.my_module_id()))
  );

-- -----------------------------------------------------------------------------
-- 3. doubt_responses — hilo de respuestas; el profesor marca la oficial
-- -----------------------------------------------------------------------------
create table public.doubt_responses (
  id           uuid primary key default gen_random_uuid(),
  doubt_id     uuid not null references public.doubts(id) on delete cascade,
  responder_id uuid not null references public.profiles(id),
  body         text not null check (char_length(trim(body)) > 0),
  is_official  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index idx_doubt_responses_doubt on public.doubt_responses (doubt_id);

-- A lo sumo una respuesta oficial por duda.
create unique index uq_doubt_one_official on public.doubt_responses (doubt_id) where is_official;

-- Solo personal puede marcar una respuesta como oficial (spec §10: "el
-- profesor marca la respuesta oficial") -- el estudiante dueño de la duda
-- puede responder en el hilo (una aclaración, un "gracias"), pero nunca
-- como oficial.
create or replace function public.fn_doubt_response_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_official and not public.is_staff() then
    raise exception 'Solo el personal puede marcar una respuesta como oficial.';
  end if;
  return new;
end;
$$;

create trigger trg_doubt_response_guard
  before insert on public.doubt_responses
  for each row execute function public.fn_doubt_response_guard();

-- Primera respuesta: abierta -> respondida. 'resuelta' es manual (spec no
-- dice quién la marca; se deja que el dueño de la duda o el personal la
-- cierren, vía UPDATE normal de doubts con su propia RLS).
create or replace function public.fn_doubt_mark_responded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.doubts set status = 'respondida'
  where id = new.doubt_id and status = 'abierta';
  return new;
end;
$$;

create trigger trg_doubt_mark_responded
  after insert on public.doubt_responses
  for each row execute function public.fn_doubt_mark_responded();

create or replace function public.fn_log_doubt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (student_id, actor_profile_id, action, entity, entity_id)
  values (new.student_id, new.student_id, 'hizo_duda', 'doubts', new.id);
  return new;
end;
$$;

create trigger trg_log_doubt
  after insert on public.doubts
  for each row execute function public.fn_log_doubt();

-- -----------------------------------------------------------------------------
-- 4. RLS de doubt_responses: visible si la duda es visible
-- -----------------------------------------------------------------------------
alter table public.doubt_responses enable row level security;

create policy "quien ve la duda: lee sus respuestas"
  on public.doubt_responses for select to authenticated
  using (
    exists (
      select 1 from public.doubts d
      where d.id = doubt_id
        and (
          d.student_id = auth.uid()
          or (select public.is_staff())
          or (d.is_faq and d.unit_id is not null and exists (
                select 1 from public.units u where u.id = d.unit_id and u.module_id = (select public.my_module_id())
              ))
        )
    )
  );

create policy "dueño de la duda o personal: responder"
  on public.doubt_responses for insert to authenticated
  with check (
    responder_id = auth.uid()
    and exists (
      select 1 from public.doubts d
      where d.id = doubt_id and (d.student_id = auth.uid() or (select public.is_staff()))
    )
  );

create policy "personal: actualizar duda (estado, faq)"
  on public.doubts for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "estudiante: marcar su duda como resuelta"
  on public.doubts for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- La política de arriba (y doubts_update_own, 034) solo controla DE QUIÉN
-- es la fila, no QUÉ columna cambia -- sin esta guarda, un estudiante podría
-- usar esa misma política para marcarse su propia duda como FAQ o
-- reasignarle la unidad/material después de enviada. 034 ya dejaba el
-- `body` editable mientras es suya ("puede editarla... mientras es suya") --
-- eso se mantiene tal cual, esta guarda no lo toca. Mismo patrón que
-- fn_profiles_guard (011) para las columnas nuevas: is_faq y las
-- referencias son del profesor; el estudiante solo puede mover su status a
-- 'resuelta'.
create or replace function public.fn_doubts_student_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  if (new.unit_id, new.content_item_id, new.exam_id, new.assignment_id, new.is_faq)
     is distinct from (old.unit_id, old.content_item_id, old.exam_id, old.assignment_id, old.is_faq) then
    raise exception 'Esos campos los asigna el profesor, no se pueden cambiar.';
  end if;

  if new.status is distinct from old.status and new.status <> 'resuelta' then
    raise exception 'Solo puedes marcar tu duda como resuelta.';
  end if;

  return new;
end;
$$;

create trigger trg_doubts_student_guard
  before update on public.doubts
  for each row execute function public.fn_doubts_student_guard();

-- -----------------------------------------------------------------------------
-- 5. Métricas
-- -----------------------------------------------------------------------------
-- Progreso de materiales por estudiante y unidad. security_invoker=true: un
-- estudiante solo ve SU fila (RLS de students ya lo limita a sí mismo), el
-- personal ve las de los estudiantes que atiende (RLS de teaches_cohort).
create or replace view public.v_aula_progreso_estudiante
with (security_invoker = true)
as
select
  s.id as student_id,
  u.id as unit_id,
  u.title as unit_title,
  (select count(*) from public.unit_items ui where ui.unit_id = u.id and ui.type = 'material') as materiales_total,
  (select count(*)
     from public.unit_items ui
     join public.material_progress mp on mp.content_item_id = ui.content_item_id and mp.student_id = s.id
     where ui.unit_id = u.id and ui.type = 'material' and mp.completed_at is not null
  ) as materiales_completados,
  (select max(best.best_score)
     from public.unit_items ui
     join public.v_exam_best_score best on best.exam_id = ui.exam_id and best.student_id = s.id
     where ui.unit_id = u.id and ui.type = 'quiz'
  ) as mejor_nota_certificacion
from public.units u
join public.modules m on m.id = u.module_id
join public.cohorts c on c.current_module_id = m.id
join public.students s on s.cohort_id = c.id;

-- Resumen por unidad para personal: promedios, nunca filas individuales de
-- un estudiante (mismo espíritu que v_feedback_session_summary, 008).
create or replace view public.v_aula_resumen_unidad
with (security_invoker = true)
as
select
  u.id as unit_id,
  u.title as unit_title,
  u.module_id,
  count(distinct s.id) as estudiantes,
  round(avg(
    case when vp.materiales_total > 0 then vp.materiales_completados::numeric / vp.materiales_total * 100 else null end
  ), 1) as avance_materiales_pct,
  round(avg(vp.mejor_nota_certificacion), 2) as promedio_certificacion
from public.units u
join public.modules m on m.id = u.module_id
join public.cohorts c on c.current_module_id = m.id
join public.students s on s.cohort_id = c.id
join public.v_aula_progreso_estudiante vp on vp.unit_id = u.id and vp.student_id = s.id
group by u.id, u.title, u.module_id;
