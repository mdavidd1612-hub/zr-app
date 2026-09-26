-- =============================================================================
-- ZR APP · MIGRACIÓN 112 · Refrigerio -- corrige la dirección del escaneo
-- =============================================================================
-- Corrección explícita del coordinador (sept. 2026) sobre la migración 104:
-- había quedado al revés. Es la CANTINA (ZR Coffee) la que MUESTRA un QR en
-- pantalla, y el ESTUDIANTE lo escanea con su propio teléfono -- exactamente
-- el mismo patrón ya usado para la asistencia (`daily_checkin_codes`,
-- migración 037, y `/qr` + `checkin-session`), no el patrón del carnet.
--
-- El código rota cada vez que alguien lo usa con éxito (igual que el de
-- asistencia): fotografiarlo no sirve, porque para cuando alguien más lo
-- reciba por WhatsApp ya cambió.
-- =============================================================================

create table public.daily_snack_codes (
  checkin_date date primary key,
  code         text not null,
  rotated_at   timestamptz not null default now()
);

alter table public.daily_snack_codes enable row level security;

create policy "cantina: administra el codigo de hoy"
  on public.daily_snack_codes for all
  to authenticated
  using ((select public.auth_role()) in ('zr_coffee', 'admin', 'super_admin'))
  with check ((select public.auth_role()) in ('zr_coffee', 'admin', 'super_admin'));
