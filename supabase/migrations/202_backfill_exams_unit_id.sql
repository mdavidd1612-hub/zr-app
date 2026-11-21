-- Bug real reportado en vivo (8-nov-2026): crear-examen/nuevo nunca guardaba
-- exams.unit_id (solo lo guardaba en la fila de unit_items) -- fn_calendar_sync_exam
-- depende de ese campo para decidir si el examen entra al calendario del
-- estudiante, así que un examen con fecha pero sin unit_id nunca aparecía ahí.
-- Se corrige el alta (crear-examen/nuevo) y se rellena lo que ya existía.
update exams e
set unit_id = ui.unit_id
from unit_items ui
where ui.exam_id = e.id
  and e.unit_id is null;
