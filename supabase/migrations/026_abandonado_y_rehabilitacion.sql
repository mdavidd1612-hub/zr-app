-- =============================================================================
-- ZR APP · MIGRACIÓN 026 · Estado 'abandonado' + políticas de rehabilitación
-- =============================================================================
-- 1. Agrega el valor 'abandonado' al enum attempt_status.
--    Un intento abandonado ocurre cuando el estudiante sale del examen a
--    mitad; pierde su nota y debe solicitar rehabilitación al profesor.
-- 2. Corrige las políticas RLS de exam_rehabilitation_requests:
--    - Permite al estudiante insertar su propia solicitud (faltaba en 025).
--    - Permite al profesor actualizar (aprobar/rechazar) la solicitud.
-- =============================================================================

-- 1. Nuevo valor en el enum (Postgres no permite borrar valores de enum,
--    así que se agrega al final)
alter type public.attempt_status add value 'abandonado';

-- 2. Política que faltaba: el estudiante inserta su solicitud.
--    Solo puede hacerlo si el intento está en estado 'abandonado'.
drop policy if exists "estudiante_inserta_rehab" on public.exam_rehabilitation_requests;
create policy "estudiante_inserta_rehab"
  on public.exam_rehabilitation_requests
  for insert
  to authenticated
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_id
        and a.student_id = auth.uid()
        and a.status = 'abandonado'
    )
  );

-- 3. El estudiante puede actualizar su solicitud solo mientras está pendiente
--    (por ejemplo para cambiar el motivo antes de que el profesor responda).
drop policy if exists "estudiante_actualiza_rehab_pendiente" on public.exam_rehabilitation_requests;
create policy "estudiante_actualiza_rehab_pendiente"
  on public.exam_rehabilitation_requests
  for update
  to authenticated
  using (auth.uid() = student_id and status = 'pendiente')
  with check (auth.uid() = student_id);

-- 4. Permite a los profesores ver y gestionar las solicitudes
--    (la política 'personal_lee_todas_rehab' de 025 usa 'for all',
--     pero su using() bloquea inserts del estudiante; aquí se separan
--     correctamente los privilegios de profesor).
-- La política "personal_lee_todas_rehab" ya existente con 'for all' cubre
-- SELECT + UPDATE + DELETE para profesores. No necesita cambios.
