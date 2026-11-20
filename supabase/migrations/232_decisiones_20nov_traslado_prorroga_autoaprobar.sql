-- =============================================================================
-- ZR APP · MIGRACIÓN 232 · Decisiones del coordinador del 20-nov-2026
-- =============================================================================
-- Tras la evaluación LMS/UX/visual (docs/reportes/evaluacion_lms_ux_visual_2026-11-20.md),
-- el coordinador aprobó ("todas bien menos la 6"):
--
--  A) Traslado de corte: las notas del corte viejo se COPIAN al nuevo, a la
--     evaluación equivalente (mismo módulo y mismo título; "Usar en otro corte"
--     copia el examen con el mismo título). Nunca pisa una nota que ya exista.
--     Si una copia choca con el cierre de notas de ese módulo, se salta esa
--     fila sin impedir el cambio de corte.
--  B) La certificación aprobada sigue valiendo: la compuerta da por cumplida la
--     certificación de la unidad anterior si el estudiante aprobó CUALQUIER
--     certificación de esa unidad (la de su corte o la copia de otro).
--  C) Prórroga y oportunidad extra por estudiante: un `intervention_grants`
--     ya sumaba un intento; ahora además le deja presentar aunque el examen ya
--     haya cerrado (`closes_at`). Es lo que da el botón "Dar otra oportunidad".
--  D) Material que sube el profesor ASIGNADO al módulo entra aprobado y
--     publicado (era la causa número uno de "Todavía no disponible").
--     Lo que suba otra persona sigue el flujo de aprobación de siempre.
-- =============================================================================

-- A) Traslado de corte -------------------------------------------------------
create or replace function public.fn_copiar_notas_al_cambiar_corte()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  r record;
begin
  if old.cohort_id is null or new.cohort_id is null or new.cohort_id = old.cohort_id then
    return new;
  end if;
  for r in
    select dn.id as def_nueva, s.score, s.graded_by, s.graded_at
      from public.manual_exam_scores s
      join public.manual_exam_definitions dv on dv.id = s.definition_id
      join public.manual_exam_definitions dn
        on dn.module_id = dv.module_id
       and lower(trim(dn.title)) = lower(trim(dv.title))
       and dn.cohort_id = new.cohort_id
     where s.student_id = new.id
       and dv.cohort_id = old.cohort_id
  loop
    begin
      insert into public.manual_exam_scores (definition_id, student_id, score, graded_by, graded_at)
      values (r.def_nueva, new.id, r.score, r.graded_by, r.graded_at)
      on conflict (definition_id, student_id) do nothing;
    exception when others then
      -- Cierre de notas u otra regla: no se bloquea el traslado por una fila.
      null;
    end;
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_copiar_notas_al_cambiar_corte on public.students;
create trigger trg_copiar_notas_al_cambiar_corte
  after update of cohort_id on public.students
  for each row execute function public.fn_copiar_notas_al_cambiar_corte();

revoke execute on function public.fn_copiar_notas_al_cambiar_corte() from public, anon, authenticated;

-- B) Compuerta: vale cualquier certificación aprobada de la unidad anterior ---
create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $function$
  select case
    when p_student_id is distinct from auth.uid() and not public.is_staff() then false
    when (select public.is_staff()) then true
    else coalesce((
      select case cur.gate_mode
        when 'none' then true
        when 'exam' then (
          cur.gate_exam_id is null
          or not exists (
            select 1 from public.exams ge
            where ge.id = cur.gate_exam_id and ge.status in ('habilitado', 'cerrado', 'calificado')
              and (ge.cohort_id is null
                   or ge.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id))
          )
          or exists (
            select 1
            from public.exam_attempts a
            join public.exams ge on ge.id = a.exam_id
            where a.exam_id = cur.gate_exam_id
              and a.student_id = p_student_id
              and a.status = 'calificado'
              and a.total_score >= ge.passing_score
          )
        )
        else (
          with prev as (
            select p2.id from public.units p2
             where p2.module_id = cur.module_id and p2.order_index < cur.order_index
             order by p2.order_index desc limit 1
          ), certs as (
            select e.id, e.cohort_id, e.passing_score
              from prev
              join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
              join public.exams e on e.id = ui.exam_id and e.kind = 'certificacion'
                                 and e.status in ('habilitado', 'cerrado', 'calificado')
          )
          select
            -- No hay certificación que le corresponda: libre.
            not exists (
              select 1 from certs c
               where c.cohort_id is null
                  or c.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id)
            )
            -- O aprobó alguna certificación de esa unidad (su corte o la copia de otro).
            or exists (
              select 1 from certs c
              join public.exam_attempts a on a.exam_id = c.id
             where a.student_id = p_student_id
               and a.status = 'calificado'
               and a.total_score >= c.passing_score
            )
        )
      end
      from public.units cur
      where cur.id = p_unit_id
    ), true)
  end;
$function$;

-- C) Prórroga: con una oportunidad extra se puede presentar aunque haya cerrado
do $$
declare d text;
begin
  d := pg_get_functiondef('public.fn_exam_attempt_prepare()'::regprocedure);
  d := replace(d,
    'if v_exam.closes_at is not null and now() > v_exam.closes_at then',
    'if v_exam.closes_at is not null and now() > v_exam.closes_at
     and not exists (select 1 from public.intervention_grants g
                      where g.exam_id = new.exam_id and g.student_id = new.student_id) then');
  if position('intervention_grants g' in d) = 0 then
    raise exception 'No se encontró el chequeo de closes_at en fn_exam_attempt_prepare';
  end if;
  execute d;
end $$;

-- D) Material del profesor asignado entra aprobado ---------------------------
create or replace function public.fn_autoaprobar_material_profesor_asignado()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if (select public.auth_role()) = 'profesor'
     and new.module_id is not null
     and exists (
       select 1 from public.teacher_module_assignments t
        where t.teacher_id = auth.uid()
          and t.module_id = new.module_id
          and (new.cohort_id is null or t.cohort_id = new.cohort_id)
     ) then
    new.approval_status := 'aprobado';
    new.is_published := true;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_autoaprobar_material on public.content_items;
create trigger trg_autoaprobar_material
  before insert on public.content_items
  for each row execute function public.fn_autoaprobar_material_profesor_asignado();

revoke execute on function public.fn_autoaprobar_material_profesor_asignado() from public, anon, authenticated;
