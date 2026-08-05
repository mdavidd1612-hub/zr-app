-- =============================================================================
-- ZR APP · MIGRACIÓN 010 · Consentimiento parental (LOPNNA)
-- =============================================================================
-- REQUISITO LEGAL, NO UNA FUNCIÓN DE PRODUCTO. No se recorta, no se aplaza y
-- no se implementa "solo en la interfaz".
--
-- Un estudiante de 15 a 17 años NO puede completar su registro sin que su
-- representante legal haya firmado el consentimiento de creación de cuenta.
-- El bloqueo se implementa con un disparador de base de datos, porque una
-- validación que solo vive en el navegador se salta con una petición directa.
-- =============================================================================

create table public.parental_consents (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references public.students(id) on delete cascade,
  consent_type           public.consent_type not null,
  representative_name    text not null,
  representative_cedula  text not null,
  representative_email   text not null,
  representative_phone   text,
  method                 public.consent_method not null,
  document_url           text,     -- soporte firmado, bucket privado 'consentimientos'
  signed_at              timestamptz not null default now(),
  verified_by            uuid references public.admins(id),
  verified_at            timestamptz,
  created_at             timestamptz not null default now(),
  unique (student_id, consent_type)
);

create index idx_consents_student on public.parental_consents (student_id);
create index idx_consents_pending on public.parental_consents (verified_at) where verified_at is null;

create trigger trg_consents_audit
  after insert or update or delete on public.parental_consents
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- Bloqueo del onboarding para menores sin consentimiento
-- -----------------------------------------------------------------------------
create or replace function public.fn_check_parental_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_minor boolean;
  v_has      boolean;
begin
  if new.onboarding_status <> 'completo' then
    return new;
  end if;

  select public.age_years(new.birth_date) < 18 into v_is_minor;

  if not v_is_minor then
    return new;
  end if;

  select exists (
    select 1 from public.parental_consents
    where student_id = new.id and consent_type = 'account_creation'
  ) into v_has;

  if not v_has then
    raise exception
      'LOPNNA: el estudiante es menor de edad y no tiene consentimiento parental de creación de cuenta registrado.';
  end if;

  return new;
end;
$$;

create trigger trg_check_parental_consent
  before insert or update on public.students
  for each row execute function public.fn_check_parental_consent();

-- -----------------------------------------------------------------------------
-- Vista de apoyo: quién está bloqueado y por qué
-- -----------------------------------------------------------------------------
-- La usa el panel de administración para la cola de consentimientos pendientes.
create or replace view public.v_students_blocked
with (security_invoker = true)
as
select
  v.id,
  v.full_name,
  v.cedula,
  v.contact_email,
  v.age_years,
  v.cohort_id,
  v.onboarding_status,
  (pc.id is null) as missing_consent,
  (pc.id is not null and pc.verified_at is null) as consent_unverified
from public.v_students v
left join public.parental_consents pc
       on pc.student_id = v.id and pc.consent_type = 'account_creation'
where v.is_minor
  and (pc.id is null or pc.verified_at is null);

alter table public.parental_consents enable row level security;
