-- =============================================================================
-- ZR APP · MIGRACIÓN 055 · Video en el Classroom + tope de tamaño (B-4)
-- =============================================================================
-- especificacion-funcional-zrm-academy.md §6: el Classroom acepta más que
-- PDF, y hay que "minimizar fricción" — no forzar descarga para ver un
-- archivo. Esta migración solo habilita el tipo; el visor inline va en el
-- frontend (app/(app)/contenido/page.tsx).
-- =============================================================================

alter type public.content_type add value if not exists 'video';

insert into public.system_config (key, value, description, is_public)
values (
  'content.max_size_mb', '200',
  'Tamaño máximo, en MB, para un archivo subido al Classroom (PDF o video).',
  true
)
on conflict (key) do nothing;
