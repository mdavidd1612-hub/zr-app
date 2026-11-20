-- =============================================================================
-- ZR APP · MIGRACIÓN 230 · Compuerta por corte + aviso de corrección al profesor asignado
-- =============================================================================
-- Hallazgos de la evaluación pedagógica del 20-nov-2026:
--
-- 1) La compuerta entre unidades (`unit_prerequisite_met`, migr. 185/208) no
--    miraba el corte. Las unidades son del módulo (compartidas entre cortes),
--    pero los exámenes son de un corte (migr. 224). Con "Usar en otro corte"
--    una misma unidad queda con una certificación por corte, y el estudiante de
--    PTMA-II tenía que aprobar TAMBIÉN la copia de PTMA-III -- que no puede ni
--    ver (migr. 228). La unidad siguiente quedaba trabada para siempre (justo
--    el caso de Inglés virtual). Ahora solo cuentan las certificaciones de SU
--    corte (o compartidas, cohort_id null). En modo 'exam', si el examen
--    elegido como compuerta es de otro corte, no bloquea.
--
-- 2) El aviso "examen por corregir" (migr. 210) le llegaba solo a quien creó el
--    examen. Si cambia el profesor (Cobertura) o el examen se copió a otro
--    corte, el profesor que de verdad dicta ese módulo en ese corte no se
--    enteraba. Ahora va al creador y a los profesores asignados al módulo en el
--    corte del estudiante (sin repetir).
-- =============================================================================

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
        else not exists (
          select 1
          from public.units prev
          join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
          join public.exams e
            on e.id = ui.exam_id
           and e.kind = 'certificacion'
           and e.status in ('habilitado', 'cerrado', 'calificado')
           and (e.cohort_id is null
                or e.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id))
          where prev.module_id = cur.module_id
            and prev.order_index = cur.order_index - 1
            and not exists (
              select 1 from public.exam_attempts a
              where a.exam_id = e.id
                and a.student_id = p_student_id
                and a.status = 'calificado'
                and a.total_score >= e.passing_score
            )
        )
      end
      from public.units cur
      where cur.id = p_unit_id
    ), true)
  end;
$function$;

create or replace function public.fn_notify_examen_por_corregir()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_exam public.exams;
  v_alumno text;
  v_cohorte uuid;
begin
  if new.status = 'entregado' and (tg_op = 'INSERT' or old.status is distinct from 'entregado') then
    select * into v_exam from public.exams where id = new.exam_id;
    select full_name into v_alumno from public.profiles where id = new.student_id;
    select cohort_id into v_cohorte from public.students where id = new.student_id;

    insert into public.notifications (profile_id, type, title, body, payload, channel)
    select distinct d.profesor,
      'examen_por_corregir',
      'Examen por corregir',
      coalesce(v_alumno, 'Un estudiante') || ' entregó "' || coalesce(v_exam.title, '') || '" y tiene respuestas abiertas esperando tu corrección.',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id, 'unit_id', v_exam.unit_id),
      'push'
    from (
      select v_exam.teacher_id as profesor
      union
      select t.teacher_id from public.teacher_module_assignments t
       where t.module_id = v_exam.module_id and t.cohort_id = v_cohorte
    ) d
    where d.profesor is not null;
  end if;
  return new;
end;
$function$;

-- 230b (mismo día): la compuerta buscaba la unidad con `order_index = actual - 1`.
-- Al borrar o reordenar unidades quedan huecos (Inglés: 1, 2, 10, 11) y la
-- certificación de la unidad 2 no trababa nada. Ahora "la anterior" es la de
-- mayor orden menor a la actual, dentro del mismo módulo.
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
        else not exists (
          select 1
          from public.units prev
          join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
          join public.exams e
            on e.id = ui.exam_id
           and e.kind = 'certificacion'
           and e.status in ('habilitado', 'cerrado', 'calificado')
           and (e.cohort_id is null
                or e.cohort_id = (select s.cohort_id from public.students s where s.id = p_student_id))
          where prev.id = (
                  select p2.id from public.units p2
                   where p2.module_id = cur.module_id and p2.order_index < cur.order_index
                   order by p2.order_index desc limit 1)
            and not exists (
              select 1 from public.exam_attempts a
              where a.exam_id = e.id
                and a.student_id = p_student_id
                and a.status = 'calificado'
                and a.total_score >= e.passing_score
            )
        )
      end
      from public.units cur
      where cur.id = p_unit_id
    ), true)
  end;
$function$;
