-- 243 · v_exam_best_score vuelve a respetar los permisos de quien consulta (21-nov-2026).
--
-- La 207_remedial la recreó sin "security_invoker", así que corría con los permisos de su dueño:
-- cualquier estudiante podía consultarla por la API y ver la mejor nota de examen de otros.
-- La app no la lee directo (solo funciones del servidor, que no dependen de esto).
alter view public.v_exam_best_score set (security_invoker = true);
