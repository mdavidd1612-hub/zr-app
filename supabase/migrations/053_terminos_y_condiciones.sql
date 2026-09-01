-- =============================================================================
-- ZR APP · MIGRACIÓN 053 · Términos y condiciones (spec §20, B-1)
-- =============================================================================
-- No existía ningún registro de que un usuario aceptó los términos de la
-- academia. Se agrega la tabla de aceptaciones + el texto y la versión
-- vigente en system_config (regla 5 de CLAUDE.md: el texto y el número de
-- versión no van escritos en el código — subir la versión desde
-- Configuración es lo que dispara que todos deban re-aceptar).
-- =============================================================================

create table public.terms_acceptances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  terms_version int not null,
  accepted_at  timestamptz not null default now(),
  ip_address   text,
  unique (user_id, terms_version)
);

create index idx_terms_acceptances_user on public.terms_acceptances (user_id);

alter table public.terms_acceptances enable row level security;

create policy "propio: leer sus aceptaciones"
  on public.terms_acceptances for select to authenticated
  using (user_id = auth.uid());

create policy "propio: aceptar terminos"
  on public.terms_acceptances for insert to authenticated
  with check (user_id = auth.uid());

create policy "admin: leer todas las aceptaciones"
  on public.terms_acceptances for select to authenticated
  using ((select public.is_admin_up()));

insert into public.system_config (key, value, description, is_public)
values
  ('terms.version', '1',
   'Versión vigente de los Términos y Condiciones. Subir este número (ej. de 1 a 2) obliga a TODOS los usuarios a volver a aceptar en su próximo ingreso.',
   true),
  ('terms.text',
   '"[Texto de Términos y Condiciones pendiente de redacción por administración/asesoría legal. Reemplace este valor completo desde Configuración cuando el texto definitivo esté listo — no requiere ningún despliegue.]"',
   'Texto completo de los Términos y Condiciones que el usuario debe leer antes de aceptar.',
   true)
on conflict (key) do nothing;
