-- =============================================================================
-- ZR APP · MIGRACIÓN 049 · Validación admin, datos para la planilla, cohortes por vendedor
-- =============================================================================
-- Tres cambios de negocio (docs/17..., ajuste post-Sprint 7):
--
-- 1. Ya no hay autoregistro (ni estudiante ni profesor) — el vendedor inscribe
--    y el estudiante queda "pendiente" hasta que administración lo valida
--    después de la firma física de la planilla.
-- 2. La planilla real pide dirección del estudiante y datos completos del
--    representante (parentesco, edad, nacionalidad, profesión) — antes solo
--    se guardaban 4 de los 7 campos porque el consentimiento se llenaba
--    aparte, después, desde el propio estudiante. Ahora los captura el
--    vendedor al momento de la venta (Módulo 1), como dice la planilla real.
-- 3. El vendedor puede dar de alta nuevas cohortes (promociones nuevas de
--    PTMA/PFTA) desde su propia sección "Programas" — sigue sin poder tocar
--    nada de otro estudiante ni cohorte que no sea suya.
-- =============================================================================

alter table public.students
  add column address      text,
  add column validated_at timestamptz,
  add column validated_by uuid references public.profiles(id);

comment on column public.students.validated_at is
  'Cuándo lo validó administración tras la firma física de la planilla. Null = pendiente: solo ve Inicio (mensaje de espera) y Perfil.';

alter table public.parental_consents
  add column representative_relationship text,
  add column representative_age          int,
  add column representative_nationality  text,
  add column representative_occupation   text;

-- El vendedor puede crear cohortes nuevas (promociones) de los programas que
-- ya existen — nunca un programa nuevo, y nunca modificar/borrar cohortes
-- existentes (eso lo hizo administración desde antes en /cohortes).
create policy "vendedor: crear cohortes"
  on public.cohorts for insert to authenticated
  with check ((select public.is_vendedor()));
