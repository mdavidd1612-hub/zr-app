-- =============================================================================
-- ZR APP · MIGRACIÓN 098 · Preguntas del feedback de módulo, visibles para el estudiante
-- =============================================================================
-- Bug real reportado por el coordinador durante la primera prueba: al abrir
-- /feedback-modulo, el estudiante no veía ninguna de las 3 preguntas de
-- escala -- solo el comentario de texto libre. Causa: la migración 097
-- insertó 'feedback.macro_questions' con `is_public = false`. La política
-- "todos: leer config publica" (migración 066) solo deja leer una fila de
-- system_config si `is_public` es verdadero o si quien pregunta es
-- super_admin -- un estudiante no es ninguna de las dos cosas, así que la
-- consulta le devolvía vacío y el formulario se quedaba sin preguntas.
--
-- El contenido de las preguntas no es sensible (es lo que cualquier
-- estudiante va a leer en pantalla igual), así que `is_public = true` es lo
-- correcto -- mismo criterio que ya usan otras config públicas (ej.
-- terms.version).
-- =============================================================================

update public.system_config
set is_public = true
where key = 'feedback.macro_questions';
