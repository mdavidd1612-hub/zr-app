-- =============================================================================
-- ZR APP · MIGRACIÓN 050 · v_students expone address y validated_at
-- =============================================================================
-- Las columnas nuevas de la migración 049 (students.address, .validated_at)
-- no eran visibles desde la vista que usa el frontend. Se agregan al final
-- del select para no romper el orden de columnas de una vista existente
-- (CREATE OR REPLACE VIEW no deja renombrar/reordenar columnas ya expuestas).
-- =============================================================================

create or replace view public.v_students
with (security_invoker = true)
as
select
  s.id,
  s.birth_date,
  s.cohort_id,
  s.enrollment_date,
  s.onboarding_status,
  s.emergency_contact_name,
  s.emergency_contact_phone,
  s.created_at,
  p.full_name,
  p.cedula,
  p.contact_email,
  p.phone,
  p.avatar_url,
  p.status,
  public.age_years(s.birth_date)        as age_years,
  public.age_years(s.birth_date) < 18   as is_minor,
  s.address,
  s.validated_at
from public.students s
join public.profiles p on p.id = s.id;
