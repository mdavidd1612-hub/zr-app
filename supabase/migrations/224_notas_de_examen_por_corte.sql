-- Notas por corte para examenes (19-nov-2026, Ingles virtual para dos cortes).
-- 1) Un examen es de UN corte (exams.cohort_id), pero su columna en Notas se
--    creaba sin corte (cohort_id null = compartida), asi que salia en Notas de
--    todos los cortes del modulo. Ahora la columna hereda el corte del examen.
-- 2) El tope de 100 % sumaba las evaluaciones de TODOS los cortes del modulo:
--    dos cortes en el mismo modulo se comian el porcentaje entre ellos. Ahora
--    cuenta las del mismo corte mas las compartidas (tareas de unidad).
create or replace function public.fn_sync_examen_a_notas()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.manual_exam_definitions
    (module_id, cohort_id, exam_date, title, scale_max, passing_min, created_by, kind, weight_pct, source_exam_id)
  values
    (new.module_id, new.cohort_id, coalesce(new.opens_at::date, current_date), new.title, new.max_score,
     new.passing_score, coalesce(new.teacher_id, new.published_by), 'examen',
     coalesce(new.weight, 0), new.id)
  on conflict (source_exam_id) where source_exam_id is not null
  do update set
    module_id = excluded.module_id,
    cohort_id = excluded.cohort_id,
    title = excluded.title,
    scale_max = excluded.scale_max,
    passing_min = excluded.passing_min,
    weight_pct = excluded.weight_pct;
  return new;
end;
$$;

create or replace function public.fn_validar_suma_pesos()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_otros numeric;
  v_min numeric := public.cfg_num('module.participation_weight_min', 0.05) * 100;
  v_max numeric := public.cfg_num('module.participation_weight_max', 0.10) * 100;
begin
  if new.kind = 'participacion' and (new.weight_pct < v_min or new.weight_pct > v_max) then
    raise exception 'La participación debe valer entre % %% y % %% de la nota del módulo.', v_min, v_max;
  end if;
  select coalesce(sum(weight_pct), 0) into v_otros
  from public.manual_exam_definitions d
  where d.module_id = new.module_id and d.id <> new.id
    and (new.cohort_id is null or d.cohort_id is null or d.cohort_id = new.cohort_id);
  if v_otros + new.weight_pct > 100 then
    raise exception 'Los porcentajes pasan de 100 %%: las otras evaluaciones suman % %% y esta pide % %%.', v_otros, new.weight_pct;
  end if;
  return new;
end;
$$;

-- Backfill: columnas de examen sin corte toman el corte de su examen.
update public.manual_exam_definitions d
set cohort_id = e.cohort_id
from public.exams e
where d.source_exam_id = e.id and d.cohort_id is null and e.cohort_id is not null;
