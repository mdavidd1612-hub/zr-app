-- 18-nov-2026 (reporte del profesor Arjona): un material obligatorio que todavía no
-- está aprobado/publicado (o cuya fecha de visibilidad no llega) el estudiante no
-- puede verlo, pero fn_unit_required_complete igual lo contaba como pendiente ->
-- la certificación quedaba trabada para siempre. Ahora solo cuentan los materiales
-- que el estudiante puede ver de verdad (mismo criterio que la RLS de content_items).
create or replace function public.fn_unit_required_complete(p_unit_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_student_id = auth.uid() or public.is_staff()) and not exists (
    select 1
    from public.unit_items ui
    join public.content_items ci on ci.id = ui.content_item_id
    where ui.unit_id = p_unit_id
      and ui.type = 'material'
      and ui.required = true
      and ci.is_published
      and (ci.visible_from is null or ci.visible_from <= now())
      and not exists (
        select 1 from public.material_progress mp
        where mp.content_item_id = ci.id
          and mp.student_id = p_student_id
          and (
            (ci.check_quiz_id is null and mp.completed_at is not null)
            or (ci.check_quiz_id is not null and mp.validated = true)
          )
      )
  );
$$;
