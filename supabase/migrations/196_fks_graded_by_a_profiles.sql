-- 196: Varias columnas "quién hizo esto" apuntaban a teachers(id) en vez de
-- profiles(id) -- bug real reportado por el coordinador (7-nov-2026, captura
-- de pantalla): al calificar una redacción como super_admin, grade-answer
-- fallaba con "Key (graded_by)=(...) is not present in table teachers"
-- (foreign key violation, exam_answers_graded_by_fkey). La tabla `teachers`
-- solo tiene 3 filas (profesores de verdad) -- Dirección Académica y
-- super_admin nunca van a estar ahí, aunque hoy pueden calificar, crear y
-- publicar exámenes igual que un profesor (todo el trabajo de esta sesión).
--
-- Se relajan a profiles(id) SOLO las columnas que significan "qué miembro
-- del personal hizo esta acción" (calificar, publicar, aprobar) -- nunca se
-- tocan las que significan "quién es EL profesor asignado de verdad"
-- (cohorts.teacher_id, class_sessions.teacher_id,
-- teacher_module_assignments.teacher_id): esas siguen siendo
-- exclusivamente de teachers, a propósito.
--
-- Cambio seguro: teachers.id YA referencia profiles(id) (mismo patrón que
-- students), así que todo valor que hoy es válido en teachers(id) sigue
-- siendo válido en profiles(id) -- no hace falta tocar ni una fila de datos.

alter table public.exam_answers
  drop constraint exam_answers_graded_by_fkey,
  add constraint exam_answers_graded_by_fkey
    foreign key (graded_by) references public.profiles(id) on delete set null;

alter table public.submissions
  drop constraint submissions_graded_by_fkey,
  add constraint submissions_graded_by_fkey
    foreign key (graded_by) references public.profiles(id);

alter table public.exams
  drop constraint exams_teacher_id_fkey,
  add constraint exams_teacher_id_fkey
    foreign key (teacher_id) references public.profiles(id) on delete set null;

alter table public.exams
  drop constraint exams_published_by_fkey,
  add constraint exams_published_by_fkey
    foreign key (published_by) references public.profiles(id) on delete set null;

alter table public.exam_rehabilitation_requests
  drop constraint exam_rehabilitation_requests_responded_by_fkey,
  add constraint exam_rehabilitation_requests_responded_by_fkey
    foreign key (responded_by) references public.profiles(id) on delete set null;

alter table public.intervention_grants
  drop constraint intervention_grants_granted_by_fkey,
  add constraint intervention_grants_granted_by_fkey
    foreign key (granted_by) references public.profiles(id);

alter table public.mastery_map
  drop constraint mastery_map_marked_by_fkey,
  add constraint mastery_map_marked_by_fkey
    foreign key (marked_by) references public.profiles(id) on delete set null;
