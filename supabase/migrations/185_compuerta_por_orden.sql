-- =============================================================================
-- ZR APP · MIGRACIÓN 185 · Compuerta real entre unidades (por orden)
-- =============================================================================
-- Decisión del coordinador (nov 2026): las certificaciones son ocasionales
-- ("cuando el profesor lo diga"). No se administra un mapa de prerrequisitos
-- a mano: una unidad queda BLOQUEADA solo si la unidad INMEDIATAMENTE ANTERIOR
-- (mismo módulo, order_index - 1) tiene una certificación PUBLICADA que el
-- estudiante todavía no aprobó. El profesor marca un examen como certificación
-- (migración 176 + UI nov 2026) y eso traba la unidad que sigue, sin más.
--
-- Esto reemplaza la lógica basada en prerequisite_unit_id de la migración 176
-- (que requería que alguien setear ese campo a mano y nunca se exponía en la
-- UI). La columna units.prerequisite_unit_id se deja por compatibilidad pero
-- ya no es la fuente de verdad.
--
-- UX decidida: la unidad bloqueada SE VE en la lista con candado ("se abre
-- cuando apruebes la unidad anterior"); no desaparece. Pero su CONTENIDO no es
-- accesible ni por URL directa -- de ahí que la compuerta se aplique también en
-- la RLS de unit_items, no solo en la interfaz.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. unit_prerequisite_met: ahora por orden, no por prerequisite_unit_id
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER a propósito (lee exam_attempts saltando su RLS) -- con la
-- guarda de "solo por mí mismo, o soy personal" que ya traía de la 176.
create or replace function public.unit_prerequisite_met(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_student_id is distinct from auth.uid() and not public.is_staff() then false
    when (select public.is_staff()) then true   -- el profesor/dirección nunca ve bloqueo
    else not exists (
      select 1
      from public.units cur
      join public.units prev
        on prev.module_id = cur.module_id
       and prev.order_index = cur.order_index - 1
      join public.unit_items ui on ui.unit_id = prev.id and ui.type = 'quiz'
      join public.exams e
        on e.id = ui.exam_id
       and e.kind = 'certificacion'
       and e.status in ('habilitado', 'cerrado', 'calificado')
      where cur.id = p_unit_id
        and not exists (
          select 1 from public.exam_attempts a
          where a.exam_id = e.id
            and a.student_id = p_student_id
            and a.status = 'calificado'
            and a.total_score >= e.passing_score
        )
    )
  end;
$$;

comment on function public.unit_prerequisite_met is
  'Compuerta por orden (migración 185): una unidad está desbloqueada salvo que la unidad inmediatamente anterior (mismo módulo) tenga una certificación publicada que el estudiante no aprobó. El personal nunca ve bloqueo.';

-- -----------------------------------------------------------------------------
-- 2. El contenido de una unidad bloqueada no se puede leer (ni por URL)
-- -----------------------------------------------------------------------------
drop policy if exists "estudiante: leer elementos visibles de su modulo" on public.unit_items;

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
        and public.unit_prerequisite_met(u.id, auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 3. La lista del estudiante necesita saber qué unidad está bloqueada
-- -----------------------------------------------------------------------------
-- Se agrega prerequisite_met a la vista (security_invoker, corre como quien
-- consulta). Para un estudiante devuelve su propio estado de candado; el
-- personal siempre ve true (no hay candado para ellos).
create or replace view public.v_units_status
with (security_invoker = true)
as
select
  u.*,
  public.unit_effective_status(u.open_at, u.close_at, u.manual_status) as effective_status,
  public.unit_prerequisite_met(u.id, auth.uid()) as prerequisite_met
from public.units u;
