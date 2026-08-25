-- =============================================================================
-- ZR APP · MIGRACIÓN 037 · QR universal de administración (por día, no por cohorte)
-- =============================================================================
-- Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste post-Sprint F): un solo QR que
-- administración muestra en pantalla, válido para TODAS las cohortes que
-- tengan clase ese día. El estudiante lo escanea y `checkin-session` decide
-- a qué sesión pertenece según su propia cohorte — nunca el cliente.
-- =============================================================================

create table public.daily_checkin_codes (
  checkin_date date primary key,
  code         text not null,
  rotated_at   timestamptz not null default now()
);

alter table public.daily_checkin_codes enable row level security;

create policy staff_manage_daily_checkin_codes
  on public.daily_checkin_codes for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
