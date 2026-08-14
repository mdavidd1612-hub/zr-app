-- =============================================================================
-- ZR APP · MIGRACIÓN 027 · Profesor puede borrar cualquiera de sus exámenes
-- =============================================================================
-- Se relaja la restricción de 024: antes solo se podían borrar borradores
-- (status = 'oculto'). Ahora el profesor puede eliminar también sus exámenes
-- publicados, cerrados y calificados.
-- =============================================================================

drop policy if exists "profesor borra sus borradores" on public.exams;

create policy "profesor borra sus examenes"
  on public.exams for delete to authenticated
  using (teacher_id = auth.uid());
