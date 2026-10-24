-- =============================================================================
-- ZR APP · MIGRACIÓN 181 · Aula Virtual — sin descarga por defecto
-- =============================================================================
-- Pedido explícito del coordinador (oct. 2026): el material se ve incrustado
-- en la página (PDF.js, reproductor de video, lo que sea), nunca se ofrece
-- el botón de descarga salvo que el profesor lo active a propósito para ESE
-- material. Antes el valor por defecto de content_items.allow_download era
-- true (permitía descargar salvo que se desactivara); se invierte.
--
-- El mecanismo para servir "solo visor, sin descarga" YA EXISTE y ya se usa
-- en producción (app/(app)/contenido/page.tsx): createSignedUrl() SIN la
-- opción `download` sirve el archivo para verlo en el navegador; CON esa
-- opción, fuerza la descarga. Lo único que cambia aquí es el valor por
-- defecto de la bandera que la pantalla ya respeta.
-- =============================================================================

alter table public.content_items
  alter column allow_download set default false;

comment on column public.content_items.allow_download is
  'spec/07_AULA_VIRTUAL.md §5.3: por defecto false -- el material se ve incrustado (visor/reproductor), nunca con botón de descarga, salvo que el profesor lo active a propósito para ese material (pedido explícito del coordinador, oct. 2026).';
