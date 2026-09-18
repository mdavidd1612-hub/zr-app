-- =============================================================================
-- ZR APP · MIGRACIÓN 100 · Pregunta final de recomendación en el feedback de módulo
-- =============================================================================
-- Pedido del coordinador (sept. 2026, tras validar el set de 7 preguntas):
-- agregar al final una pregunta tipo "¿Nos recomendarías?". Va como escala
-- 1-5 (no sí/no) para que entre al mismo promedio y a la misma gráfica que
-- el resto sin tocar la vista `v_feedback_macro_summary`. Se AGREGA al final
-- de lo que haya en 'feedback.macro_questions' (no se reemplaza), por si
-- Dirección Académica ya ajustó alguna pregunta desde la pantalla.
-- =============================================================================

update public.system_config
set value = value || '[
  {"id":"recomendacion", "texto":"¿Nos recomendarías a un amigo o familiar? (1 = nada probable, 5 = muy probable)", "tipo":"escala_1_5"}
]'::jsonb
where key = 'feedback.macro_questions'
  and not exists (
    select 1 from jsonb_array_elements(value) q where q ->> 'id' = 'recomendacion'
  );
