-- =============================================================================
-- ZR APP · MIGRACIÓN 024 · Profesor puede borrar sus propios borradores
-- =============================================================================
-- La política de DELETE en exams solo permitía is_admin_up(). El profesor
-- no podía borrar sus propios exámenes → el cliente los quitaba de la UI
-- pero la BD los devolvía en el siguiente fetch.
-- Solo se permite borrar exámenes en estado 'oculto' (borrador); los
-- publicados o calificados los puede eliminar únicamente un admin.
-- =============================================================================

drop policy if exists "profesor borra sus borradores" on public.exams;

create policy "profesor borra sus borradores"
  on public.exams for delete to authenticated
  using (
    teacher_id = auth.uid()
    and status = 'oculto'
  );
