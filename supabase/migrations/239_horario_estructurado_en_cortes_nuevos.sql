-- 239 · Cortes nuevos con horario estructurado (20-nov-2026).
-- La 233 convirtió una sola vez el texto de días/horario de los cortes que
-- existían. Los cortes creados después (programas o cursos cortos) quedaban
-- sin hora en el calendario general. Ahora, al crear o editar un corte, lo que
-- falte del horario estructurado se completa desde el texto. Nunca pisa lo que
-- ya se puso a mano en "Datos del corte".
create or replace function public.fn_cohort_horario_desde_texto()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.class_start is null and new.schedule is not null then
    new.class_start := (public.fn_parsear_horario(new.schedule)).inicio;
  end if;
  if new.class_end is null and new.schedule is not null then
    new.class_end := (public.fn_parsear_horario(new.schedule)).fin;
  end if;
  if new.class_weekdays is null or cardinality(new.class_weekdays) = 0 then
    new.class_weekdays := case
      when coalesce(trim(new.days), '') = '' then array[6]::smallint[]
      else nullif(array_remove(array[
        case when new.days ~* 'dom' then 0 end,
        case when new.days ~* 'lun' then 1 end,
        case when new.days ~* 'mar' then 2 end,
        case when new.days ~* 'mi[eé]' then 3 end,
        case when new.days ~* 'jue' then 4 end,
        case when new.days ~* 'vie' then 5 end,
        case when new.days ~* 's[aá]b' then 6 end
      ]::smallint[], null), '{}'::smallint[])
    end;
    if new.class_weekdays is null then new.class_weekdays := array[6]::smallint[]; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_cohort_horario_desde_texto on public.cohorts;
create trigger trg_cohort_horario_desde_texto
  before insert or update of days, schedule, class_weekdays, class_start, class_end on public.cohorts
  for each row execute function public.fn_cohort_horario_desde_texto();

-- Cortes creados después de la 233 que quedaron sin horario.
update public.cohorts set days = days where class_weekdays is null or class_start is null;
