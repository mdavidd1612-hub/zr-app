-- La compuerta real entre unidades (migración 185) se aplicó en la política
-- de SELECT de unit_items (vía unit_prerequisite_met), pero content_items
-- tiene su propia columna unit_id y su propia política de SELECT para
-- estudiante que NO consultaba la compuerta. Un estudiante con el módulo
-- correcto podía leer directamente (sin pasar por unit_items) el contenido
-- de una unidad todavía bloqueada por certificación pendiente -- el bloqueo
-- quedaba solo del lado de unit_items, no en content_items mismo.
--
-- Detectado en el chequeo masivo de zr-staging del 7-nov-2026 (0 filas de
-- content_items usan unit_id todavía, así que no se explotó en la práctica,
-- pero es la misma columna que usan los "bloques de texto" de la migración
-- 187). Aplicado primero a mano contra zr-staging durante ese chequeo;
-- este archivo es ese mismo cambio, para que quede en el historial.

drop policy if exists "estudiante: leer contenido publicado de sus modulos cursados" on public.content_items;

create policy "estudiante: leer contenido publicado de sus modulos cursados"
on public.content_items
for select
to public
using (
  is_published
  and (visible_from is null or visible_from <= now())
  and (module_id in (select mis_modulos_cursados()))
  and (cohort_id is null or cohort_id = mi_cohorte_estudiante())
  and (select estudiante_solvente())
  and (unit_id is null or unit_prerequisite_met(unit_id, auth.uid()))
);
