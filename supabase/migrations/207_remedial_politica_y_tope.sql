-- 207 · Remedial configurable por examen (pedido del coordinador, 16-nov-2026).
--
-- Antes: el tope del segundo intento era global (system_config 'aula.intento_cap_2',
-- 80) y la nota final SIEMPRE era la más alta. Ahora cada examen decide:
--   * retake_policy: cómo se combina la nota de los intentos
--       'mejor'    (por defecto) la nota más alta
--       'ultimo'   la del último intento
--       'promedio' el promedio de los intentos calificados
--   * retake_cap_pct: % máximo de la nota que puede sacar un reintento.
--       NULL = usar el valor general de Configuración (aula.intento_cap_2).
-- El tope sigue aplicándose en el servidor (score_cap_applied del intento).

alter table public.exams
  add column if not exists retake_policy text not null default 'mejor'
    check (retake_policy in ('mejor', 'ultimo', 'promedio')),
  add column if not exists retake_cap_pct numeric(5,2)
    check (retake_cap_pct is null or (retake_cap_pct > 0 and retake_cap_pct <= 100));

-- El tope de un reintento sale del examen; si no lo define, del valor general.
create or replace function public.fn_exam_attempt_prepare()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_exam         public.exams;
  v_previos      int;
  v_ultimo_envio timestamptz;
  v_extra        int;
begin
  select * into v_exam from public.exams where id = new.exam_id;

  if v_exam.opens_at is not null and now() < v_exam.opens_at then
    raise exception 'Este examen todavía no está disponible.';
  end if;
  if v_exam.closes_at is not null and now() > v_exam.closes_at then
    raise exception 'Ya pasó la fecha límite de este examen.';
  end if;

  if v_exam.kind = 'certificacion' and v_exam.unit_id is not null
     and not public.fn_unit_required_complete(v_exam.unit_id, new.student_id) then
    raise exception 'Todavía te faltan materiales obligatorios de esta unidad.';
  end if;

  select count(*), max(submitted_at)
    into v_previos, v_ultimo_envio
  from public.exam_attempts
  where exam_id = new.exam_id and student_id = new.student_id;

  select count(*) into v_extra
  from public.intervention_grants
  where exam_id = new.exam_id and student_id = new.student_id;

  if v_previos >= (v_exam.max_attempts + v_extra) then
    if v_exam.kind = 'certificacion' and (v_exam.max_attempts + v_extra) <= 1 then
      raise exception 'Ya has presentado este examen.';
    elsif v_exam.kind = 'certificacion' then
      raise exception 'Ya usaste tu intento y tu remedial en esta certificación.';
    else
      raise exception 'Ya agotaste tus intentos para este examen.';
    end if;
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
    else coalesce(v_exam.retake_cap_pct, public.cfg_num('aula.intento_cap_2', 80))
  end;
  if v_exam.duration_minutes is not null then
    new.expires_at := now() + make_interval(mins => v_exam.duration_minutes);
  end if;

  return new;
end;
$function$;

-- La nota final del examen según la política elegida. Mantiene el nombre y las
-- columnas de siempre (best_score) porque Notas y el calendario ya lo leen.
create or replace view public.v_exam_best_score as
select
  a.exam_id,
  a.student_id,
  (case e.retake_policy
     when 'ultimo'   then (array_agg(a.total_score order by a.attempt_number desc))[1]
     when 'promedio' then round(avg(a.total_score), 2)
     else max(a.total_score)
   end)::numeric as best_score
from public.exam_attempts a
join public.exams e on e.id = a.exam_id
where a.status = 'calificado'
group by a.exam_id, a.student_id, e.retake_policy;
