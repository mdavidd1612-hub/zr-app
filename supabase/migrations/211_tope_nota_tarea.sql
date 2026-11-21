-- La nota de una tarea nunca puede salir de la escala 0-20 (antes solo lo
-- validaba la pantalla; por la API se aceptaba 67). NOT VALID: no revisa filas viejas.
alter table public.submissions
  add constraint submissions_grade_rango check (grade is null or (grade >= 0 and grade <= 20)) not valid;
