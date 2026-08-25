-- =============================================================================
-- ZR APP · MIGRACIÓN 036 · Código de asistencia mostrado por administración
-- =============================================================================
-- Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint F): nueva regla de la academia
-- — administración muestra un QR en pantalla y el ESTUDIANTE lo escanea
-- (antes era al revés, ver 006_attendance.sql). Este código NO es el TOTP
-- del estudiante: es uno nuevo, por sesión de clase, que cambia cada vez
-- que alguien lo usa con éxito. La validación y el registro de asistencia
-- SIEMPRE ocurren en la Edge Function `checkin-session`, nunca en el
-- cliente — regla 2 de AGENTS.md.
-- =============================================================================

create table public.session_checkin_codes (
  session_id uuid primary key references public.class_sessions(id) on delete cascade,
  code       text not null,
  issued_by  uuid references public.profiles(id),
  rotated_at timestamptz not null default now()
);

alter table public.session_checkin_codes enable row level security;

-- Solo personal (admin/profesor/direccion/super_admin) puede ver y rotar el
-- código — es lo que se muestra en la pantalla que el estudiante escanea.
-- El estudiante nunca lo lee de la base: lo lee de la cámara.
create policy staff_manage_checkin_codes
  on public.session_checkin_codes for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
