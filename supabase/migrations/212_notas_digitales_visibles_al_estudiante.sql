-- Las notas de examenes y tareas digitales (Aula Virtual) llegan solas a Notas
-- (migr. 193), pero el estudiante solo ve lo que Direccion "valida"
-- (grade_validated_evals). Resultado: el estudiante no veia sus notas de
-- examenes/tareas. Esas notas las pone el sistema o el profesor al corregir, asi
-- que se validan solas: en cuanto una evaluacion digital tiene una nota, esa
-- evaluacion queda visible para la cohorte de ese estudiante.
create or replace function public.fn_validar_nota_digital()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_def record; v_cohort uuid;
begin
  select id, module_id, source_exam_id, source_assignment_id into v_def
    from manual_exam_definitions where id = new.definition_id;
  if v_def.source_exam_id is null and v_def.source_assignment_id is null then
    return new;
  end if;
  select cohort_id into v_cohort from students where id = new.student_id;
  if v_cohort is null then return new; end if;
  insert into grade_validated_evals (cohort_id, definition_id, module_id)
  values (v_cohort, v_def.id, v_def.module_id)
  on conflict (cohort_id, definition_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_validar_nota_digital on public.manual_exam_scores;
create trigger trg_validar_nota_digital
  after insert or update on public.manual_exam_scores
  for each row execute function public.fn_validar_nota_digital();

-- Lo que ya existia
insert into grade_validated_evals (cohort_id, definition_id, module_id)
select distinct s.cohort_id, d.id, d.module_id
from manual_exam_scores sc
join manual_exam_definitions d on d.id = sc.definition_id
join students s on s.id = sc.student_id
where (d.source_exam_id is not null or d.source_assignment_id is not null)
  and s.cohort_id is not null
on conflict (cohort_id, definition_id) do nothing;
