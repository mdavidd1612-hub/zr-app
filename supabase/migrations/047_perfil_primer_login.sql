-- =============================================================================
-- ZR APP · MIGRACIÓN 046 · Formulario digital del primer login
-- =============================================================================
-- especificacion-funcional-zrm-academy.md, sección 5.3: 11 preguntas
-- obligatorias (+ salud, opcional) que el estudiante completa la primera vez
-- que entra, y que nunca se le repiten. `birth_date` ya existe en `students`
-- desde la migración 003, así que no se vuelve a pedir aquí.
-- docs/17_PLAN_CONSOLIDADO_CURRICULUM_Y_COORDINADOR.md, Sprint 6.
--
-- Se reusa `students.onboarding_status` (ya existía, migración 003) como la
-- señal de "¿ya llenó el formulario?" — 'en_curso' hasta que exista su fila
-- aquí, 'completo' después. Así el resto de la app no necesita otra columna.
-- =============================================================================

create table public.student_profile_details (
  id                       uuid primary key default gen_random_uuid(),
  student_id               uuid not null unique references public.students(id) on delete cascade,
  nationality              text not null check (nationality in ('venezolana', 'extranjera', 'otra')),
  gender                   text not null check (gender in ('femenino', 'masculino', 'otro')),
  marital_status           text not null check (marital_status in ('soltero', 'casado', 'divorciado', 'viudo', 'union_estable', 'otro')),
  ethnicity                text not null check (ethnicity in ('si', 'no', 'otra')),
  employment_status        text not null check (employment_status in ('ocupado_dependiente', 'ocupado_independiente', 'desempleado', 'otra')),
  currently_studying       boolean not null,
  has_teaching_experience  boolean not null,
  teaching_area            text,
  years_of_experience      int check (years_of_experience is null or years_of_experience >= 0),
  education_level          text not null check (education_level in ('bachillerato', 'tecnico', 'universitario', 'postgrado')),
  education_status         text not null check (education_status in ('en_curso', 'incompleto', 'completo')),
  current_school_grade     text,
  -- Dato sensible (salud): opcional, y solo lo ve admin/profesor de su
  -- cohorte porque esta tabla comparte la misma política que `students`
  -- (can_see_student) — nunca todo el personal.
  health_conditions        text[] not null default '{}',
  completed_at             timestamptz not null default now(),

  constraint chk_experiencia_condicional check (
    has_teaching_experience or (teaching_area is null and years_of_experience is null)
  )
);

alter table public.student_profile_details enable row level security;

create policy "estudiante: leer su formulario"
  on public.student_profile_details for select to authenticated
  using (student_id = auth.uid());

create policy "estudiante: llenar su formulario una vez"
  on public.student_profile_details for insert to authenticated
  with check (student_id = auth.uid());

create policy "personal: leer formularios de su cohorte"
  on public.student_profile_details for select to authenticated
  using ((select public.can_see_student(student_id)));

create policy "admin: gestionar formularios"
  on public.student_profile_details for all to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));

create or replace function public.fn_marcar_onboarding_completo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.students set onboarding_status = 'completo' where id = new.student_id;
  return new;
end;
$$;

create trigger trg_marcar_onboarding_completo
  after insert on public.student_profile_details
  for each row execute function public.fn_marcar_onboarding_completo();
