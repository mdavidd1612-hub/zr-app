-- =============================================================================
-- ZR APP · MIGRACIÓN 174 · Aula Virtual — Fase 1: unidades
-- =============================================================================
-- spec/07_AULA_VIRTUAL.md. Fase 1 del plan: modelo de datos, RLS, estado
-- automático/manual de apertura y cierre. Sin UI todavía (es trabajo de Marco).
--
-- unit_items no usa una columna de referencia polimórfica -- rompería las
-- llaves foráneas. Tiene tres columnas nullable (content_item_id, exam_id,
-- assignment_id) con una restricción que exige que exactamente una coincida
-- con el `type`, salvo 'dudas', que no referencia nada.
--
-- `assignment_id` referencia una tabla que todavía no existe (assignments
-- llega en la Fase 5, migración 178) -- se deja sin FK por ahora y la 178
-- agrega la restricción con ALTER TABLE cuando la tabla exista. Es la forma
-- correcta de resolver esto sin editar esta migración después de aplicada.
-- =============================================================================

create type public.unit_item_type as enum (
  'material',
  'quiz',
  'tarea',
  'dudas'
);

-- Override manual del profesor. null = el estado se calcula solo por fechas
-- (ver public.unit_effective_status más abajo).
create type public.unit_manual_status as enum (
  'abierta',
  'cerrada'
);

-- -----------------------------------------------------------------------------
-- 1. units
-- -----------------------------------------------------------------------------
create table public.units (
  id                  uuid primary key default gen_random_uuid(),
  module_id           uuid not null references public.modules(id) on delete cascade,
  title               text not null,
  order_index         int  not null check (order_index >= 1),
  open_at             timestamptz,              -- null = borrador
  close_at            timestamptz,
  manual_status       public.unit_manual_status,
  prerequisite_unit_id uuid references public.units(id),
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (module_id, order_index),
  constraint chk_unit_prerequisite_not_self check (prerequisite_unit_id is distinct from id)
);

create index idx_units_module on public.units (module_id, order_index);

create trigger trg_units_updated
  before update on public.units
  for each row execute function public.set_updated_at();

create trigger trg_units_audit
  after insert or update or delete on public.units
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 2. Estado efectivo de una unidad (spec/07_AULA_VIRTUAL.md §3)
-- -----------------------------------------------------------------------------
-- Se evalúa al consultar, nunca con un cron que cambie filas -- así no hay
-- desfases ni jobs que puedan fallar en silencio.
create or replace function public.unit_effective_status(
  p_open_at  timestamptz,
  p_close_at timestamptz,
  p_manual   public.unit_manual_status
) returns text
language sql
stable
as $$
  select case
    when p_manual = 'cerrada' then 'cerrada'
    when p_manual = 'abierta' then 'abierta'
    when p_open_at is null then 'borrador'
    when now() < p_open_at then 'programada'
    when p_close_at is not null and now() > p_close_at then 'cerrada'
    else 'abierta'
  end;
$$;

create or replace view public.v_units_status
with (security_invoker = true)
as
select
  u.*,
  public.unit_effective_status(u.open_at, u.close_at, u.manual_status) as effective_status
from public.units u;

-- -----------------------------------------------------------------------------
-- 3. ¿Se cumple el prerrequisito de una unidad para este estudiante?
-- -----------------------------------------------------------------------------
-- Fase 1: si no hay prerrequisito, siempre true. La verificación real contra
-- la certificación aprobada llega en la Fase 3 (migración 176), cuando exams
-- tenga la noción de "certificación bloqueante" -- se deja el enganche listo
-- para no tener que tocar unit_items otra vez.
create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select true;
$$;

comment on function public.unit_prerequisite_met is
  'Placeholder de la Fase 1 -- siempre true. Se implementa de verdad en la Fase 3 (migración 176), contra exam_attempts de la certificación de la unidad prerrequisito.';

-- -----------------------------------------------------------------------------
-- 4. unit_items
-- -----------------------------------------------------------------------------
create table public.unit_items (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references public.units(id) on delete cascade,
  type            public.unit_item_type not null,
  order_index     int  not null,
  content_item_id uuid references public.content_items(id) on delete cascade,
  exam_id         uuid references public.exams(id) on delete cascade,
  assignment_id   uuid,  -- FK se agrega en la migración 178 (ver nota arriba)
  visible         boolean not null default true,
  visible_from    timestamptz,
  visible_until   timestamptz,
  required        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (unit_id, order_index),

  constraint chk_unit_item_ref check (
    (type = 'material' and content_item_id is not null and exam_id is null and assignment_id is null)
    or (type = 'quiz'   and exam_id is not null and content_item_id is null and assignment_id is null)
    or (type = 'tarea'  and assignment_id is not null and content_item_id is null and exam_id is null)
    or (type = 'dudas'  and content_item_id is null and exam_id is null and assignment_id is null)
  )
);

create index idx_unit_items_unit on public.unit_items (unit_id, order_index);
create index idx_unit_items_content on public.unit_items (content_item_id) where content_item_id is not null;
create index idx_unit_items_exam on public.unit_items (exam_id) where exam_id is not null;

create trigger trg_unit_items_audit
  after insert or update or delete on public.unit_items
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- 5. ¿Un elemento de unidad es visible ahora mismo?
-- -----------------------------------------------------------------------------
-- spec/07_AULA_VIRTUAL.md §2 y §16.8: una unidad CERRADA no es invisible --
-- por defecto queda en modo "solo lectura para repaso" (el estudiante ya
-- pagó por ese contenido, perderlo de vista al cerrar la unidad sería
-- castigarlo). Lo que sí se cierra del todo es PRESENTAR -- entregar un
-- intento de examen o subir una tarea -- pero eso se valida en las Fases 3
-- y 5 (migraciones 176/178), contra exam_attempts/submissions, no aquí.
-- Una unidad en 'borrador' o 'programada' sigue sin mostrar nada: ese es el
-- caso real que la política original de "todo cerrado" tenía en mente.
--
-- Parámetros escalares a propósito (no tipos fila public.units/unit_items):
-- dentro de una política RLS el nombre de la tabla no queda disponible como
-- variable de fila correlacionada, solo sus columnas sueltas -- pasar
-- escalares es lo que de verdad funciona ahí.
create or replace function public.unit_item_is_visible(
  p_item_visible      boolean,
  p_visible_from      timestamptz,
  p_visible_until     timestamptz,
  p_unit_open_at      timestamptz,
  p_unit_close_at     timestamptz,
  p_unit_manual       public.unit_manual_status
) returns boolean
language sql
stable
as $$
  select
    public.unit_effective_status(p_unit_open_at, p_unit_close_at, p_unit_manual) in ('abierta','cerrada')
    and p_item_visible
    and (p_visible_from is null or p_visible_from <= now())
    and (p_visible_until is null or p_visible_until >= now());
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.units      enable row level security;
alter table public.unit_items enable row level security;

-- units ----------------------------------------------------------------------
create policy "estudiante: leer unidades abiertas de su modulo"
  on public.units for select to authenticated
  using (
    module_id = (select public.my_module_id())
    and public.unit_effective_status(open_at, close_at, manual_status) in ('abierta','cerrada')
  );

create policy "personal: leer unidades"
  on public.units for select to authenticated
  using ((select public.is_staff()));

create policy "personal: escribir unidades"
  on public.units for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- unit_items -------------------------------------------------------------------
create policy "estudiante: leer elementos visibles de su modulo"
  on public.unit_items for select to authenticated
  using (
    exists (
      select 1 from public.units u
      where u.id = unit_id
        and u.module_id = (select public.my_module_id())
        and public.unit_item_is_visible(
          visible, visible_from, visible_until,
          u.open_at, u.close_at, u.manual_status
        )
    )
  );

create policy "personal: leer elementos de unidad"
  on public.unit_items for select to authenticated
  using ((select public.is_staff()));

create policy "personal: escribir elementos de unidad"
  on public.unit_items for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
