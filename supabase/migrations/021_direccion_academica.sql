-- =============================================================================
-- ZR APP · MIGRACIÓN 021 · Rol Dirección Académica + solicitudes de profesor
-- =============================================================================
-- Decisión acordada con la academia: "direccion_academica" es un rol nuevo,
-- al mismo nivel que super_admin pero con enfoque distinto — super_admin sigue
-- a cargo de system_config/cohortes/config técnica; direccion_academica se
-- encarga de aprobar profesores nuevos, permisos de personal, y supervisar o
-- corregir notas de estudiantes y profesores.
--
-- Flujo de profesor nuevo: se registra (queda como 'estudiante', regla #9 de
-- AGENTS.md: el rol nunca lo decide el cliente), marca "¿Eres profesor?" al
-- iniciar sesión, queda en professor_applications con status 'pendiente' y
-- Dirección Académica recibe notificación. Solo al aprobar (Edge Function
-- approve-professor, con service_role) el rol pasa a 'profesor' de verdad.
-- =============================================================================

alter type public.user_role add value 'direccion_academica';

-- -----------------------------------------------------------------------------
-- Solicitudes de acceso como profesor
-- -----------------------------------------------------------------------------
create table public.professor_applications (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  full_name     text not null,
  cedula        text not null,
  contact_email text not null,
  phone         text,
  status        text not null default 'pendiente'
                  check (status in ('pendiente', 'aprobado', 'rechazado')),
  cohort_id     uuid references public.cohorts(id),
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Un estudiante no puede tener dos solicitudes pendientes a la vez.
create unique index idx_professor_app_una_pendiente
  on public.professor_applications (profile_id)
  where status = 'pendiente';

create index idx_professor_app_status on public.professor_applications (status);

alter table public.professor_applications enable row level security;

create policy "dueno_ve_su_solicitud" on public.professor_applications
  for select using (auth.uid() = profile_id);

create policy "dueno_crea_su_solicitud" on public.professor_applications
  for insert with check (auth.uid() = profile_id);

create policy "direccion_ve_todas" on public.professor_applications
  for select using (
    (select role from public.profiles where id = auth.uid())
      in ('direccion_academica', 'super_admin')
  );

-- -----------------------------------------------------------------------------
-- Catálogo de notificaciones: se agrega 'profesor_pendiente' (Fase 1 + este
-- requerimiento explícito de la academia, no una adición libre).
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'examen_habilitado',
    'nota_publicada',
    'consentimiento_pendiente',
    'feedback_disponible',
    'profesor_pendiente'
  ));

create or replace function public.fn_notify_professor_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, body, payload)
  select p.id,
         'profesor_pendiente',
         'Nuevo profesor por verificar',
         new.full_name || ' solicitó acceso como profesor. Revisa sus datos y asígnale un curso.',
         jsonb_build_object('application_id', new.id)
  from public.profiles p
  where p.role in ('direccion_academica', 'super_admin');

  return new;
end;
$$;

create trigger trg_notify_professor_pending
  after insert on public.professor_applications
  for each row execute function public.fn_notify_professor_pending();
