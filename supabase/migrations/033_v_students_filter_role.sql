-- =============================================================================
-- ZR APP · MIGRACIÓN 033 · v_students filtra explícitamente por role='estudiante'
-- =============================================================================
-- Si alguien se registra como estudiante y luego se le cambia el rol a
-- profesor/admin, su fila en students queda huérfana y aparecía en la
-- lista de estudiantes. El filtro WHERE p.role = 'estudiante' lo evita.

CREATE OR REPLACE VIEW public.v_students AS
SELECT
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
  age_years(s.birth_date) AS age_years,
  (age_years(s.birth_date) < 18) AS is_minor
FROM public.students s
JOIN public.profiles p ON p.id = s.id
WHERE p.role = 'estudiante';
