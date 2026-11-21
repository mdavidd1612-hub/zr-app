-- Bug real (19-nov-2026, flujo completo de un modulo): el profesor veia
-- "0 entregas" en una tarea de un modulo que su cohorte YA CURSO, aunque
-- habia entregas. v_assignment_status solo listaba estudiantes cuya cohorte
-- esta HOY en ese modulo (c.current_module_id = m.id). Desde la migracion 208
-- el estudiante ve y entrega en sus modulos cursados, asi que la vista tiene
-- que incluirlos: cohortes cuyo modulo actual es este o uno posterior del
-- mismo programa, y ademas cualquiera que ya haya entregado.
create or replace view public.v_assignment_status
with (security_invoker = true) as
select a.id as assignment_id,
       a.title as assignment_title,
       a.due_at,
       s.id as student_id,
       p.cedula,
       p.full_name,
       pr.name as program_name,
       m.name as module_name,
       u.title as unit_title,
       sub.id as submission_id,
       sub.file_path,
       sub.submitted_at,
       sub.grade,
       case
         when sub.id is null then 'pendiente'
         when sub.grade is not null then 'calificada'
         when a.due_at is not null and sub.submitted_at > a.due_at then 'tardia'
         else 'entregada'
       end as status
from assignments a
join units u on u.id = a.unit_id
join modules m on m.id = u.module_id
join programs pr on pr.id = m.program_id
join students s on true
join cohorts c on c.id = s.cohort_id
left join modules cm on cm.id = c.current_module_id
join profiles p on p.id = s.id
left join lateral (
  select sb.id, sb.file_path, sb.submitted_at, sb.grade
  from submissions sb
  where sb.assignment_id = a.id and sb.student_id = s.id
  order by sb.version desc
  limit 1
) sub on true
where (cm.program_id = m.program_id and cm.order_index >= m.order_index)
   or sub.id is not null;
