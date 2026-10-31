-- =============================================================================
-- ZR APP · MIGRACIÓN 187 · Bloques de texto dentro de la unidad
-- =============================================================================
-- content_items.type = 'texto' no viene de un archivo subido ni de un enlace:
-- el cuerpo vive en `description` (ya existente, ya nullable). Se amplía el
-- CHECK que hasta ahora exigía storage_path para todo lo que no fuera
-- 'enlace', para exceptuar también 'texto'.
-- =============================================================================
alter table public.content_items drop constraint chk_content_source;

alter table public.content_items add constraint chk_content_source check (
  (type = 'enlace' and external_url is not null)
  or (type = 'texto' and description is not null)
  or (type not in ('enlace', 'texto') and storage_path is not null)
);

comment on column public.content_items.description is
  'Para type=texto (migración 187): es el CUERPO del bloque (párrafo), no una descripción opcional. Para los demás tipos sigue siendo descripción libre, opcional.';
