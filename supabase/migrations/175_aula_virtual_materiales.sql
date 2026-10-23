-- =============================================================================
-- ZR APP · MIGRACIÓN 175 · Aula Virtual — Fase 2: materiales
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md §1 y §5: se extiende content_items (008) en vez de
-- crear una tabla 'materials' paralela. material_progress reemplaza la
-- función de content_views (que solo guardaba un viewed_at) con el formato
-- rico que pide el documento: segmentos vistos, porcentaje, validación.
--
-- Regla de negocio (AGENTS.md §2.5): nada de umbrales sueltos en el código.
-- El % para considerar un material "completado" vive en system_config.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. content_items — columnas nuevas de la Fase 2
-- -----------------------------------------------------------------------------
-- unit_id nullable a propósito: el contenido que ya existe (pre-aula-virtual,
-- organizado solo por módulo/semana) sigue funcionando sin pertenecer a
-- ninguna unidad todavía.
alter table public.content_items
  add column unit_id         uuid references public.units(id),
  add column allow_download  boolean not null default true,
  add column duration_seconds int,
  add column show_progress   boolean not null default true,
  add column check_quiz_id   uuid references public.exams(id);

create index idx_content_unit on public.content_items (unit_id) where unit_id is not null;

comment on column public.content_items.allow_download is
  'spec/07_AULA_VIRTUAL.md §5.3: con false, solo se sirve por el visor con URL firmada de vida corta, sin botón de descarga.';
comment on column public.content_items.check_quiz_id is
  'Mini-chequeo opcional al terminar el material (spec §6.3). Se implementa en la Fase 4 (migración 177).';

-- -----------------------------------------------------------------------------
-- 2. Configuración de negocio nueva
-- -----------------------------------------------------------------------------
insert into public.system_config (key, value, description, is_public) values
  ('aula.material_progress_completado_pct', '90', '% de segmentos vistos para marcar un material como completado (spec/07_AULA_VIRTUAL.md §6.1).', true),
  ('aula.material_progress_guardar_cada_seg', '15', 'Cada cuántos segundos el cliente guarda el progreso de un material (spec §6.1). Solo informativo para el cliente -- el servidor no lo hace cumplir.', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. material_progress — reemplaza el rol de content_views
-- -----------------------------------------------------------------------------
-- content_views (008) se deja tal cual (no se edita una migración aplicada);
-- simplemente deja de ser lo que alimenta el seguimiento de la Fase 2 en
-- adelante. Nada la borra ni la vacía.
create table public.material_progress (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete cascade,
  segments         jsonb not null default '[]',   -- [[inicio_seg, fin_seg], ...] vistos de verdad, no solo la posición final
  percent          numeric(5,2) not null default 0 check (percent between 0 and 100),
  first_viewed_at  timestamptz not null default now(),
  last_viewed_at   timestamptz not null default now(),
  completed_at     timestamptz,
  validated        boolean not null default false,  -- true solo cuando el mini-chequeo (Fase 4) se aprueba
  unique (student_id, content_item_id)
);

create index idx_material_progress_student on public.material_progress (student_id);
create index idx_material_progress_content on public.material_progress (content_item_id);

-- -----------------------------------------------------------------------------
-- 4. Completado automático al cruzar el umbral
-- -----------------------------------------------------------------------------
-- El "100% exacto" falla con créditos finales o saltos pequeños de un video
-- (spec §6.1) -- por eso el umbral es configurable, no fijo en 100.
create or replace function public.fn_material_progress_touch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_umbral int := public.cfg_int('aula.material_progress_completado_pct', 90);
begin
  new.last_viewed_at := now();
  if new.percent >= v_umbral and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_material_progress_touch
  before insert or update on public.material_progress
  for each row execute function public.fn_material_progress_touch();

-- -----------------------------------------------------------------------------
-- 5. Guarda de 'validated' (mismo patrón que fn_profiles_guard, 011)
-- -----------------------------------------------------------------------------
-- 'validated' solo lo pone en true la lógica de servidor del mini-chequeo
-- (Fase 4, migración 177) -- nunca el propio estudiante actualizando su fila
-- de progreso. Sin esta guarda, la política de "estudiante: actualizar su
-- progreso" de abajo le dejaría marcarse el chequeo como aprobado sin
-- presentarlo.
create or replace function public.fn_material_progress_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() es null cuando escribe el servidor (service_role) o una
  -- función SECURITY DEFINER del lado del servidor -- ese caso ya pasó por
  -- su propia validación (aprobar el mini-chequeo).
  if auth.uid() is null then
    return new;
  end if;

  if new.validated is distinct from old.validated and not (select public.is_staff()) then
    raise exception 'El campo validated solo lo cambia el servidor al aprobar el mini-chequeo.';
  end if;

  return new;
end;
$$;

create trigger trg_material_progress_guard
  before update on public.material_progress
  for each row execute function public.fn_material_progress_guard();

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.material_progress enable row level security;

create policy "estudiante: leer su progreso"
  on public.material_progress for select to authenticated
  using (student_id = auth.uid());

create policy "estudiante: registrar su progreso"
  on public.material_progress for insert to authenticated
  with check (student_id = auth.uid());

create policy "estudiante: actualizar su progreso"
  on public.material_progress for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "personal: leer progreso"
  on public.material_progress for select to authenticated
  using ((select public.is_staff()));
