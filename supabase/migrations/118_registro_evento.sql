-- =============================================================================
-- ZR APP · MIGRACIÓN 118 · Registro público para el evento (landing /evento)
-- =============================================================================
-- Pedido del coordinador (oct. 2026): una página pública, sin login, donde
-- quien quiera ir al evento deja su nombre, teléfono, correo y por dónde se
-- enteró, y confirma su asistencia. La lista queda en Supabase para que la
-- academia sepa quién va. El enlace va en historias de Instagram.
--
-- Qué se permite y qué no (RLS, regla 1 de AGENTS.md):
--   - Cualquiera (anon) puede INSERTAR su propio registro. Nada más: no puede
--     leer, editar ni borrar ninguno -- ni siquiera el suyo. Los datos de
--     contacto de otras personas nunca salen por la API pública.
--   - Solo admin y super_admin pueden LEER la lista.
--   - Nadie edita ni borra por la API (la lista es un registro).
--
-- Los datos del evento que se muestran en la página (nombre, fecha, hora,
-- lugar) viven en system_config y se editan desde /configuracion sin
-- desplegar (regla 5). Como `system_config` solo la lee un usuario con
-- sesión, la página los pide por una función que expone ÚNICAMENTE esas
-- cuatro claves.
-- =============================================================================

create table public.event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_key     text not null default 'evento_1',
  full_name     text not null check (char_length(trim(full_name)) between 2 and 120),
  phone         text not null check (regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,13}$'),
  email         text not null check (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source        text not null check (source in ('instagram', 'whatsapp', 'tiktok', 'amigo_familiar', 'estudiante_zr', 'otro')),
  source_detail text check (source_detail is null or char_length(source_detail) <= 120),
  consent       boolean not null check (consent = true),
  created_at    timestamptz not null default now()
);

-- Un mismo teléfono no se registra dos veces para el mismo evento (se compara
-- solo con los dígitos, así "0414-123 4567" y "04141234567" son el mismo).
create unique index idx_event_registrations_telefono
  on public.event_registrations (event_key, regexp_replace(phone, '\D', '', 'g'));

create index idx_event_registrations_created on public.event_registrations (created_at desc);

alter table public.event_registrations enable row level security;

create policy "publico: registrarse al evento"
  on public.event_registrations for insert
  to anon, authenticated
  with check (consent = true);

create policy "admin: ver registros del evento"
  on public.event_registrations for select
  to authenticated
  using ((select public.auth_role()) in ('admin', 'super_admin'));

-- -----------------------------------------------------------------------------
-- Datos del evento para la página pública
-- -----------------------------------------------------------------------------
insert into public.system_config (key, value, description, is_public)
values
  ('evento.nombre', '"Evento ZR Mecademy"', 'Nombre del evento que se muestra en la página pública /evento.', true),
  ('evento.fecha',  '""', 'Fecha del evento, como se quiere mostrar. Ej.: "Domingo 4 de octubre". Vacío = no se muestra.', true),
  ('evento.hora',   '""', 'Hora del evento, como se quiere mostrar. Ej.: "9:00 a.m.". Vacío = no se muestra.', true),
  ('evento.lugar',  '""', 'Lugar del evento, como se quiere mostrar. Vacío = no se muestra.', true)
on conflict (key) do nothing;

create or replace function public.get_evento_info()
returns table (nombre text, fecha text, hora text, lugar text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select value #>> '{}' from public.system_config where key = 'evento.nombre'), 'Evento ZR Mecademy'),
    coalesce((select value #>> '{}' from public.system_config where key = 'evento.fecha'), ''),
    coalesce((select value #>> '{}' from public.system_config where key = 'evento.hora'), ''),
    coalesce((select value #>> '{}' from public.system_config where key = 'evento.lugar'), '');
$$;

revoke all on function public.get_evento_info() from public;
grant execute on function public.get_evento_info() to anon, authenticated;
