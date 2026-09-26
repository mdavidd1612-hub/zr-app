-- =============================================================================
-- ZR APP · MIGRACIÓN 116 · v_students expone payment_status
-- =============================================================================
-- payment_status (migración 115) no era visible desde la vista que usa el
-- frontend. Se agrega al final del select, mismo criterio que la migración
-- 050 (CREATE OR REPLACE VIEW no deja reordenar columnas ya expuestas).
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
  s.validated_at,
  s.payment_status
from public.students s
join public.profiles p on p.id = s.id;
