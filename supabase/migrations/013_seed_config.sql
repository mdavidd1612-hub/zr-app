-- =============================================================================
-- ZR APP · MIGRACIÓN 013 · Valores iniciales de configuración
-- =============================================================================
-- Estos son los ÚNICOS lugares donde viven los números de negocio.
-- Si encuentras alguno de estos valores escrito dentro del código de la
-- aplicación, es un error: reemplázalo por una lectura de esta tabla.
--
-- 'is_public = true' significa que cualquier usuario autenticado puede leerlo
-- (la app necesita saber, por ejemplo, cuánto dura la ventana del QR).
-- =============================================================================

insert into public.system_config (key, value, description, is_public) values

  -- Calificación ------------------------------------------------------------
  ('module.passing_threshold_first',   '10'::jsonb,
   'Nota mínima para aprobar el PRIMER módulo del programa. Regla excepcional de arranque.', true),

  ('module.passing_threshold_default', '12'::jsonb,
   'Nota mínima para aprobar del segundo módulo en adelante.', true),

  ('module.participation_weight_min',  '0.05'::jsonb,
   'Peso mínimo de la participación en la nota final. Cada profesor fija el suyo por encima de este piso.', true),

  ('exam.max_score',                   '20'::jsonb,
   'Escala de todas las evaluaciones internas.', true),

  ('exam.individual_passing_score',    '10'::jsonb,
   'Nota mínima para aprobar una evaluación individual.', true),

  -- Asistencia --------------------------------------------------------------
  ('attendance.qr_window_seconds',     '30'::jsonb,
   'Duración de cada código QR rotatorio, en segundos.', true),

  ('attendance.qr_drift_tolerance',    '1'::jsonb,
   'Ventanas de tolerancia hacia adelante y atrás, por desfase de reloj entre dispositivos.', false),

  -- Feedback ----------------------------------------------------------------
  ('feedback.micro_max_questions',     '3'::jsonb,
   'Máximo de preguntas del feedback por clase. Debe responderse en menos de 20 segundos.', true),

  ('feedback.min_responses_to_show',   '3'::jsonb,
   'Respuestas mínimas antes de mostrarle el agregado al profesor. Impide identificar quién opinó qué.', false),

  -- Operación ---------------------------------------------------------------
  ('grading.sla_hours',                '72'::jsonb,
   'Horas objetivo para calificar una redacción abierta. Se usa en reportes, no bloquea nada.', false),

  ('app.support_channel',              '"Contacta a coordinación en la sede"'::jsonb,
   'Texto que se muestra al estudiante cuando algo falla.', true)

on conflict (key) do nothing;
