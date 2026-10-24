-- =============================================================================
-- ZR APP · MIGRACIÓN 182 · Notificaciones de Dudas
-- =============================================================================
-- Pedido explícito del coordinador (oct. 2026): avisar por push cuando llega
-- una duda nueva (al profesor) y cuando la responden (al estudiante) -- no
-- siempre están con la app abierta.
--
-- La migración 105 ("Catálogo de notificaciones ampliado") ya anticipó este
-- momento exacto: dejó 'duda_respondida' explícitamente FUERA en su momento
-- porque "la función de que el PROFESOR responda una duda nunca se
-- construyó" -- eso es justo lo que agregó la migración 180 (doubt_responses).
-- Con la función real ya construida, se agrega el tipo de notificación que
-- faltaba, siguiendo el mismo patrón ya usado en 009/105.
-- =============================================================================

-- Nota: el catálogo real en producción/staging ya tenía más tipos de los que
-- aparecían en 009/105 (notas_registradas, recordatorio_pago,
-- recordatorio_notas, agregados por migraciones posteriores) -- se confirmó
-- la lista real contra la base antes de escribir este ALTER, no se reconstruyó
-- de memoria de archivos viejos.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente',
    'material_nuevo',
    'modulo_cambiado',
    'hora_clase',
    'hora_refrigerio',
    'notas_registradas',
    'recordatorio_pago',
    'recordatorio_notas',
    'duda_nueva',
    'duda_respondida'
  ));

-- -----------------------------------------------------------------------------
-- 1. duda_nueva — a los profesores asignados al módulo de quien pregunta
-- -----------------------------------------------------------------------------
-- Mismo criterio de "quién la ve" que ya usa la RLS de doubts (164):
-- asignación explícita por cohorte/módulo (teacher_module_assignments) o
-- profesor legado de la cohorte (cohorts.teacher_id). No se notifica a
-- administración/Dirección por cada duda -- igual que 105 evita saturar,
-- esto evita saturar a quien no la va a responder de todas formas.
create or replace function public.fn_notify_doubt_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort_id uuid;
begin
  if new.module_id is null then
    return new;
  end if;

  select cohort_id into v_cohort_id from public.students where id = new.student_id;

  insert into public.notifications (profile_id, type, title, body, payload)
  select distinct destinatario, 'duda_nueva', 'Nueva duda',
         'Un estudiante escribió una duda nueva.',
         jsonb_build_object('doubt_id', new.id, 'module_id', new.module_id)
  from (
    select a.teacher_id as destinatario
    from public.teacher_module_assignments a
    where a.module_id = new.module_id
      and (a.cohort_id is null or a.cohort_id = v_cohort_id)
    union
    select c.teacher_id
    from public.cohorts c
    where c.id = v_cohort_id and c.teacher_id is not null
  ) destinatarios
  where destinatario is not null and destinatario <> new.student_id;

  return new;
end;
$$;

create trigger trg_notify_doubt_created
  after insert on public.doubts
  for each row execute function public.fn_notify_doubt_created();

-- -----------------------------------------------------------------------------
-- 2. duda_respondida — al estudiante dueño de la duda
-- -----------------------------------------------------------------------------
-- No se notifica si el estudiante se responde a sí mismo en su propio hilo
-- (una aclaración, un "gracias") -- solo cuando alguien MÁS le contesta.
create or replace function public.fn_notify_doubt_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id from public.doubts where id = new.doubt_id;

  if v_student_id is null or v_student_id = new.responder_id then
    return new;
  end if;

  insert into public.notifications (profile_id, type, title, body, payload)
  values (
    v_student_id,
    'duda_respondida',
    'Te respondieron tu duda',
    case when new.is_official then 'Tu profesor respondió tu duda.' else 'Tienes una respuesta nueva en tu duda.' end,
    jsonb_build_object('doubt_id', new.doubt_id, 'response_id', new.id)
  );

  return new;
end;
$$;

create trigger trg_notify_doubt_response
  after insert on public.doubt_responses
  for each row execute function public.fn_notify_doubt_response();
