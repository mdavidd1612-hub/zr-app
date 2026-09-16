-- =============================================================================
-- ZR APP · MIGRACIÓN 099 · Preguntas de redacción independientes del comentario general
-- =============================================================================
-- Pedido del coordinador (sept. 2026): adaptar el formato presencial de
-- feedback (Encuesta_MAY.pdf, 24 preguntas de escala en 4 bloques + 2
-- abiertas) a una versión digital corta -- Pedro pidió una mezcla de opción
-- múltiple y redacción; Nancy (Dirección Académica) señaló que agrupar los 4
-- bloques del presencial en muy pocas preguntas ya no dice qué fue lo malo
-- específicamente. El set que queda -- 5 de escala 1-5 (una por cada aspecto
-- que señaló Nancy) + 2 de redacción -- está pendiente de validación final
-- del coordinador (propuesta_feedback_digital.pdf); esta migración lo deja
-- ARMADO en zr-staging para poder probarlo mientras se valida el contenido.
--
-- Hasta ahora `feedback_macro` solo tenía un comentario libre (`open_text`).
-- Con 2 preguntas de redacción hace falta guardar más de un texto por
-- estudiante -- de ahí `open_answers` (mismo formato [{"q":"...","a":"..."}]
-- que ya usa `answers`, pero como texto en vez de número). `answers` se
-- queda EXCLUSIVO para preguntas de escala: la vista `v_feedback_macro_summary`
-- hace `(q->>'a')::numeric` sobre cada elemento, así que si un texto libre
-- se colara ahí, rompería el promedio de todo el módulo -- separarlos evita
-- ese riesgo de raíz, no hace falta tocar la vista.
-- =============================================================================

alter table public.feedback_macro
  add column open_answers jsonb not null default '[]'::jsonb;

create or replace function public.fn_validate_feedback_macro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int := public.cfg_int('feedback.macro_max_questions', 6);
begin
  if jsonb_typeof(new.answers) <> 'array' then
    raise exception 'feedback_macro.answers debe ser un arreglo JSON.';
  end if;
  if jsonb_array_length(new.answers) > v_max then
    raise exception 'El feedback de módulo admite como máximo % preguntas de escala.', v_max;
  end if;
  if jsonb_typeof(new.open_answers) <> 'array' then
    raise exception 'feedback_macro.open_answers debe ser un arreglo JSON.';
  end if;
  if jsonb_array_length(new.open_answers) > v_max then
    raise exception 'El feedback de módulo admite como máximo % preguntas de redacción.', v_max;
  end if;
  return new;
end;
$$;

-- Contenido propuesto (docs/propuesta_feedback_digital.pdf) -- reemplaza el
-- placeholder de la migración 097. Sigue editable sin desplegar nada nuevo
-- desde /feedback-modulos (Dirección Académica).
update public.system_config
set value = '[
  {"id":"docente_dominio",  "texto":"¿Cómo calificarías el dominio del tema y la claridad del profesor al explicar?",                              "tipo":"escala_1_5"},
  {"id":"docente_grupo",    "texto":"¿Cómo calificarías el manejo del grupo por parte del profesor? (responde bien las preguntas, respeta las ideas)", "tipo":"escala_1_5"},
  {"id":"utilidad",         "texto":"¿Qué tan útil te pareció el contenido de este módulo para lo que vas a hacer en el taller?",                    "tipo":"escala_1_5"},
  {"id":"practica",         "texto":"¿Cómo calificarías la organización y el material disponible para las prácticas? (completo, orden, limpieza)",   "tipo":"escala_1_5"},
  {"id":"logistica",        "texto":"¿Cómo calificarías la logística general del módulo? (horario, salón, atención recibida)",                       "tipo":"escala_1_5"},
  {"id":"mejorar",          "texto":"¿Qué aspectos consideras que podríamos mejorar?",                                                                "tipo":"redaccion"},
  {"id":"sugerencias",      "texto":"¿Qué te gustó más de este módulo, o qué te gustaría que exploráramos en los próximos?",                          "tipo":"redaccion"}
]'::jsonb
where key = 'feedback.macro_questions';
